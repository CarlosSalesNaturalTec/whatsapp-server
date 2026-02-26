/**
 * Arquivo: src/bot/auth/secretManagerAuthState.js
 * Descrição: Auth state customizado do Baileys com persistência no Google Secret Manager.
 *            Substitui o useMultiFileAuthState padrão (inadequado para produção em VM),
 *            armazenando as credenciais de sessão WhatsApp de forma segura e auditável.
 *
 * Responsabilidades:
 * - Ler credenciais de sessão do Secret Manager (getSecretValue)
 * - Escrever/atualizar credenciais no Secret Manager (saveSecretValue) — feat-010
 * - Expor auth state compatível com makeWASocket (useSecretManagerAuthState) — feat-011
 *
 * Autenticação GCP:
 * - Em produção (VM Compute Engine): Application Default Credentials (ADC) automático
 * - Em desenvolvimento local: requer GOOGLE_APPLICATION_CREDENTIALS apontando para chave SA
 *
 * Feature: feat-009 - Implementar getSecretValue (leitura do secret)
 * Atualizado em: feat-010 - Implementar saveSecretValue (escrita do secret)
 * Atualizado em: feat-011 - Implementar useSecretManagerAuthState (auth state completo)
 * Atualizado em: feat-012 - Adicionar cache em memória e debounce no keys.set
 * Criado em: 2026-02-25
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { BufferJSON, initAuthCreds } from 'baileys';
import logger from '../../utils/logger.js';

/**
 * Cliente singleton do Google Secret Manager.
 * Reutiliza a mesma instância em todas as operações para evitar overhead de autenticação.
 * A autenticação ocorre automaticamente via ADC na VM do Compute Engine.
 */
const client = new SecretManagerServiceClient();

/**
 * Código de erro gRPC retornado pelo Secret Manager quando o recurso não existe.
 * Documentação: https://grpc.github.io/grpc/core/md_doc_statuscodes.html
 */
const GRPC_NOT_FOUND = 5;

/**
 * Delay em ms para o debounce aplicado em keys.set.
 * O Baileys dispara keys.set em rajadas durante sync inicial e troca de mensagens.
 * Com 3s de debounce, rajadas consecutivas resultam em uma única escrita no Secret Manager,
 * reduzindo drasticamente o número de requests e evitando throttling da API GCP.
 *
 * Referência de quota: 10.000 requests/mês no free tier do Secret Manager.
 */
const DEBOUNCE_DELAY_MS = 3000;

// -----------------------------------------------------------------
// Utilitário de debounce
// -----------------------------------------------------------------

/**
 * Cria uma versão debounced de uma função assíncrona.
 *
 * Chamadas feitas dentro do intervalo `delayMs` cancelam o timer anterior,
 * garantindo que apenas a última chamada de uma rajada seja efetivamente executada.
 * Erros da execução assíncrona são capturados e logados internamente —
 * o caller não precisa lidar com a rejeição da Promise.
 *
 * @param {Function} fn      - Função assíncrona a ser debounced
 * @param {number}   delayMs - Tempo de espera em milissegundos após a última chamada
 * @returns {Function} Versão debounced que retorna void (fire-and-forget)
 *
 * @example
 * const debouncedSave = createDebounce(persistState, 3000);
 * debouncedSave(); // Agenda execução em 3s
 * debouncedSave(); // Cancela o timer anterior, reagenda em mais 3s
 */
function createDebounce(fn, delayMs) {
  let timer = null;

  return function debouncedFn(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args).catch((err) => {
        logger.error({ err }, '[AuthState] Erro ao persistir estado via debounce (keys.set)');
      });
    }, delayMs);
  };
}

// -----------------------------------------------------------------
// Leitura do Secret Manager
// -----------------------------------------------------------------

