/**
 * Arquivo: src/server/index.js
 * Descrição: Configuração e inicialização do servidor HTTP Express.
 *            Aplica middlewares globais, registra rotas e exporta startServer().
 *            O middleware de arquivos estáticos é registrado em feat-008.
 * Feature: feat-006 - Criar e configurar app Express
 * Atualizado em: feat-007 - Implementar rota GET /health
 * Criado em: 2026-02-25
 */

import express from 'express';
import logger from '../utils/logger.js';
import healthRouter from './routes/health.js';

const app = express();

// -----------------------------------------------------------------
// Middlewares globais
// -----------------------------------------------------------------

/**
 * Habilita parsing de corpo JSON em requisições POST/PUT/PATCH.
 * Limit padrão: 100kb — suficiente para os endpoints atuais.
 */
app.use(express.json());

/**
 * Habilita parsing de corpo application/x-www-form-urlencoded.
 * extended: false — usa a biblioteca nativa querystring (sem dependências extras).
 */
app.use(express.urlencoded({ extended: false }));

// -----------------------------------------------------------------
// Rotas
// -----------------------------------------------------------------

/**
 * Rota de health check — GET /health
 * Retorna status do processo sem expor informações da sessão WhatsApp.
 */
app.use(healthRouter);

// -----------------------------------------------------------------
// Função de inicialização
// -----------------------------------------------------------------

/**
 * Inicia o servidor HTTP na porta especificada.
 * Se nenhuma porta for passada, lê process.env.PORT ou usa 3000 como fallback.
 *
 * @param {number|string} [port] - Porta em que o servidor irá escutar
 * @returns {Promise<import('http').Server>} Instância do servidor HTTP ativo
 * @throws {Error} Se o servidor falhar ao iniciar (ex: porta já em uso)
 *
 * @example
 * const server = await startServer();
 * // Servidor escutando na porta definida em PORT ou 3000
 */
function startServer(port) {
  const resolvedPort = port || process.env.PORT || 3000;

  return new Promise((resolve, reject) => {
    const server = app.listen(resolvedPort, () => {
      logger.info({ port: resolvedPort }, '[HTTP] Servidor Express iniciado');
      console.log(`[HTTP] Servidor rodando em http://localhost:${resolvedPort}`);
      resolve(server);
    });

    server.on('error', (error) => {
      logger.error({ err: error, port: resolvedPort }, '[HTTP] Falha ao iniciar o servidor');
      reject(error);
    });
  });
}

export { app, startServer };
