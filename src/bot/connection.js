/**
 * Arquivo: src/bot/connection.js
 * Descrição: Fábrica de socket Baileys — cria e configura o WebSocket WhatsApp.
 *            Notifica o chamador sobre eventos de conexão via callbacks,
 *            mantendo a lógica de ciclo de vida no ConnectionManager.
 *
 * Responsabilidades:
 * - Carregar/inicializar o auth state via Google Secret Manager
 * - Obter a versão mais recente do protocolo WhatsApp (fetchLatestBaileysVersion)
 * - Criar o socket Baileys com configurações otimizadas para produção
 * - Solicitar Pairing Code quando não há sessão registrada
 * - Notificar o ConnectionManager via callbacks (onPairingCode, onConnected, onDisconnected)
 *
 * Nota de arquitetura:
 *   A lógica de reconexão e gerenciamento de estado foi movida para
 *   src/bot/connectionManager.js. Este arquivo é agnóstico ao ciclo de vida —
 *   apenas cria o socket e dispara callbacks.
 *
 * Features implementadas neste arquivo:
 * - feat-013: Configurações de produção do socket
 * - feat-014: Autenticação por Pairing Code (refatorado para callback)
 * - feat-015: Notificação de reconexão via onDisconnected (delegado ao Manager)
 * - feat-016: Persistência de credenciais no creds.update
 *
 * Criado em: 2026-02-26
 * Refatorado em: 2026-03-03 — callbacks substituem lógica inline; phoneNumber
 *                              vem do caller ao invés de process.env
 */

