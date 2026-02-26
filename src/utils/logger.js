/**
 * Arquivo: src/utils/logger.js
 * Descrição: Módulo centralizado de logging da aplicação.
 *            Exporta uma única instância pino configurada via variável de ambiente.
 *            Deve ser importado por todos os demais módulos que precisam logar.
 * Feature: feat-005 - Implementar módulo de logger (pino)
 * Criado em: 2026-02-25
 */

import P from 'pino';

/**
 * Níveis de log aceitos pelo pino, do mais ao menos verboso.
 * Qualquer valor fora deste conjunto será substituído pelo padrão 'warn'.
 */
const VALID_LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

/**
 * Retorna o nível de log configurado via variável de ambiente LOG_LEVEL.
 * Se o valor for inválido ou ausente, retorna o padrão 'warn'.
 *
 * @returns {string} Nível de log validado
 */
function resolveLogLevel() {
  const level = process.env.LOG_LEVEL;
  if (level && VALID_LOG_LEVELS.includes(level)) {
    return level;
  }
  return 'warn';
}

/**
 * Instância única do logger pino para toda a aplicação.
 *
 * Configuração:
 * - level: controlado por LOG_LEVEL (padrão: 'warn' — reduz verbosidade em produção)
 *
 * Uso recomendado:
 * - Produção:    LOG_LEVEL=warn  (apenas avisos e erros)
 * - Desenvolvimento: LOG_LEVEL=debug (todos os eventos, incluindo os do Baileys)
 *
 * @example
 * import logger from './utils/logger.js';
 * logger.info('Servidor iniciado na porta 3000');
 * logger.warn({ secretName }, 'Secret não encontrado, inicializando novo auth state');
 * logger.error({ err }, 'Falha crítica ao conectar ao WhatsApp');
 */
const logger = P({ level: resolveLogLevel() });

export default logger;
