/**
 * Arquivo: src/index.js
 * Descrição: Entry point da aplicação WhatsApp Server.
 *            Orquestra a inicialização do servidor HTTP Express e do bot WhatsApp
 *            em sequência, conectando todos os módulos da aplicação.
 *
 * Responsabilidades:
 * - Inicializar o servidor Express (Landing Page + health check)
 * - Inicializar a conexão WhatsApp via Baileys (sessão ou Pairing Code)
 * - Registrar o handler de mensagens no socket ativo
 * - Tratar erros críticos de boot com process.exit(1)
 *
 * Feature: feat-022 - Criar entry point src/index.js
 * Criado em: 2026-02-26
 */

import logger from './utils/logger.js';
import { startServer } from './server/index.js';
import connectToWhatsApp from './bot/connection.js';
import { registerMessageHandler } from './bot/handlers/messageHandler.js';

/**
 * Função principal de inicialização da aplicação.
 *
 * Orquestra o boot dos dois subsistemas em sequência definida:
 *
 * 1. **Servidor Express** — iniciado primeiro para que o endpoint GET /health
 *    e a Landing Page fiquem disponíveis imediatamente, independente do estado
 *    da conexão WhatsApp. Permite que load balancers e monitores de uptime
 *    verifiquem a saúde da aplicação enquanto o bot ainda está conectando.
 *
 * 2. **Bot WhatsApp** — carrega a sessão do Google Secret Manager (ou inicializa
 *    credenciais em branco se for a primeira execução) e abre o WebSocket com
 *    o servidor WhatsApp Web. O socket retornado já tem os listeners
 *    creds.update, groups.update e connection.update registrados.
 *    A conexão se completa de forma assíncrona via eventos — connectToWhatsApp()
 *    retorna assim que o socket é criado, sem aguardar o 'open'.
 *
 * 3. **Handler de mensagens** — registra o listener messages.upsert no socket,
 *    ativando o processamento de comandos recebidos (ex: #iniciarBot#).
 *
 * @returns {Promise<void>}
 * @throws {Error} Se qualquer etapa de inicialização falhar de forma irrecuperável
 */
async function main() {
  logger.info('[App] Iniciando aplicação WhatsApp Server...');

  // (1) Inicia o servidor HTTP — disponibiliza /health e Landing Page imediatamente
  await startServer();

  // (2) Conecta ao WhatsApp — carrega sessão ou aguarda Pairing Code via log
  const sock = await connectToWhatsApp();

  // (3) Registra o listener de mensagens no socket ativo
  registerMessageHandler(sock);

  logger.info('[App] Inicialização concluída — servidor HTTP ativo e bot WhatsApp conectando');
}

/**
 * Inicializa a aplicação e trata erros críticos de boot.
 *
 * Erros não recuperáveis durante a inicialização — como Secret Manager
 * inacessível, porta HTTP já em uso ou GCP_PROJECT_ID ausente — são logados
 * em nível 'error' e o processo é encerrado com código de saída 1.
 *
 * O código de saída 1 sinaliza falha ao PM2, que reinicia automaticamente
 * o processo respeitando restart_delay (5s) e max_restarts (10) configurados
 * no ecosystem.config.cjs, evitando loops de reinício em falhas persistentes.
 */
main().catch((err) => {
  logger.error({ err }, '[App] Falha crítica na inicialização — encerrando processo');
  process.exit(1);
});
