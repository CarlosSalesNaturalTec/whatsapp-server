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
 * - feat-014: Implementar autenticação por Pairing Code
 * - feat-015: Implementar handler de reconexão automática
 * - feat-016: Persistir credenciais no evento creds.update
 *
 * Criado em: 2026-02-26
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
const SECRET_NAME = process.env.SECRET_NAME || 'whatsapp-baileys-session';

/**
 * Número de telefone da conta WhatsApp no formato E.164 sem o sinal de '+'.
 * Exemplo: '5511999999999' para +55 (11) 99999-9999.
 * Utilizado exclusivamente para solicitar o Pairing Code na primeira autenticação.
 */
const PHONE_NUMBER = process.env.PHONE_NUMBER;

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
 * 4. Registra handler connection.update para autenticação via Pairing Code (sem QR)
 * 5. Retorna o socket para registro de event listeners adicionais (feats 015, 016)
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

  // ---------------------------------------------------------------
  // Listener: creds.update — feat-016
  // ---------------------------------------------------------------

  /**
   * Persiste as credenciais no Secret Manager sempre que o Baileys as atualiza.
   *
   * CRÍTICO: Este listener não pode ser omitido.
   * O Baileys atualiza as credenciais de sessão (chaves de registro, identidade,
   * pre-keys, etc.) de forma assíncrona durante o ciclo de vida da conexão.
   * Se qualquer atualização for perdida — por ausência deste listener ou por
   * falha silenciosa — o estado local diverge do servidor WhatsApp, tornando
   * a sessão inválida na próxima reconexão e exigindo novo Pairing Code.
   *
   * A função `saveCreds` já incorpora tratamento de erros e chama o Secret
   * Manager de forma segura (ver useSecretManagerAuthState em feat-011).
   */
  sock.ev.on('creds.update', saveCreds);

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

  // ---------------------------------------------------------------
  // Handler: connection.update — Pairing Code (feat-014)
  // ---------------------------------------------------------------

  /**
   * Flag de controle para garantir que o Pairing Code seja solicitado
   * apenas uma vez por ciclo de vida do socket.
   *
   * O evento connection.update pode disparar múltiplas vezes enquanto o
   * WebSocket negocia a conexão com o servidor WhatsApp. Sem esta flag,
   * requestPairingCode() seria chamado repetidamente, causando erros de
   * "already requested" ou expiração prematura do código.
   */
  let pairingCodeRequested = false;

  /**
   * Solicita o Pairing Code para autenticação headless (sem QR Code).
   *
   * Condições para solicitar:
   * 1. A conexão está em estado 'connecting' OU o servidor enviou um QR
   *    (ambos indicam que não há sessão ativa sendo negociada)
   * 2. As credenciais ainda não estão registradas (!creds.registered)
   *    — protege contra solicitações desnecessárias em reconexões com
   *    sessão válida
   * 3. O código ainda não foi solicitado neste ciclo (!pairingCodeRequested)
   *
   * Após a geração, o código de 8 dígitos é exibido no log com nível 'info'
   * para que o administrador possa vinculá-lo manualmente no WhatsApp:
   *   Configurações → Dispositivos conectados → Conectar dispositivo → Código
   *
   * Em caso de erro na solicitação, a flag é redefinida para permitir
   * nova tentativa no próximo evento de conexão.
   *
   * @param {object} update - Payload do evento connection.update
   * @param {string|undefined} update.connection - Estado atual: 'connecting' | 'open' | 'close'
   * @param {string|undefined} update.qr         - String do QR Code se enviado pelo servidor
   * @returns {Promise<void>}
   */
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // ---------------------------------------------------------------
    // Pairing Code — feat-014
    // Solicitado apenas quando não há sessão registrada e ainda não foi
    // pedido neste ciclo. Disparado em 'connecting' ou ao receber QR.
    // ---------------------------------------------------------------

    const shouldRequestPairing =
      (connection === 'connecting' || !!qr) &&
      !sock.authState.creds.registered &&
      !pairingCodeRequested;

    if (shouldRequestPairing) {
      if (!PHONE_NUMBER) {
        logger.error(
          '[Connection] Variável PHONE_NUMBER não definida — impossível solicitar Pairing Code. ' +
          'Configure PHONE_NUMBER no formato E.164 sem + (ex: 5511999999999).'
        );
        return;
      }

      pairingCodeRequested = true;
      logger.info({ phoneNumber: PHONE_NUMBER }, '[Connection] Solicitando Pairing Code...');

      try {
        const code = await sock.requestPairingCode(PHONE_NUMBER);

        // Exibe o código de forma destacada no log para facilitar leitura pelo administrador.
        // O código tem formato XXXX-XXXX e deve ser inserido em:
        // WhatsApp → Configurações → Dispositivos conectados → Conectar dispositivo → Código
        logger.info(`[Connection] *** PAIRING CODE: ${code} ***`);
        logger.info('[Connection] Insira o código acima em: Configurações → Dispositivos conectados → Conectar dispositivo → Código');
      } catch (err) {
        logger.error({ err }, '[Connection] Erro ao solicitar Pairing Code');
        // Redefine a flag para permitir nova tentativa no próximo evento de conexão
        pairingCodeRequested = false;
      }
    }

    // ---------------------------------------------------------------
    // Conexão encerrada — feat-015
    // Verifica o motivo e decide se deve ou não reconectar.
    // ---------------------------------------------------------------

    if (connection === 'close') {
      /**
       * O Baileys encapsula o erro de desconexão em um objeto Boom (@hapi/boom),
       * cujo statusCode HTTP representa o motivo do encerramento.
       * DisconnectReason.loggedOut === 401 indica que o usuário desconectou
       * o dispositivo manualmente no WhatsApp — não é seguro reconectar
       * automaticamente, pois a sessão foi revogada.
       */
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;

      if (isLoggedOut) {
        logger.warn(
          { statusCode },
          '[Connection] Sessão encerrada pelo WhatsApp (loggedOut / 401). ' +
          'Reconexão automática desabilitada. ' +
          'Para reconectar, reinicie o servidor e insira um novo Pairing Code.'
        );
      } else {
        logger.warn(
          { statusCode },
          '[Connection] Conexão encerrada inesperadamente — reconectando em 5s...'
        );
        /**
         * Aguarda 5 segundos antes de reconectar para evitar loop de reconexão
         * imediata em casos de instabilidade de rede ou throttling do WhatsApp.
         * O setTimeout não bloqueia o event loop — a aplicação permanece responsiva.
         */
        setTimeout(connectToWhatsApp, 5_000);
      }
    }

    // ---------------------------------------------------------------
    // Conexão estabelecida — feat-015
    // Confirmação de que o WebSocket está ativo e autenticado.
    // ---------------------------------------------------------------

    if (connection === 'open') {
      logger.info('[Connection] Conectado ao WhatsApp com sucesso!');
    }
  });

  logger.info('[Connection] Socket WhatsApp criado — aguardando conexão');

  return sock;
}

export default connectToWhatsApp;
