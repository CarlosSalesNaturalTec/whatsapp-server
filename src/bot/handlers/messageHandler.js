/**
 * Arquivo: src/bot/handlers/messageHandler.js
 * Descrição: Handler de mensagens recebidas via WhatsApp.
 *            Registra o listener messages.upsert no socket Baileys,
 *            filtra mensagens relevantes e orquestra o processamento.
 *
 * Responsabilidades:
 * - Registrar o listener messages.upsert no socket (registerMessageHandler)
 * - Filtrar apenas mensagens novas (type === 'notify')
 * - Ignorar mensagens enviadas pela própria conta (msg.key.fromMe)
 * - Extrair o corpo de texto das mensagens recebidas
 * - Detectar e responder ao comando #iniciarBot#
 * - Registrar (log) mensagens e resultados de envio
 *
 * Features implementadas neste arquivo:
 * - feat-017: Implementar handler messages.upsert
 * - feat-018: Implementar extração do corpo do texto da mensagem
 *
 * Criado em: 2026-02-26
 */

import logger from '../../utils/logger.js';

// -----------------------------------------------------------------
// Utilitários de parsing de mensagem
// -----------------------------------------------------------------

/**
 * Extrai o corpo de texto de uma mensagem WhatsApp recebida.
 *
 * O Baileys representa o conteúdo de uma mensagem em campos distintos
 * dependendo do tipo de envio:
 *
 * - `msg.message.conversation`: mensagem de texto simples enviada diretamente,
 *   sem formatação especial, sem reply e sem contexto adicional.
 *
 * - `msg.message.extendedTextMessage.text`: mensagem de texto com formatação
 *   (negrito, itálico, tachado), mensagem enviada como reply a outra mensagem,
 *   ou mensagem com link preview. O Baileys usa este campo quando há qualquer
 *   metadado adicional além do texto puro.
 *
 * Se nenhum dos campos estiver presente (mídia, sticker, localização, etc.),
 * retorna string vazia — o caller decide como tratar mensagens sem texto.
 *
 * @param {object} msg - Objeto de mensagem do evento messages.upsert
 * @returns {string} Corpo de texto da mensagem, ou string vazia se não for mensagem de texto
 *
 * @example
 * const body = extractMessageBody(msg);
 * if (body === '') return; // descarta mensagens sem texto
 */
function extractMessageBody(msg) {
  return (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    ''
  );
}

/**
 * Registra o listener de mensagens recebidas no socket WhatsApp.
 *
 * Deve ser chamado imediatamente após a criação do socket em src/index.js,
 * passando o mesmo sock retornado por connectToWhatsApp().
 *
 * Fluxo de processamento de cada mensagem:
 * 1. Descarta eventos que não sejam novas mensagens (type !== 'notify')
 * 2. Itera sobre o array de mensagens do evento
 * 3. Descarta mensagens enviadas pela própria conta (fromMe)
 * 4. Processa cada mensagem de terceiros recebida
 *
 * @param {import('baileys').WASocket} sock - Socket Baileys ativo retornado por connectToWhatsApp()
 * @returns {void}
 *
 * @example
 * // src/index.js
 * import connectToWhatsApp from './bot/connection.js';
 * import { registerMessageHandler } from './bot/handlers/messageHandler.js';
 *
 * const sock = await connectToWhatsApp();
 * registerMessageHandler(sock);
 */
export function registerMessageHandler(sock) {
  /**
   * Listener do evento messages.upsert.
   *
   * O evento é emitido pelo Baileys em dois cenários distintos:
   * - type 'notify': nova mensagem recebida em tempo real — deve ser processada
   * - type 'append': mensagem adicionada ao histórico durante sincronização — ignorar
   *
   * O callback é assíncrono para suportar operações I/O como envio de respostas
   * e logging que possam precisar de await no futuro.
   *
   * @param {object}   payload          - Payload do evento
   * @param {object[]} payload.messages - Array de mensagens do evento (geralmente 1 item em 'notify')
   * @param {string}   payload.type     - Tipo do evento: 'notify' | 'append'
   */
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    // Ignora eventos de sincronização de histórico ('append').
    // Processar mensagens de histórico causaria respostas duplicadas a
    // mensagens antigas já respondidas em sessões anteriores.
    if (type !== 'notify') return;

    for (const msg of messages) {
      // Ignora mensagens enviadas pela própria conta conectada.
      // O Baileys também emite 'messages.upsert' para mensagens enviadas
      // por outros dispositivos da mesma conta (multi-device), e para
      // confirmações de entrega das mensagens que o próprio bot enviou.
      if (msg.key.fromMe) continue;

      /**
       * JID (WhatsApp ID) do remetente ou grupo de origem.
       * - Chat individual: '5511999999999@s.whatsapp.net'
       * - Grupo:           'GROUPID@g.us'
       */
      const jid = msg.key.remoteJid;

      /**
       * Corpo de texto extraído da mensagem.
       * String vazia se a mensagem for de outro tipo (mídia, sticker, etc.).
       * A extração suporta mensagens simples e mensagens com reply/formatação.
       */
      const body = extractMessageBody(msg);

      logger.debug({ jid, bodyLength: body.length }, '[MessageHandler] Mensagem recebida — corpo extraído');
    }
  });

  logger.info('[MessageHandler] Listener messages.upsert registrado');
}
