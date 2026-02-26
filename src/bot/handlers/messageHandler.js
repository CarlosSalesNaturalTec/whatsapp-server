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
 * - feat-019: Implementar detecção do comando #iniciarBot#
 * - feat-020: Implementar envio da resposta 'Bot Iniciado'
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
 * Verifica se o corpo de uma mensagem corresponde exatamente a um comando.
 *
 * A comparação é:
 * - **Exata**: o corpo inteiro deve ser igual ao comando, sem conteúdo extra
 * - **Case-sensitive**: '#iniciarBot#' ≠ '#iniciArBot#'
 * - **Sem trim**: espaços à esquerda/direita tornam a comparação falsa
 *
 * Estes critérios são intencionais — o usuário deve digitar o comando
 * precisamente para acioná-lo, evitando falsos positivos em mensagens
 * que contenham o texto do comando como parte de uma frase maior.
 *
 * A assinatura genérica (body, command) facilita a adição de novos
 * comandos sem duplicar a lógica de comparação.
 *
 * @param {string} body    - Corpo de texto extraído da mensagem
 * @param {string} command - Comando exato a comparar (ex: '#iniciarBot#')
 * @returns {boolean} true se body === command, false caso contrário
 *
 * @example
 * isCommand('#iniciarBot#', '#iniciarBot#') // true
 * isCommand(' #iniciarBot#', '#iniciarBot#') // false — espaço à esquerda
 * isCommand('#INICIARBOT#', '#iniciarBot#') // false — case diferente
 * isCommand('texto #iniciarBot# aqui', '#iniciarBot#') // false — comando embutido
 */
function isCommand(body, command) {
  return body === command;
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

      // ---------------------------------------------------------------
      // Detecção e resposta ao comando #iniciarBot# — feat-019 / feat-020
      // ---------------------------------------------------------------

      if (isCommand(body, '#iniciarBot#')) {
        logger.debug({ jid }, '[MessageHandler] Comando #iniciarBot# detectado');

        /**
         * Envia a resposta fixa 'Bot Iniciado' para o mesmo chat (jid) onde
         * o comando foi recebido, seja ele um chat individual ou um grupo.
         *
         * O try/catch é essencial aqui: falhas no envio são comuns em cenários
         * de rede instável, rate limiting do WhatsApp ou jid inválido.
         * Erros não tratados interromperiam o loop e ignorariam mensagens
         * subsequentes no mesmo evento messages.upsert.
         */
        try {
          await sock.sendMessage(jid, { text: 'Bot Iniciado' });
          logger.info({ jid }, '[MessageHandler] Resposta "Bot Iniciado" enviada com sucesso');
        } catch (err) {
          logger.error({ err, jid }, '[MessageHandler] Erro ao enviar resposta "Bot Iniciado"');
        }
      }
    }
  });

  logger.info('[MessageHandler] Listener messages.upsert registrado');
}
