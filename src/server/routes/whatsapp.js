/**
 * Arquivo: src/server/routes/whatsapp.js
 * Descrição: Endpoints REST para gerenciar a conexão WhatsApp sob demanda.
 *            Consumidos pela página de configurações do frontend (React).
 *
 * Rotas:
 *   GET  /api/whatsapp/status     — status atual + pairing code (polling a cada 2s)
 *   GET  /api/whatsapp/config     — configuração pré-definida (phoneNumber da env)
 *   POST /api/whatsapp/connect    — inicia conexão / solicita pairing code
 *   POST /api/whatsapp/disconnect — encerra a conexão ativa
 *
 * Criado em: 2026-03-03
 */

import { Router } from 'express';
import { connectionManager, STATUS } from '../../bot/connectionManager.js';
import logger from '../../utils/logger.js';

const router = Router();

// -----------------------------------------------------------------
// GET /api/whatsapp/status
// -----------------------------------------------------------------

/**
 * Retorna o estado atual da conexão WhatsApp.
 *
 * Consumido pelo frontend a cada ~2s via polling para atualizar:
 * - O badge de status (DESCONECTADO / CONECTANDO / AGUARDANDO PAREAMENTO / CONECTADO)
 * - O pairing code exibido ao usuário (null quando não aplicável)
 *
 * @returns {200} { status: string, pairingCode: string|null }
 *
 * @example
 * // Antes de conectar
 * { "status": "disconnected", "pairingCode": null }
 *
 * // Aguardando o usuário inserir o código
 * { "status": "awaiting_pairing", "pairingCode": "ABCD-1234" }
 *
 * // Conectado com sucesso
 * { "status": "connected", "pairingCode": null }
 */
router.get('/api/whatsapp/status', (req, res) => {
  logger.debug('[Route] GET /api/whatsapp/status');
  res.json(connectionManager.getStatus());
});

// -----------------------------------------------------------------
// GET /api/whatsapp/config
// -----------------------------------------------------------------

/**
 * Retorna a configuração disponível no ambiente.
 *
 * Permite que o frontend pré-preencha o campo de número de telefone
 * com o valor de PHONE_NUMBER configurado na VM, evitando que o
 * administrador precise digitar o número a cada acesso.
 *
 * Se PHONE_NUMBER não estiver definido, retorna null — o usuário
 * digita manualmente.
 *
 * @returns {200} { phoneNumber: string|null }
 */
router.get('/api/whatsapp/config', (req, res) => {
  res.json({
    phoneNumber: process.env.PHONE_NUMBER || null,
  });
});

// -----------------------------------------------------------------
// POST /api/whatsapp/connect
// -----------------------------------------------------------------

/**
 * Inicia a conexão WhatsApp sob demanda.
 *
 * Se já houver uma sessão válida no Secret Manager, reconecta sem
 * exibir pairing code. Se não houver sessão, solicita o pairing code
 * para o número informado e transita para o estado awaiting_pairing.
 *
 * A resposta 202 Accepted indica que o processo foi iniciado.
 * O resultado final é obtido via GET /api/whatsapp/status (polling).
 *
 * @body  { phoneNumber: string } — E.164 sem '+' (ex: '5511999999999')
 *
 * @returns {202} { message: string, phoneNumber: string }
 * @returns {400} { error: string }  — phoneNumber inválido
 * @returns {409} { error: string, status: string } — conexão já em andamento
 */
router.post('/api/whatsapp/connect', async (req, res) => {
  const { status } = connectionManager.getStatus();

  // Rejeita se já existe uma conexão ativa ou em andamento
  if (
    status === STATUS.CONNECTING ||
    status === STATUS.AWAITING_PAIRING ||
    status === STATUS.CONNECTED
  ) {
    return res.status(409).json({
      error: 'Já existe uma conexão em andamento.',
      status,
    });
  }

  // Valida o número de telefone
  const { phoneNumber } = req.body;

  if (!phoneNumber || !/^\d{10,15}$/.test(String(phoneNumber))) {
    return res.status(400).json({
      error:   'phoneNumber inválido. Informe apenas dígitos no formato E.164 sem + (ex: 5511999999999).',
      example: '5511999999999',
    });
  }

  const phone = String(phoneNumber).trim();

  logger.info({ phone }, '[Route] POST /api/whatsapp/connect — iniciando conexão');

  // Responde 202 imediatamente — a conexão ocorre em background
  // O cliente acompanha o progresso via GET /api/whatsapp/status
  res.status(202).json({
    message:     'Conexão iniciada. Acompanhe o status via GET /api/whatsapp/status.',
    phoneNumber: phone,
  });

  // Inicia em background — o ConnectionManager já loga e trata erros internamente
  connectionManager.connect(phone).catch(() => {});
});

// -----------------------------------------------------------------
// POST /api/whatsapp/disconnect
// -----------------------------------------------------------------

/**
 * Encerra a conexão WhatsApp ativa de forma intencional.
 *
 * Útil para:
 * - Trocar a conta vinculada (desconecta → conecta com outro número)
 * - Manutenção ou reinicialização manual da sessão
 *
 * Idempotente: chamar disconnect() quando já desconectado não gera erro.
 *
 * @returns {200} { message: string }
 */
router.post('/api/whatsapp/disconnect', (req, res) => {
  logger.info('[Route] POST /api/whatsapp/disconnect');
  connectionManager.disconnect();
  res.json({ message: 'Desconectado com sucesso.' });
});

export default router;
