/**
 * Arquivo: ecosystem.config.cjs
 * Descrição: Configuração do PM2 para gerenciamento do processo em ambiente de produção
 * Feature: feat-023 - Configurar PM2 com ecosystem.config.cjs
 * Criado em: 2026-02-26
 */

module.exports = {
  apps: [{
    name:         'whatsapp-app',
    script:       './src/index.js',
    interpreter:  'node',
    env: {
      NODE_ENV:       'production',
      GCP_PROJECT_ID: 'natural-tecnologia',
      SECRET_NAME:    'whatsapp-baileys-auth',
      PHONE_NUMBER:   '5571993416896',
      PORT:           '80',
      LOG_LEVEL:      'info',
    },
    max_memory_restart: '512M',
    restart_delay:      5000,
    max_restarts:       10,
    log_date_format:    'YYYY-MM-DD HH:mm:ss',
    error_file:         '/var/log/pm2/whatsapp-error.log',
    out_file:           '/var/log/pm2/whatsapp-out.log',
  }]
};
