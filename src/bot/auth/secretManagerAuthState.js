/**
 * Arquivo: src/bot/auth/secretManagerAuthState.js
 * Descrição: Auth state customizado do Baileys com persistência no Google Secret Manager.
 *            Substitui o useMultiFileAuthState padrão (inadequado para produção em VM),
 *            armazenando as credenciais de sessão WhatsApp de forma segura e auditável.
 *
 * Responsabilidades:
 * - Ler credenciais de sessão do Secret Manager (getSecretValue)
 * - Escrever/atualizar credenciais no Secret Manager (saveSecretValue) — feat-010
 * - Expor auth state compatível com makeWASocket (useSecretManagerAuthState) — feat-011
 *
 * Autenticação GCP:
 * - Em produção (VM Compute Engine): Application Default Credentials (ADC) automático
 * - Em desenvolvimento local: requer GOOGLE_APPLICATION_CREDENTIALS apontando para chave SA
 *
 * Feature: feat-009 - Implementar getSecretValue (leitura do secret)
 * Atualizado em: feat-010 - Implementar saveSecretValue (escrita do secret)
 * Criado em: 2026-02-25
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import logger from '../../utils/logger.js';

/**
 * Cliente singleton do Google Secret Manager.
 * Reutiliza a mesma instância em todas as operações para evitar overhead de autenticação.
 * A autenticação ocorre automaticamente via ADC na VM do Compute Engine.
 */
const client = new SecretManagerServiceClient();

/**
 * Código de erro gRPC retornado pelo Secret Manager quando o recurso não existe.
 * Documentação: https://grpc.github.io/grpc/core/md_doc_statuscodes.html
 */
const GRPC_NOT_FOUND = 5;

// -----------------------------------------------------------------
// Leitura do Secret Manager
// -----------------------------------------------------------------

/**
 * Lê o valor mais recente de um secret no Google Secret Manager.
 *
 * Acessa sempre a versão 'latest' do secret — garantindo que a sessão
 * WhatsApp mais recente seja carregada após cada atualização de credenciais.
 *
 * @param {string} secretName - Nome do secret no Secret Manager (ex: 'whatsapp-baileys-session')
 * @param {string} projectId  - ID do projeto GCP (ex: 'meu-projeto-123456')
 * @returns {Promise<string|null>} Conteúdo do secret em string UTF-8, ou null se não existir
 * @throws {Error} Se ocorrer erro de permissão, rede ou qualquer falha não-NOT_FOUND
 *
 * @example
 * const raw = await getSecretValue('whatsapp-baileys-session', 'meu-projeto');
 * if (raw === null) {
 *   // Primeira execução — secret ainda não existe
 * } else {
 *   const data = JSON.parse(raw, BufferJSON.reviver);
 * }
 */
async function getSecretValue(secretName, projectId) {
  const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;

  logger.debug({ secretName, projectId }, '[SecretManager] Lendo secret');

  try {
    const [version] = await client.accessSecretVersion({ name });
    const value = version.payload?.data?.toString();

    logger.debug({ secretName }, '[SecretManager] Secret lido com sucesso');
    return value;
  } catch (err) {
    if (err.code === GRPC_NOT_FOUND) {
      logger.warn({ secretName }, '[SecretManager] Secret não encontrado — será inicializado na primeira autenticação');
      return null;
    }

    logger.error({ err, secretName, projectId }, '[SecretManager] Erro ao ler secret');
    throw err;
  }
}

// -----------------------------------------------------------------
// Escrita no Secret Manager
// -----------------------------------------------------------------

/**
 * Persiste um novo valor no Google Secret Manager adicionando uma nova versão ao secret.
 *
 * Se o secret ainda não existir (primeira execução), ele é criado automaticamente
 * com política de replicação automática antes de adicionar a versão.
 * Versões anteriores do secret permanecem acessíveis no GCP para rollback manual.
 *
 * @param {string} secretName - Nome do secret no Secret Manager
 * @param {string} projectId  - ID do projeto GCP
 * @param {string} payload    - Conteúdo a ser salvo (string UTF-8, geralmente JSON serializado)
 * @returns {Promise<void>}
 * @throws {Error} Se ocorrer erro de permissão ou falha inesperada na API GCP
 *
 * @example
 * const payload = JSON.stringify({ creds, keys }, BufferJSON.replacer);
 * await saveSecretValue('whatsapp-baileys-session', 'meu-projeto', payload);
 */
async function saveSecretValue(secretName, projectId, payload) {
  const parent = `projects/${projectId}/secrets/${secretName}`;
  const data   = Buffer.from(payload, 'utf8');

  logger.debug({ secretName }, '[SecretManager] Salvando nova versão do secret');

  try {
    await client.addSecretVersion({ parent, payload: { data } });
    logger.debug({ secretName }, '[SecretManager] Nova versão do secret salva com sucesso');
  } catch (err) {
    if (err.code !== GRPC_NOT_FOUND) {
      logger.error({ err, secretName, projectId }, '[SecretManager] Erro ao salvar secret');
      throw err;
    }

    // Secret não existe — cria com replication automática e então adiciona a versão
    logger.warn({ secretName, projectId }, '[SecretManager] Secret não existe, criando automaticamente');

    try {
      await client.createSecret({
        parent: `projects/${projectId}`,
        secretId: secretName,
        secret: { replication: { automatic: {} } },
      });

      await client.addSecretVersion({ parent, payload: { data } });
      logger.info({ secretName }, '[SecretManager] Secret criado e primeira versão salva com sucesso');
    } catch (createErr) {
      logger.error({ err: createErr, secretName, projectId }, '[SecretManager] Erro ao criar secret');
      throw createErr;
    }
  }
}

export { getSecretValue, saveSecretValue };