/**
 * Lê o valor mais recente de um secret no Google Secret Manager.
 *
 * Acessa sempre a versão 'latest' do secret — garantindo que a sessão
 * WhatsApp mais recente seja carregada após cada atualização de credenciais.
 *
 * @param {string} secretName - Nome do secret no Secret Manager (ex: 'whatsapp-baileys-session')
 * @param {string} projectId  - ID do projeto GCP (ex: 'meu-projeto-123456')
 * @returns {Promise<string|null>} Conteúdo do secret em string UTF-8, ou null se não existir
 * @throws {Error} Se ocorrer erro de permissão, rede ou qualquer falha não-NOT_FOUND
 *
 * @example
 * const raw = await getSecretValue('whatsapp-baileys-session', 'meu-projeto');
 * if (raw === null) {
 *   // Primeira execução — secret ainda não existe
 * } else {
 *   const data = JSON.parse(raw, BufferJSON.reviver);
 * }
 */
async function getSecretValue(secretName, projectId) {
  const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;

  logger.debug({ secretName, projectId }, '[SecretManager] Lendo secret');

  try {
    const [version] = await client.accessSecretVersion({ name });
    const value = version.payload?.data?.toString();

    logger.debug({ secretName }, '[SecretManager] Secret lido com sucesso');
    return value;
  } catch (err) {
    if (err.code === GRPC_NOT_FOUND) {
      logger.warn({ secretName }, '[SecretManager] Secret não encontrado — será inicializado na primeira autenticação');
      return null;
    }

    logger.error({ err, secretName, projectId }, '[SecretManager] Erro ao ler secret');
    throw err;
  }
}

// -----------------------------------------------------------------
// Escrita no Secret Manager
// -----------------------------------------------------------------

/**
 * Persiste um novo valor no Google Secret Manager adicionando uma nova versão ao secret.
 *
 * Se o secret ainda não existir (primeira execução), ele é criado automaticamente
 * com política de replicação automática antes de adicionar a versão.
 * Versões anteriores do secret permanecem acessíveis no GCP para rollback manual.
 *
 * @param {string} secretName - Nome do secret no Secret Manager
 * @param {string} projectId  - ID do projeto GCP
 * @param {string} payload    - Conteúdo a ser salvo (string UTF-8, geralmente JSON serializado)
 * @returns {Promise<void>}
 * @throws {Error} Se ocorrer erro de permissão ou falha inesperada na API GCP
 *
 * @example
 * const payload = JSON.stringify({ creds, keys }, BufferJSON.replacer);
 * await saveSecretValue('whatsapp-baileys-session', 'meu-projeto', payload);
 */
async function saveSecretValue(secretName, projectId, payload) {
  const parent = `projects/${projectId}/secrets/${secretName}`;
  const data   = Buffer.from(payload, 'utf8');

  logger.debug({ secretName }, '[SecretManager] Salvando nova versão do secret');

  try {
    await client.addSecretVersion({ parent, payload: { data } });
    logger.debug({ secretName }, '[SecretManager] Nova versão do secret salva com sucesso');
  } catch (err) {
    if (err.code !== GRPC_NOT_FOUND) {
      logger.error({ err, secretName, projectId }, '[SecretManager] Erro ao salvar secret');
      throw err;
    }

    // Secret não existe — cria com replication automática e então adiciona a versão
    logger.warn({ secretName, projectId }, '[SecretManager] Secret não existe, criando automaticamente');

    try {
      await client.createSecret({
        parent: `projects/${projectId}`,
        secretId: secretName,
        secret: { replication: { automatic: {} } },
      });

      await client.addSecretVersion({ parent, payload: { data } });
      logger.info({ secretName }, '[SecretManager] Secret criado e primeira versão salva com sucesso');
    } catch (createErr) {
      logger.error({ err: createErr, secretName, projectId }, '[SecretManager] Erro ao criar secret');
      throw createErr;
    }
  }
}

// -----------------------------------------------------------------
// Auth State completo para makeWASocket
// -----------------------------------------------------------------

/**
 * Cria e retorna um auth state do Baileys com persistência no Google Secret Manager.
 *
 * Substitui o useMultiFileAuthState padrão, que salva credenciais em arquivos
 * locais — inseguro em ambientes de VM compartilhada ou com snapshots de disco.
 *
 * Comportamento na inicialização:
 * - Secret existe → carrega creds e keys previamente persistidos
 * - Secret não existe → inicializa creds em branco (initAuthCreds) e keys vazias
 *   aguardando a primeira autenticação via Pairing Code
 *
 * O objeto `state` retornado é passado diretamente para makeWASocket({ auth: state }).
 * O `saveCreds` é passado para sock.ev.on('creds.update', saveCreds).
 *
 * @param {string} projectId              - ID do projeto GCP
 * @param {string} [secretName]           - Nome do secret (padrão: 'whatsapp-baileys-session')
 * @returns {Promise<{ state: object, saveCreds: Function }>}
 * @throws {Error} Se falhar ao ler o secret por motivo diferente de NOT_FOUND
 *
 * @example
 * const { state, saveCreds } = await useSecretManagerAuthState('meu-projeto-gcp');
 * const sock = makeWASocket({ auth: { creds: state.creds, keys: state.keys } });
 * sock.ev.on('creds.update', saveCreds);
 */
