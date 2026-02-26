/**
 * Arquivo: src/server/routes/health.js
 * Descrição: Rota GET /health para verificação básica de disponibilidade da aplicação.
 *            Retorna status, timestamp e uptime do processo.
 *            Não expõe informações sensíveis nem o estado da sessão WhatsApp.
 * Feature: feat-007 - Implementar rota GET /health
 * Criado em: 2026-02-25
 */

import { Router } from 'express';
import logger from '../../utils/logger.js';

const router = Router();

/**
 * GET /health
 *
 * Endpoint de health check da aplicação.
 * Utilizado por monitores de disponibilidade, load balancers e scripts de deploy
 * para verificar se o processo está ativo e respondendo.
 *
 * Retorna exclusivamente informações não sensíveis do processo Node.js:
 * - status:    string fixa 'ok' — indica que o processo está respondendo
 * - timestamp: data/hora UTC no formato ISO 8601 — referência temporal da resposta
 * - uptime:    segundos desde o início do processo — útil para detectar reinícios recentes
 *
 * @returns {200} { status: 'ok', timestamp: string, uptime: number }
 */
router.get('/health', (req, res) => {
  logger.debug('[Health] GET /health chamado');

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;
