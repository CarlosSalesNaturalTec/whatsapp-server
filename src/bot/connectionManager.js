/**
 * Arquivo: src/bot/connectionManager.js
 * Descrição: Singleton que gerencia o ciclo de vida da conexão WhatsApp.
 *            Desacopla o boot da aplicação da inicialização do bot — o PM2 sobe
 *            apenas o servidor HTTP; a conexão WhatsApp é acionada sob demanda
 *            pela página de configurações via POST /api/whatsapp/connect.
 *
 * Estados possíveis:
 *   disconnected     — nenhuma conexão ativa
 *   connecting       — socket criado, aguardando resposta do servidor WhatsApp
 *   awaiting_pairing — pairing code gerado, aguardando o usuário inserir no celular
 *   connected        — sessão autenticada e ativa
 *   error            — falha crítica (ex: GCP_PROJECT_ID ausente, Secret Manager inacessível)
 *
 * Criado em: 2026-03-03
 */

import { BufferJSON } from 'baileys';
import logger from '../utils/logger.js';
import connectToWhatsApp from './connection.js';
import { registerMessageHandler } from './handlers/messageHandler.js';
import { getSecretValue } from './auth/secretManagerAuthState.js';

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID;
const SECRET_NAME    = process.env.SECRET_NAME || 'whatsapp-baileys-auth';

// -----------------------------------------------------------------
// Constantes de status
// -----------------------------------------------------------------

export const STATUS = Object.freeze({
  DISCONNECTED:     'disconnected',
  CONNECTING:       'connecting',
  AWAITING_PAIRING: 'awaiting_pairing',
  CONNECTED:        'connected',
  ERROR:            'error',
});

// -----------------------------------------------------------------
// Classe ConnectionManager
// -----------------------------------------------------------------

class ConnectionManager {
  constructor() {
    /** @type {string} Status atual da conexão */
    this._status = STATUS.DISCONNECTED;

    /** @type {string|null} Pairing code disponível durante AWAITING_PAIRING */
    this._pairingCode = null;

    /** @type {import('baileys').WASocket|null} Socket Baileys ativo */
    this._sock = null;

    /**
     * Número de telefone da última chamada a connect().
     * Necessário para reconexão automática após queda de sinal —
     * o usuário não precisa estar na UI para o reconect acontecer.
     * @type {string|null}
     */
    this._phoneNumber = null;

    /**
     * Flag que diferencia um disconnect() intencional (chamado pela API)
     * de uma queda de conexão — evita que o onDisconnected tente reconectar
     * após o usuário clicar em "Desconectar".
     * @type {boolean}
     */
    this._intentionalDisconnect = false;
  }

  // ---------------------------------------------------------------
  // Consulta de estado
  // ---------------------------------------------------------------

  /**
   * Retorna o status atual e o pairing code (se disponível).
   *
   * Consumido pelo endpoint GET /api/whatsapp/status a cada poll do frontend.
   *
   * @returns {{ status: string, pairingCode: string|null }}
   */
  getStatus() {
    return {
      status:      this._status,
      pairingCode: this._pairingCode,
    };
  }

  /**
   * Retorna o socket Baileys ativo, ou null se não conectado.
   * Utilizado pelo registerMessageHandler após a conexão ser estabelecida.
   *
   * @returns {import('baileys').WASocket|null}
   */
  getSock() {
    return this._sock;
  }

  // ---------------------------------------------------------------
  // Auto-conexão no boot (sessão prévia)
  // ---------------------------------------------------------------

  /**
   * Verifica se há uma sessão WhatsApp registrada no Secret Manager e,
   * em caso positivo, conecta automaticamente sem exigir ação do usuário.
   *
   * Chamado por src/index.js imediatamente após o servidor HTTP subir.
   *
   * Condição para auto-connect:
   *   secret existe  AND  creds.registered === true
   *
   * Se não houver sessão (primeira vez) ou a sessão estiver incompleta,
   * o método retorna silenciosamente e o status permanece 'disconnected'.
   * Erros de infraestrutura (Secret Manager inacessível, GCP_PROJECT_ID
   * ausente) também são absorvidos — o usuário conecta manualmente pela UI.
   *
   * @returns {Promise<void>}
   */
  async tryAutoConnect() {
    if (!GCP_PROJECT_ID) {
      logger.warn('[Manager] GCP_PROJECT_ID não definido — auto-connect ignorado');
      return;
    }

    let raw;
    try {
      raw = await getSecretValue(SECRET_NAME, GCP_PROJECT_ID);
    } catch (err) {
      logger.warn({ err }, '[Manager] Erro ao verificar sessão no Secret Manager — auto-connect ignorado');
      return;
    }

    if (!raw) {
      logger.info('[Manager] Nenhuma sessão salva — aguardando conexão manual pelo usuário');
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw, BufferJSON.reviver);
    } catch (err) {
      logger.warn({ err }, '[Manager] Sessão salva com formato inválido — auto-connect ignorado');
      return;
    }

    if (!parsed?.creds?.registered) {
      logger.info('[Manager] Sessão encontrada mas não registrada — aguardando Pairing Code pelo usuário');
      return;
    }

    logger.info('[Manager] Sessão registrada encontrada — conectando automaticamente...');

