/**
 * Arquivo: src/server/index.js
 * Descrição: Configuração e inicialização do servidor HTTP Express.
 *            Aplica middlewares globais, registra rotas, serve o build estático
 *            do React e exporta startServer().
 * Feature: feat-006 - Criar e configurar app Express
 * Atualizado em: feat-007 - Implementar rota GET /health
 * Atualizado em: feat-008 - Configurar middleware de arquivos estáticos do frontend
 * Criado em: 2026-02-25
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import logger from '../utils/logger.js';
import healthRouter from './routes/health.js';

/**
 * Resolve o caminho absoluto para frontend/dist/ a partir deste arquivo.
 * Necessário em ESM: __dirname não existe, então usamos import.meta.url.
 * Estrutura: src/server/index.js → ../../frontend/dist
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const FRONTEND_DIST = join(__dirname, '..', '..', 'frontend', 'dist');

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
 * Registrada antes do static para garantir prioridade sobre os assets.
 */
app.use(healthRouter);

// -----------------------------------------------------------------
// Arquivos estáticos do frontend (React build)
// -----------------------------------------------------------------

/**
 * Serve os assets gerados pelo build do Vite (JS, CSS, imagens, fontes).
 * Requisições para /assets/*, /*.js, /*.css, etc. são atendidas diretamente.
 * maxAge 1 dia — os assets do Vite têm hash no nome, então cache longo é seguro.
 */
app.use(express.static(FRONTEND_DIST, { maxAge: '1d' }));

/**
 * Catch-all: qualquer rota não reconhecida retorna o index.html do React.
 * Necessário para que o React Router (client-side routing) funcione corretamente
 * ao acessar rotas como /sobre, /contato, etc. diretamente pelo browser.
 *
 * Deve ser registrado APÓS todos os outros middlewares e rotas de API.
 */
app.get('/{*path}', (req, res) => {
  res.sendFile(join(FRONTEND_DIST, 'index.html'), (err) => {
    if (err) {
      logger.warn({ err, url: req.url }, '[HTTP] index.html não encontrado — frontend não foi buildado?');
      res.status(404).json({
        error: 'Frontend não disponível. Execute npm run build:frontend.',
      });
    }
  });
});

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