import makeWASocket, {
  DisconnectReason,
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
const SECRET_NAME = process.env.SECRET_NAME || 'whatsapp-baileys-auth';

// -----------------------------------------------------------------
// Cache de metadados de grupos
// -----------------------------------------------------------------

/**
 * Cache em memória para metadados de grupos do WhatsApp.
 * Evita consultas repetidas ao servidor WA para o mesmo grupo.
 * TTL de 5 minutos equilibra consistência e performance.
 */
const groupCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// -----------------------------------------------------------------
// Função principal de conexão
// -----------------------------------------------------------------

/**
 * Cria e configura o socket Baileys para conexão com o WhatsApp.
 *
 * Fluxo:
 * 1. Carrega o auth state do Secret Manager (ou inicializa em branco)
 * 2. Obtém a versão mais recente do protocolo WA
 * 3. Cria o socket com opções de produção
 * 4. Registra os listeners de eventos:
 *    - creds.update  → persiste credenciais
 *    - groups.update → atualiza cache de grupos
 *    - connection.update → solicita pairing code (se necessário) e notifica callbacks
 * 5. Retorna o socket criado (a conexão se completa de forma assíncrona via eventos)
 *
 * @param {object}   options
 * @param {string}   options.phoneNumber    - Número E.164 sem '+' (ex: '5511999999999').
 *                                           Necessário apenas quando não há sessão registrada.
 * @param {Function} [options.onPairingCode]      - Chamado com o código gerado (string 'XXXX-XXXX')
 * @param {Function} [options.onConnected]      - Chamado quando connection === 'open'
 * @param {Function} [options.onDisconnected]   - Chamado quando connection === 'close',
 *                                                recebe (shouldReconnect: boolean)
 * @param {Function} [options.onPairingCodeError] - Chamado quando requestPairingCode() falha;
 *                                                  recebe (err: Error)
 *
 * @returns {Promise<import('baileys').WASocket>} Socket configurado e em processo de conexão
 * @throws {Error} Se GCP_PROJECT_ID não estiver definido ou o Secret Manager falhar
 */
async function connectToWhatsApp({ phoneNumber, onPairingCode, onConnected, onDisconnected, onPairingCodeError } = {}) {
  // Valida pré-requisito de infraestrutura antes de qualquer operação de rede
  if (!GCP_PROJECT_ID) {
    const msg = '[Connection] Variável GCP_PROJECT_ID não definida. Configure antes de conectar.';
    logger.error(msg);
    throw new Error(msg);
  }

  logger.info({ secretName: SECRET_NAME, projectId: GCP_PROJECT_ID }, '[Connection] Inicializando auth state');

  // Carrega a sessão existente do Secret Manager ou inicializa credenciais em branco
  let { state, saveCreds } = await useSecretManagerAuthState(GCP_PROJECT_ID, SECRET_NAME);

  // Se há phoneNumber (novo pareamento) e a sessão carregada não está registrada,
  // existe uma sessão parcial de tentativa anterior. Recarregar com credenciais
  // limpas evita que o WA rejeite com 401 ao receber chaves de sinal inconsistentes.
  if (phoneNumber && !state.creds.registered) {
    logger.info(
      { secretName: SECRET_NAME },
      '[Connection] Sessão não registrada detectada — recarregando com credenciais limpas para novo pareamento',
    );
    ({ state, saveCreds } = await useSecretManagerAuthState(GCP_PROJECT_ID, SECRET_NAME, { startFresh: true }));
  }

  // Obtém a versão mais recente do protocolo WhatsApp Web
  const { version } = await fetchLatestBaileysVersion();
  logger.info({ version }, '[Connection] Versão do protocolo Baileys obtida');

  // Cria o socket com configurações otimizadas para produção
  const sock = makeWASocket({
    version,

    auth: {
      creds: state.creds,
      /**
       * makeCacheableSignalKeyStore reduz leituras ao Secret Manager durante
       * troca de chaves de sinal (operação crítica para performance em produção).
       */
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },

    logger,

    /** Identifica o cliente como WhatsApp Web — simula sessão web legítima */
    browser: Browsers.ubuntu('Chrome'),

    /** Produção: autenticação exclusiva via Pairing Code, sem QR no terminal */
    printQRInTerminal: false,

    /** Desabilita sync do histórico completo — desnecessário para um bot de mensagens */
    syncFullHistory: false,

    connectTimeoutMs:       60_000,
    defaultQueryTimeoutMs:  60_000,

    /** Keepalive de 25s: detecta desconexões silenciosas causadas por firewalls da VM */
    keepAliveIntervalMs:    25_000,

    retryRequestDelayMs:    500,

    cachedGroupMetadata: async (jid) => groupCache.get(jid),

    getMessage: async (_key) => undefined,
  });

  // ---------------------------------------------------------------
  // Listener: creds.update
  // CRÍTICO: toda atualização de credencial deve ser persistida.
  // Ausência deste listener corrompe a sessão e exige novo Pairing Code.
  // O wrapper try/catch evita unhandled rejection caso o Secret Manager
  // falhe pontualmente — o erro é logado mas não derruba o processo.
  // As credenciais permanecem atualizadas em memória; a próxima escrita
  // bem-sucedida (keys.set debounced ou creds.update seguinte) as persiste.
  // ---------------------------------------------------------------
  sock.ev.on('creds.update', async () => {
    try {
      await saveCreds();
    } catch (err) {
      logger.error({ err }, '[Connection] Falha ao persistir creds.update no Secret Manager — sessão pode estar desatualizada');
    }
  });

  // Mantém o cache de grupos atualizado com os eventos recebidos do WA
  sock.ev.on('groups.update', (events) => {
    for (const event of events) {
      if (event.id) {
        groupCache.set(event.id, event);
        logger.debug({ groupId: event.id }, '[Connection] Cache de grupo atualizado');
      }
    }
  });

  // ---------------------------------------------------------------
  // Listener: connection.update
  // ---------------------------------------------------------------

  /**
   * Garante que requestPairingCode() seja chamado apenas uma vez por ciclo de vida.
   * O evento connection.update pode disparar múltiplas vezes durante a negociação
   * do WebSocket — sem este controle, o código seria re-solicitado desnecessariamente.
   */
  let pairingCodeRequested = false;

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // ---------------------------------------------------------------
    // Pairing Code — solicitado apenas quando não há sessão registrada
    // ---------------------------------------------------------------

    const shouldRequestPairing =
      (connection === 'connecting' || !!qr) &&
      !sock.authState.creds.registered &&
      !pairingCodeRequested;

    if (shouldRequestPairing) {
      if (!phoneNumber) {
        logger.error(
          '[Connection] phoneNumber não fornecido — impossível solicitar Pairing Code. ' +
          'Informe o número no formato E.164 sem + (ex: 5511999999999).',
        );
        return;
      }

      pairingCodeRequested = true;
      logger.info({ phoneNumber }, '[Connection] Solicitando Pairing Code...');

      // Aguarda 1,5s para que o handshake interno do protocolo WA
      // complete antes de enviar o pedido de Pairing Code.
      // Sem este delay, requestPairingCode() pode falhar com
      // "Connection Closed" pois o socket ainda não está pronto.
      await new Promise((resolve) => setTimeout(resolve, 1500));

      try {
        const code = await sock.requestPairingCode(phoneNumber);

        // Exibe o código localmente para o administrador (fallback de visibilidade)
        logger.info(`[Connection] *** PAIRING CODE: ${code} ***`);
        logger.info('[Connection] Insira em: Configurações → Dispositivos vinculados → Vincular dispositivo → Código');

        // Notifica o ConnectionManager para expor o código via API
        onPairingCode?.(code);
      } catch (err) {
        logger.error({ err }, '[Connection] Erro ao solicitar Pairing Code');
        // Bloqueia nova tentativa neste socket — o callback fecha o socket e
        // o ConnectionManager transita para ERROR, encerrando este ciclo de vida.
        pairingCodeRequested = true;
        onPairingCodeError?.(err);
      }
    }

    // ---------------------------------------------------------------
    // Conexão encerrada — notifica o ConnectionManager para decidir
    // se deve reconectar ou não (separação de responsabilidades)
    // ---------------------------------------------------------------

    if (connection === 'close') {
      /**
       * O Baileys encapsula o motivo do encerramento em um Boom (@hapi/boom).
       * DisconnectReason.loggedOut === 401: sessão revogada pelo usuário no celular.
       * Todos os outros códigos são recuperáveis via reconexão.
       */
      const statusCode    = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      logger.warn(
        { statusCode, shouldReconnect },
        '[Connection] Conexão encerrada',
      );

      onDisconnected?.(shouldReconnect);
    }

    // ---------------------------------------------------------------
    // Conexão estabelecida
    // ---------------------------------------------------------------

    if (connection === 'open') {
      logger.info('[Connection] Conectado ao WhatsApp com sucesso');
      onConnected?.();
    }
  });

  logger.info('[Connection] Socket WhatsApp criado — aguardando conexão');

  return sock;
}

export default connectToWhatsApp;