    // phoneNumber não é necessário quando creds.registered === true:
    // o Baileys reutiliza a sessão salva sem solicitar Pairing Code.
    // Se a sessão for invalidada durante a reconexão (loggedOut),
    // o status volta a 'disconnected' e o usuário conecta via UI.
    this.connect(null).catch((err) => {
      logger.error({ err }, '[Manager] Falha no auto-connect — aguardando ação do usuário');
    });
  }

  // ---------------------------------------------------------------
  // Conexão sob demanda
  // ---------------------------------------------------------------

  /**
   * Inicia a conexão WhatsApp sob demanda.
   *
   * Comportamento:
   * - Se já houver sessão válida no Secret Manager (creds.registered === true),
   *   reconecta silenciosamente sem solicitar pairing code.
   * - Se não houver sessão, solicita pairing code para o número informado
   *   e transita para o estado AWAITING_PAIRING até o usuário vinculá-lo.
   *
   * Chamadas duplicadas (quando status é CONNECTING, AWAITING_PAIRING ou CONNECTED)
   * são ignoradas com aviso em log.
   *
   * @param {string} phoneNumber - Número E.164 sem '+' (ex: '5511999999999').
   *                               Necessário se não houver sessão; utilizado
   *                               também como referência para reconexão automática.
   * @returns {Promise<void>}
   * @throws {Error} Se connectToWhatsApp() falhar de forma irrecuperável
   */
  async connect(phoneNumber) {
    if (
      this._status === STATUS.CONNECTING ||
      this._status === STATUS.AWAITING_PAIRING ||
      this._status === STATUS.CONNECTED
    ) {
      logger.warn({ status: this._status }, '[Manager] Conexão já em andamento — chamada ignorada');
      return;
    }

    this._phoneNumber         = phoneNumber;
    this._pairingCode         = null;
    this._intentionalDisconnect = false;
    this._setStatus(STATUS.CONNECTING);

    try {
      this._sock = await connectToWhatsApp({
        phoneNumber,

        /**
         * Chamado por connection.js quando requestPairingCode() retorna o código.
         * Atualiza o estado e torna o código disponível via getStatus().
         *
         * @param {string} code - Código no formato 'XXXX-XXXX'
         */
        onPairingCode: (code) => {
          this._pairingCode = code;
          this._setStatus(STATUS.AWAITING_PAIRING);
          logger.info({ code }, '[Manager] Pairing Code disponível para o usuário');
        },

        /**
         * Chamado por connection.js quando connection.update === 'open'.
         * Limpa o pairing code (não mais necessário) e registra o handler
         * de mensagens no socket recém-autenticado.
         */
        onConnected: () => {
          this._pairingCode = null;
          this._setStatus(STATUS.CONNECTED);
          registerMessageHandler(this._sock);
          logger.info('[Manager] WhatsApp conectado — handler de mensagens registrado');
        },

        /**
         * Chamado por connection.js quando connection.update === 'close'.
         *
         * Se shouldReconnect === true e o disconnect não foi intencional,
         * agenda reconexão automática após 5s — comportamento idêntico ao
         * que existia antes da refatoração.
         *
         * Se shouldReconnect === false (loggedOut / 401), a sessão foi revogada
         * pelo usuário no celular — exige nova autenticação via UI.
         *
         * @param {boolean} shouldReconnect
         */
        onDisconnected: (shouldReconnect) => {
          this._sock = null;

          if (!this._intentionalDisconnect && shouldReconnect) {
            logger.warn('[Manager] Conexão perdida — reconectando em 5s...');
            this._setStatus(STATUS.DISCONNECTED); // permite que connect() passe pelo guard
            setTimeout(
              () => this.connect(this._phoneNumber).catch((err) => {
                logger.error({ err }, '[Manager] Erro ao reconectar');
              }),
              5_000,
            );
          } else {
            if (this._intentionalDisconnect) {
              logger.info('[Manager] Disconnect intencional confirmado');
            } else {
              logger.warn('[Manager] Sessão encerrada (loggedOut) — aguardando ação do usuário');
            }
            this._setStatus(STATUS.DISCONNECTED);
          }

          this._intentionalDisconnect = false;
        },
      });
    } catch (err) {
      this._sock = null;
      this._setStatus(STATUS.ERROR);
      logger.error({ err }, '[Manager] Falha crítica ao conectar — status: error');
      throw err;
    }
  }

  // ---------------------------------------------------------------
  // Desconexão manual
  // ---------------------------------------------------------------

  /**
   * Encerra a conexão WebSocket com o WhatsApp de forma intencional.
   *
   * Define a flag _intentionalDisconnect = true ANTES de chamar sock.end(),
   * para que o callback onDisconnected saiba que não deve tentar reconectar.
   * O status já é atualizado para DISCONNECTED aqui, mesmo antes do evento
   * 'close' chegar do Baileys.
   */
  disconnect() {
    this._intentionalDisconnect = true;
    this._pairingCode           = null;

    const sock    = this._sock;
    this._sock    = null;
    this._setStatus(STATUS.DISCONNECTED);

    if (sock) {
      try {
        sock.end();
      } catch (err) {
        logger.warn({ err }, '[Manager] Erro ao fechar socket — ignorado');
      }
    }

    logger.info('[Manager] Desconectado manualmente');
  }

  // ---------------------------------------------------------------
  // Utilitário interno
  // ---------------------------------------------------------------

  /**
   * Atualiza o status e emite log estruturado.
   * Ponto único de mutação do _status — facilita rastreabilidade.
   *
   * @param {string} status - Um dos valores de STATUS
   */
  _setStatus(status) {
    this._status = status;
    logger.info({ status }, '[Manager] Status da conexão atualizado');
  }
}

// -----------------------------------------------------------------
// Exportação do singleton
// -----------------------------------------------------------------

/**
 * Instância única do ConnectionManager compartilhada por toda a aplicação.
 * Importada pelas rotas Express e pelo futuro sistema de autenticação.
 */
export const connectionManager = new ConnectionManager();
