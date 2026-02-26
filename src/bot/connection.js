/**
 * Arquivo: src/bot/connection.js
 * Descrição: Gerencia a conexão WebSocket com o WhatsApp via Baileys.
 *            Responsável por criar e configurar o socket com opções de produção,
 *            integrando o auth state customizado do Google Secret Manager.
 *
 * Responsabilidades:
 * - Inicializar o auth state via Google Secret Manager (useSecretManagerAuthState)
 * - Obter a versão mais recente do protocolo WhatsApp (fetchLatestBaileysVersion)
 * - Criar o socket Baileys com configurações otimizadas para produção
 * - Expor connectToWhatsApp() para ser chamado pelo entry point (src/index.js)
 *
 * Features implementadas neste arquivo:
 * - feat-013: Implementar função connectToWhatsApp com configurações de produção
 *
 * Criado em: 2026-02-26
 */

import makeWASocket, {
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
} from 'baileys';
import NodeCache from 'node-cache';
import logger from '../utils/logger.js';
import { useSecretManagerAuthState } from './auth/secretManagerAuthState.js';

// -----------------------------------------------------------------
// Variáveis de ambiente
// -----------------------------------------------------------------

/**
 * ID do projeto GCP onde o Secret Manager está configurado.
 * Obrigatório — a aplicação não consegue autenticar no WhatsApp sem este valor.
 */
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID;

/**
 * Nome do secret no Secret Manager que armazena a sessão WhatsApp.
 * Valor padrão alinhado com o .env.example e a documentação do projeto.
 */
const SECRET_NAME = process.env.SECRET_NAME || 'whatsapp-baileys-session';

// -----------------------------------------------------------------
// Cache de metadados de grupos
// -----------------------------------------------------------------

/**
 * Cache em memória para metadados de grupos do WhatsApp.
 *
 * Evita que o Baileys consulte o servidor WhatsApp repetidamente para
 * obter informações do mesmo grupo (nome, participantes, permissões).
 * O TTL de 5 minutos equilibra consistência e performance — grupos não
 * mudam com tanta frequência e a inconsistência temporária é aceitável.
 *
 * Configuração:
 * - stdTTL: 300s (5 minutos) — tempo de vida de cada entrada
 * - checkperiod: 60s — intervalo de varredura para expirar entradas antigas
 */
const groupCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// -----------------------------------------------------------------
// Função principal de conexão
// -----------------------------------------------------------------

/**
 * Inicializa a conexão WebSocket com o WhatsApp usando as configurações
 * recomendadas para ambientes de produção em VM (GCP Compute Engine).
 *
 * Fluxo:
 * 1. Carrega/inicializa o auth state do Google Secret Manager
 * 2. Obtém a versão mais recente do protocolo WA (fetchLatestBaileysVersion)
 * 3. Cria o socket com opções de produção:
 *    - makeCacheableSignalKeyStore: reduz leituras ao Secret Manager durante
 *      troca de chaves de sinal (operação crítica para performance)
 *    - cachedGroupMetadata: evita consultas repetidas ao servidor WA para grupos
 *    - printQRInTerminal: false — usamos Pairing Code em produção (sem QR)
 *    - syncFullHistory: false — evita download do histórico completo (memória/banda)
 *    - Timeouts configurados para ambientes de rede com latência variável (VM GCP)
 * 4. Retorna o socket para registro de event listeners (feats 014, 015, 016)
 *
 * @returns {Promise<import('baileys').WASocket>} Socket Baileys configurado e em processo de conexão
 * @throws {Error} Se GCP_PROJECT_ID não estiver definido ou se o Secret Manager falhar
 *
 * @example
 * // src/index.js
 * import connectToWhatsApp from './bot/connection.js';
 * const sock = await connectToWhatsApp();
 * // Registrar listeners de eventos no sock...
 */
