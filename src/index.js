/**
 * Arquivo: src/index.js
 * Descrição: Entry point da aplicação WhatsApp Server.
 *            Inicializa exclusivamente o servidor HTTP Express no boot do PM2.
 *            A conexão WhatsApp é acionada sob demanda via página de configurações
 *            (POST /api/whatsapp/connect), não automaticamente ao iniciar.
 *
 * Responsabilidades:
 * - Inicializar o servidor Express (Landing Page + /health + /api/whatsapp/*)
 * - Tratar erros críticos de boot com process.exit(1)
 *
 * Nota de arquitetura:
 *   O bot WhatsApp agora é gerenciado pelo ConnectionManager
 *   (src/bot/connectionManager.js), que expõe connect() / disconnect() / getStatus()
 *   consumidos pelas rotas em src/server/routes/whatsapp.js.
 *   Não há mais acoplamento entre o boot da aplicação e a inicialização do bot.
 *
 * Criado em: 2026-02-26
 * Refatorado em: 2026-03-03 — conexão WhatsApp removida do boot (on-demand)
 */

import logger from './utils/logger.js';
import { startServer } from './server/index.js';
import { connectionManager } from './bot/connectionManager.js';

/**
 * Função principal de inicialização da aplicação.
 *
 * Inicia apenas o servidor HTTP — disponibiliza imediatamente:
 *   GET  /             → Landing Page (React)
 *   GET  /health       → health check
 *   GET  /api/whatsapp/status     → status da conexão WhatsApp
 *   GET  /api/whatsapp/config     → configuração pré-definida
 *   POST /api/whatsapp/connect    → inicia conexão sob demanda
 *   POST /api/whatsapp/disconnect → encerra conexão ativa
 *
 * A conexão WhatsApp permanece como DISCONNECTED até que o usuário
 * acesse a página de configurações e clique em "Solicitar Pairing Code".
 *
 * @returns {Promise<void>}
 * @throws {Error} Se o servidor HTTP falhar ao iniciar (ex: porta já em uso)
 */
async function main() {
  logger.info('[App] Iniciando aplicação WhatsApp Server...');

  // Inicia o servidor HTTP — Landing Page e API disponíveis imediatamente
  await startServer();

  // Verifica se há sessão WhatsApp registrada no Secret Manager.
  // Se sim, reconecta automaticamente (sem exigir ação do usuário).
  // Se não (primeira vez), permanece desconectado até o usuário acessar
  // a página de configurações e solicitar o Pairing Code.
  connectionManager.tryAutoConnect();

  logger.info('[App] Servidor HTTP ativo — verificando sessão WhatsApp prévia...');
}

/**
 * Inicializa a aplicação e trata erros críticos de boot.
 *
 * Erros não recuperáveis durante a inicialização (ex: porta HTTP já em uso)
 * são logados em nível 'error' e o processo é encerrado com código de saída 1.
 * O PM2 reinicia automaticamente respeitando restart_delay e max_restarts.
 */
main().catch((err) => {
  logger.error({ err }, '[App] Falha crítica na inicialização — encerrando processo');
  process.exit(1);
});