async function useSecretManagerAuthState(
  projectId,
  secretName = 'whatsapp-baileys-session'
) {
  // Carrega o estado persistido ou inicializa do zero na primeira execução
  const raw = await getSecretValue(secretName, projectId);

  let creds;
  let keys = {};

  if (raw) {
    const parsed = JSON.parse(raw, BufferJSON.reviver);
    creds = parsed.creds;
    keys  = parsed.keys ?? {};
    logger.info({ secretName }, '[AuthState] Sessão carregada do Secret Manager');
  } else {
    creds = initAuthCreds();
    logger.info({ secretName }, '[AuthState] Nenhuma sessão encontrada — iniciando autenticação');
  }

  /**
   * Serializa e persiste o estado atual (creds + keys) no Secret Manager.
   * Chamado pelo listener creds.update e pelo keys.set interno.
   *
   * @returns {Promise<void>}
   */
  async function persistState() {
    const payload = JSON.stringify({ creds, keys }, BufferJSON.replacer);
    await saveSecretValue(secretName, projectId, payload);
  }

  /**
   * Versão debounced de persistState para uso exclusivo em keys.set.
   * Agrupa rajadas de eventos em uma única escrita ao Secret Manager após 3s de inatividade.
   * Erros são capturados internamente — keys.set não precisa tratar rejeição.
   */
  const persistStateDebounced = createDebounce(persistState, DEBOUNCE_DELAY_MS);

  const state = {
    creds,

    keys: {
      /**
       * Recupera signal keys do cache em memória por tipo e lista de IDs.
       * Retorna um mapa { [id]: value } para cada ID solicitado.
       * IDs sem valor registrado retornam undefined (tratado pelo Baileys).
       *
       * @param {string}   type - Categoria da key (ex: 'pre-key', 'session', 'sender-key')
       * @param {string[]} ids  - Lista de IDs a recuperar
       * @returns {Record<string, any>}
       */
      get(type, ids) {
        return ids.reduce((acc, id) => {
          const value = keys[`${type}-${id}`];
          if (value !== undefined) acc[id] = value;
          return acc;
        }, {});
      },

      /**
       * Atualiza o cache em memória e agenda persistência debounced no Secret Manager.
       *
       * A atualização do cache é síncrona e imediata — o Baileys lê as keys
       * via get() logo após o set(), portanto o cache deve estar atualizado na hora.
       * A escrita no Secret Manager é debounced (3s): rajadas de eventos set()
       * resultam em uma única chamada à API GCP, evitando throttling.
       *
       * Entradas com valor null/undefined são removidas do cache (keys expiradas).
       *
       * @param {Record<string, Record<string, any>>} data - Mapa categoria → { id: value }
       * @returns {void} Fire-and-forget — persistência ocorre de forma assíncrona
       */
      set(data) {
        for (const [category, entries] of Object.entries(data)) {
          for (const [id, value] of Object.entries(entries)) {
            if (value != null) {
              keys[`${category}-${id}`] = value;
            } else {
              delete keys[`${category}-${id}`];
            }
          }
        }
        // Agenda persistência debounced — não bloqueia o event loop do Baileys
        persistStateDebounced();
      },
    },
  };

  /**
   * Persiste as credenciais atualizadas no Secret Manager.
   * Deve ser registrado como listener do evento creds.update:
   *   sock.ev.on('creds.update', saveCreds)
   *
   * @returns {Promise<void>}
   */
  async function saveCreds() {
    await persistState();
  }

  return { state, saveCreds };
}

export { getSecretValue, saveSecretValue, useSecretManagerAuthState };