async function connectToWhatsApp() {
  // Valida que o ID do projeto GCP foi configurado antes de tentar conectar
  if (!GCP_PROJECT_ID) {
    const msg = '[Connection] Variável GCP_PROJECT_ID não definida. Configure antes de iniciar.';
    logger.error(msg);
    throw new Error(msg);
  }

  logger.info({ secretName: SECRET_NAME, projectId: GCP_PROJECT_ID }, '[Connection] Inicializando auth state');

  // Carrega a sessão existente do Secret Manager ou inicializa credenciais em branco
  const { state, saveCreds } = await useSecretManagerAuthState(GCP_PROJECT_ID, SECRET_NAME);

  // Obtém a versão mais recente do protocolo WhatsApp Web
  // Garante compatibilidade sem precisar atualizar o pacote baileys manualmente
  const { version } = await fetchLatestBaileysVersion();

  logger.info({ version }, '[Connection] Versão do protocolo Baileys obtida');

  // Cria o socket WhatsApp com configurações otimizadas para produção
  const sock = makeWASocket({
    version,

    auth: {
      creds: state.creds,
      /**
       * makeCacheableSignalKeyStore envolve as keys do auth state com uma camada
       * de cache em memória, evitando que o Baileys leia o Secret Manager a cada
       * troca de chave de sinal durante envio/recebimento de mensagens criptografadas.
       * Essencial para performance e para não exceder a quota do Secret Manager.
       */
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },

    /**
     * Logger pino compartilhado da aplicação.
     * Em produção (LOG_LEVEL=warn), filtra a verbosidade interna do Baileys —
     * que por padrão gera dezenas de logs de debug por mensagem recebida.
     */
    logger,

    /**
     * Identifica o cliente como Ubuntu Desktop para o servidor WhatsApp Web.
     * Browsers.ubuntu() é preferido em ambientes headless de servidor.
     */
    browser: Browsers.ubuntu('WhatsApp Server'),

    /**
     * Desabilita a exibição do QR Code no terminal.
     * Em produção, a autenticação ocorre exclusivamente via Pairing Code (feat-014).
     */
    printQRInTerminal: false,

    /**
     * Desabilita sincronização do histórico completo de mensagens.
     * Esta operação consumiria muita memória e banda na primeira conexão —
     * desnecessário para um bot que processa apenas mensagens recebidas em tempo real.
     */
    syncFullHistory: false,

    /**
     * Timeout de conexão inicial ao servidor WhatsApp Web.
     * 60s é suficiente mesmo em redes de latência alta típicas de VM no GCP.
     */
    connectTimeoutMs: 60_000,

    /**
     * Timeout padrão para queries ao servidor WhatsApp (ex: fetchGroupMetadata).
     * Alinhado com connectTimeoutMs para consistência nos tempos de espera.
     */
    defaultQueryTimeoutMs: 60_000,

    /**
     * Intervalo de keepalive do WebSocket.
     * Envia pings a cada 25s para manter a conexão ativa e detectar desconexões
     * silenciosas causadas por firewalls ou instabilidade de rede da VM.
     */
    keepAliveIntervalMs: 25_000,

    /**
     * Delay entre retentativas de requisições com falha.
     * 500ms evita sobrecarregar o servidor WhatsApp em caso de erros transitórios.
     */
    retryRequestDelayMs: 500,

    /**
     * Provedor de metadados de grupos com cache em memória (NodeCache).
     * O Baileys consulta esta função antes de ir ao servidor WhatsApp,
     * reduzindo latência e número de requisições para grupos frequentemente acessados.
     *
     * @param {string} jid - JID do grupo (formato: ID@g.us)
     * @returns {Promise<object|undefined>} Metadados do grupo em cache, ou undefined se expirado
     */
    cachedGroupMetadata: async (jid) => groupCache.get(jid),

    /**
     * Provedor de mensagens por ID para suporte a retransmissão (retry).
     * Retorna undefined pois não implementamos persistência de mensagens
     * (fora do escopo desta versão — sem banco de dados).
     *
     * @param {object} key - Chave da mensagem { remoteJid, id, fromMe }
     * @returns {Promise<undefined>}
     */
    getMessage: async (_key) => undefined,
  });

  // Atualiza o cache de grupos quando metadados são recebidos do servidor WhatsApp
  // Garante que cachedGroupMetadata sempre retorne dados frescos após uma atualização
  sock.ev.on('groups.update', (events) => {
    for (const event of events) {
      if (event.id) {
        groupCache.set(event.id, event);
        logger.debug({ groupId: event.id }, '[Connection] Cache de grupo atualizado');
      }
    }
  });

  logger.info('[Connection] Socket WhatsApp criado — aguardando conexão');

  return sock;
}

export default connectToWhatsApp;
