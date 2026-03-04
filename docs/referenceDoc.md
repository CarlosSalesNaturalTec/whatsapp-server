# Baileys — WhiskeySockets/Baileys
## Guia de Referência para Desenvolvedores

> **Hospedagem:** GCP Compute Engine &nbsp;|&nbsp; **Sessão:** Google Secret Manager

---

> ⚠️ **Aviso Legal:** Este projeto NÃO é afiliado ao WhatsApp/Meta. O uso deve respeitar os Termos de Serviço do WhatsApp. Não utilize para envio de spam ou mensagens em massa não autorizadas. Use por conta e risco próprios.

> 🚀 **v7.x (ESM Only):** A partir da versão 7.0.0, Baileys é um módulo ESM puro. O pacote oficial passou a se chamar `baileys` (sem o prefixo `@whiskeysockets`). Múltiplas breaking changes foram introduzidas — veja a seção de migração.

---

## 1. Visão Geral

Baileys é uma biblioteca TypeScript/JavaScript baseada em WebSockets para interagir com a API do WhatsApp Web. Diferente de soluções como Selenium, ela se conecta diretamente ao protocolo do WhatsApp, consumindo muito menos recursos de CPU e memória — ideal para implantação em VMs de menor porte na GCP.

| Característica   | Detalhe                                              |
|------------------|------------------------------------------------------|
| Protocolo        | WebSocket direto (sem Selenium ou Chromium)          |
| Autenticação     | QR Code ou Pairing Code (E.164 sem +)                |
| Multi-device     | Suportado nativamente                                |
| Pacote npm       | `baileys` (v7+) / `@whiskeysockets/baileys` (v6)     |
| Módulo           | ESM puro a partir da v7.0.0                          |
| Node.js mínimo   | 18+ recomendado                                      |
| Licença          | MIT                                                  |
| Repositório      | github.com/WhiskeySockets/Baileys                    |

---

## 2. Instalação e Configuração do Projeto

### 2.1 Instalação

```bash
# Versão 7.x (recomendada — ESM)
npm install baileys

# Dependências complementares recomendadas
npm install @hapi/boom pino node-cache @google-cloud/secret-manager

# Para link previews (opcional)
npm install link-preview-js
```

### 2.2 package.json (ESM)

Para utilizar Baileys v7+ com ESM, o `package.json` deve declarar o tipo de módulo:

```json
{
  "name": "minha-app-whatsapp",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "dev":   "node --watch src/index.js"
  },
  "dependencies": {
    "baileys": "^7.0.0-rc.9",
    "@hapi/boom": "^10.0.0",
    "pino": "^9.0.0",
    "node-cache": "^5.1.2",
    "@google-cloud/secret-manager": "^5.0.0"
  }
}
```

### 2.3 Uso em projeto CommonJS (legado)

Se o projeto não puder migrar para ESM, importe o módulo de forma dinâmica:

```js
// cjs_index.js  (type:'commonjs' no package.json)
async function main() {
  const { default: makeWASocket, DisconnectReason } = await import('baileys');
  // Use normalmente a partir daqui
}
main();
```

---

## 3. Gerenciamento de Sessão com Google Secret Manager

Em produção numa VM do Compute Engine, as credenciais da sessão WhatsApp **NÃO** devem ser salvas em arquivos no disco. A abordagem recomendada é armazenar o estado de autenticação no Google Secret Manager, garantindo segurança, auditoria e fácil rotação de segredos.

> 🔑 **Por que Secret Manager?** Credenciais salvas em disco ficam vulneráveis a snapshots de disco, logs e acessos não autorizados. O Secret Manager oferece controle de acesso por IAM, versionamento e audit logs integrados ao Cloud Logging.

### 3.1 Pré-requisitos na GCP

Configure o IAM da Service Account da VM com o papel necessário:

```bash
# Obtenha o e-mail da service account da VM
gcloud compute instances describe NOME_DA_VM \
    --zone=ZONA --format="value(serviceAccounts[0].email)"

# Conceda acesso ao Secret Manager
gcloud projects add-iam-policy-binding SEU_PROJECT_ID \
    --member="serviceAccount:SA_EMAIL" \
    --role="roles/secretmanager.secretAccessor"

# Crie o secret (primeira vez)
gcloud secrets create whatsapp-baileys-auth --replication-policy="automatic"
```

### 3.2 Implementação do Auth State customizado

O código abaixo substitui o `useMultiFileAuthState` padrão (inadequado para produção) por uma implementação que persiste as credenciais no Secret Manager:

```js
// src/auth/secretManagerAuthState.js
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { BufferJSON, initAuthCreds } from 'baileys';

const client = new SecretManagerServiceClient();

async function getSecretValue(secretName, projectId) {
  const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
  try {
    const [version] = await client.accessSecretVersion({ name });
    return version.payload?.data?.toString();
  } catch (err) {
    if (err.code === 5) return null; // NOT_FOUND
    throw err;
  }
}

async function saveSecretValue(secretName, projectId, payload) {
  const parent = `projects/${projectId}/secrets/${secretName}`;
  const data   = Buffer.from(payload, 'utf8');
  try {
    await client.addSecretVersion({ parent, payload: { data } });
  } catch (err) {
    // Cria o secret se não existir
    if (err.code === 5) {
      await client.createSecret({
        parent: `projects/${projectId}`,
        secretId: secretName,
        secret: { replication: { automatic: {} } }
      });
      await client.addSecretVersion({ parent, payload: { data } });
    } else { throw err; }
  }
}

export async function useSecretManagerAuthState(
  projectId,
  secretName = 'whatsapp-baileys-auth'
) {
  const raw   = await getSecretValue(secretName, projectId);
  const creds = raw
    ? JSON.parse(raw, BufferJSON.reviver).creds
    : initAuthCreds();

  const keys = {};

  const state = {
    creds,
    keys: {
      get: (type, ids) => {
        return ids.reduce((acc, id) => {
          acc[id] = keys[`${type}-${id}`];
          return acc;
        }, {});
      },
      set: async (data) => {
        for (const [category, entries] of Object.entries(data)) {
          for (const [id, value] of Object.entries(entries)) {
            if (value) keys[`${category}-${id}`] = value;
            else delete keys[`${category}-${id}`];
          }
        }
        // Persiste o estado completo no Secret Manager
        const payload = JSON.stringify({ creds, keys }, BufferJSON.replacer);
        await saveSecretValue(secretName, projectId, payload);
      }
    }
  };

  const saveCreds = async () => {
    const payload = JSON.stringify({ creds, keys }, BufferJSON.replacer);
    await saveSecretValue(secretName, projectId, payload);
  };

  return { state, saveCreds };
}
```

> 💡 **Dica de performance:** Para reduzir chamadas ao Secret Manager, considere implementar um cache em memória para as chaves de sinal. Grave no Secret Manager apenas quando `creds.update` for disparado, usando debounce de alguns segundos.

---

## 4. Conexão e Reconexão Automática

### 4.1 Conexão Principal (produção com Secret Manager)

```js
// src/index.js
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers
} from 'baileys';
import { Boom } from '@hapi/boom';
import P from 'pino';
import { useSecretManagerAuthState } from './auth/secretManagerAuthState.js';

const PROJECT_ID = process.env.GCP_PROJECT_ID;
const logger     = P({ level: 'warn' }); // 'debug' em desenvolvimento

async function connectToWhatsApp() {
  const { state, saveCreds } = await useSecretManagerAuthState(PROJECT_ID);
  const { version }          = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys:  makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    browser: Browsers.ubuntu('MyApp'),
    printQRInTerminal: false,  // desabilite em produção
    syncFullHistory:   false,
  });

  // Persiste credenciais sempre que atualizadas
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('QR Code recebido — escaneie pelo WhatsApp:');
      // Em produção: envie o QR por e-mail ou endpoint HTTP seguro
      console.log(qr);
    }

    if (connection === 'close') {
      const code = (lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      console.log(`Conexão encerrada (código ${code}). Reconectando: ${shouldReconnect}`);
      if (shouldReconnect) {
        setTimeout(connectToWhatsApp, 5000); // aguarda 5s antes de reconectar
      }
    } else if (connection === 'open') {
      console.log('✅ Conectado ao WhatsApp!');
    }
  });

  return sock;
}

export default connectToWhatsApp;
```

### 4.2 Autenticação por Pairing Code (sem QR)

O Pairing Code permite autenticação sem exibir o QR code, útil em ambientes headless. O número deve estar no formato E.164 sem o sinal de `+`:

```js
const phoneNumber = '5511999999999'; // E.164 sem +

sock.ev.on('connection.update', async (update) => {
  const { connection, qr } = update;
  if (connection === 'connecting' || !!qr) {
    const code = await sock.requestPairingCode(phoneNumber);
    console.log(`Código de pareamento: ${code}`);
    // Envie este código ao usuário pelo WhatsApp do telefone
  }
});
```

### 4.3 DisconnectReason — Referência de Códigos

| Código                   | Descrição / Ação                                                        |
|--------------------------|-------------------------------------------------------------------------|
| `loggedOut` (401)        | Sessão desconectada pelo usuário. Não reconectar; exige novo QR/Pairing.|
| `connectionClosed`       | Conexão WebSocket encerrada. Reconexão segura.                          |
| `connectionLost`         | Perda de conexão de rede. Reconexão automática.                         |
| `connectionReplaced`     | Outra instância se conectou com a mesma sessão.                         |
| `timedOut`               | Timeout. Reconectar.                                                    |
| `badSession` (500)       | Arquivo de sessão corrompido. Exige nova autenticação.                  |

---

## 5. Eventos do Socket (EventEmitter)

Baileys utiliza o padrão EventEmitter para notificar a aplicação sobre atualizações. Ouça eventos com `sock.ev.on(nome, callback)`.

| Evento                      | Quando é disparado                                            |
|-----------------------------|---------------------------------------------------------------|
| `connection.update`         | Alterações de estado da conexão (open, close, connecting, QR) |
| `creds.update`              | Credenciais de autenticação atualizadas — sempre salve!       |
| `messages.upsert`           | Nova mensagem recebida ou enviada                             |
| `messages.update`           | Atualização de status de mensagem (lida, entregue, etc.)      |
| `messages.delete`           | Mensagem excluída                                             |
| `chats.upsert`              | Novo chat adicionado                                          |
| `chats.update`              | Atualização de metadados de chat                              |
| `contacts.upsert`           | Contatos adicionados/atualizados                              |
| `groups.upsert`             | Novo grupo criado ou sincronizado                             |
| `groups.update`             | Metadados do grupo atualizados                                |
| `group-participants.update` | Participantes adicionados/removidos do grupo                  |
| `presence.update`           | Status de presença (online, digitando...)                     |
| `messaging-history.set`     | Histórico de mensagens sincronizado                           |

### 5.1 Exemplo: tratamento de mensagens recebidas

```js
sock.ev.on('messages.upsert', async ({ messages, type }) => {
  // type: 'notify' = nova mensagem  |  'append' = histórico
  if (type !== 'notify') return;

  for (const msg of messages) {
    if (msg.key.fromMe) continue; // ignora mensagens próprias

    const jid  = msg.key.remoteJid;
    const body =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      '';

    console.log(`[${jid}] ${body}`);

    // Echo simples
    if (body.toLowerCase() === 'ping') {
      await sock.sendMessage(jid, { text: 'pong 🏓' });
    }
  }
});
```

---

## 6. Enviando Mensagens

O JID (WhatsApp ID) de um contato individual segue o formato `NÚMERO@s.whatsapp.net`. Para grupos: `ID@g.us`. Para newsletters: `ID@newsletter`.

### 6.1 Texto simples

```js
const jid = '5511999999999@s.whatsapp.net';

// Texto
await sock.sendMessage(jid, { text: 'Olá, mundo!' });

// Resposta (quoted)
await sock.sendMessage(jid, { text: 'Resposta!' }, { quoted: mensagemOriginal });

// Menção
await sock.sendMessage(jid, {
  text: '@5511888888888 Olá!',
  mentions: ['5511888888888@s.whatsapp.net']
});
```

### 6.2 Mídia — Imagens, Vídeos, Áudios e Documentos

```js
import { readFileSync } from 'fs';

// Imagem por buffer
await sock.sendMessage(jid, {
  image: readFileSync('./imagem.jpg'),
  caption: 'Legenda da imagem'
});

// Imagem por URL
await sock.sendMessage(jid, {
  image: { url: 'https://example.com/foto.jpg' },
  caption: 'Foto da URL'
});

// Vídeo
await sock.sendMessage(jid, {
  video: readFileSync('./video.mp4'),
  caption: 'Confira este vídeo!',
  mimetype: 'video/mp4'
});

// GIF (gifPlayback)
await sock.sendMessage(jid, {
  video: readFileSync('./animacao.mp4'),
  gifPlayback: true
});

// Áudio
await sock.sendMessage(jid, {
  audio: readFileSync('./audio.mp3'),
  mimetype: 'audio/mp4'
});

// PTT (Push to Talk / nota de voz)
await sock.sendMessage(jid, {
  audio: readFileSync('./voz.ogg'),
  ptt: true
});

// Documento
await sock.sendMessage(jid, {
  document: readFileSync('./relatorio.pdf'),
  mimetype: 'application/pdf',
  fileName: 'relatorio.pdf'
});

// Sticker
await sock.sendMessage(jid, {
  sticker: readFileSync('./sticker.webp')
});
```

### 6.3 Localização, Contato, Reação e Enquete

```js
// Localização
await sock.sendMessage(jid, {
  location: { degreesLatitude: -23.5505, degreesLongitude: -46.6333 }
});

// Contato (vCard)
const vcard = [
  'BEGIN:VCARD',
  'VERSION:3.0',
  'FN:Carlos Sales',
  'ORG:Minha Empresa;',
  'TEL;type=CELL;type=VOICE;waid=5511999999999:+55 11 99999-9999',
  'END:VCARD'
].join('\n');

await sock.sendMessage(jid, {
  contacts: { displayName: 'Carlos Sales', contacts: [{ vcard }] }
});

// Reação a mensagem
await sock.sendMessage(jid, {
  react: { text: '👍', key: mensagemOriginal.key }
});

// Remover reação
await sock.sendMessage(jid, {
  react: { text: '', key: mensagemOriginal.key }
});

// Enquete (poll)
await sock.sendMessage(jid, {
  poll: {
    name: 'Qual sua linguagem favorita?',
    values: ['TypeScript', 'Python', 'Go', 'Rust'],
    selectableCount: 1
  }
});
```

### 6.4 Visualizar uma vez (View Once) e Encaminhar

```js
// View once — imagem visível apenas uma vez
await sock.sendMessage(jid, {
  image: readFileSync('./segredo.jpg'),
  viewOnce: true,
  caption: 'Visualize uma vez!'
});

// Encaminhar mensagem
await sock.sendMessage(jid, {
  forward: mensagemOriginal,
  force: true // força encaminhamento mesmo de mensagens próprias
});

// Deletar mensagem (para todos)
await sock.sendMessage(jid, {
  delete: mensagemOriginal.key
});
```

---

## 7. Gerenciamento de Grupos

```js
// Criar grupo
const { id: groupJid } = await sock.groupCreate(
  'Nome do Grupo',
  ['5511111111111@s.whatsapp.net', '5511222222222@s.whatsapp.net']
);
console.log('Grupo criado:', groupJid);

// Obter metadados
const meta = await sock.groupMetadata(groupJid);
console.log(meta.subject, meta.participants);

// Listar grupos que o bot participa
const grupos = await sock.groupFetchAllParticipating();
Object.entries(grupos).forEach(([id, meta]) => console.log(id, meta.subject));

// Adicionar participante
await sock.groupParticipantsUpdate(
  groupJid, ['5511333333333@s.whatsapp.net'], 'add'
);

// Remover participante
await sock.groupParticipantsUpdate(
  groupJid, ['5511333333333@s.whatsapp.net'], 'remove'
);

// Promover a admin
await sock.groupParticipantsUpdate(
  groupJid, ['5511333333333@s.whatsapp.net'], 'promote'
);

// Rebaixar admin
await sock.groupParticipantsUpdate(
  groupJid, ['5511333333333@s.whatsapp.net'], 'demote'
);

// Alterar assunto
await sock.groupUpdateSubject(groupJid, 'Novo Nome do Grupo');

// Alterar descrição
await sock.groupUpdateDescription(groupJid, 'Nova descrição');

// Obter link de convite
const code = await sock.groupInviteCode(groupJid);
console.log(`https://chat.whatsapp.com/${code}`);

// Revogar link de convite
await sock.groupRevokeInvite(groupJid);

// Entrar via link
const joinedJid = await sock.groupAcceptInvite('CODIGO_DO_LINK');

// Sair do grupo
await sock.groupLeave(groupJid);
```

---

## 8. Contatos, Presença e Status

```js
// Verificar se número está no WhatsApp
const [result] = await sock.onWhatsApp('5511999999999');
console.log(result.exists, result.jid);

// Verificar múltiplos números
const results = await sock.onWhatsApp('5511111111111', '5511222222222');

// Obter status/bio do contato
const { status } = await sock.fetchStatus('5511999999999@s.whatsapp.net');
console.log(status);

// Obter foto de perfil
const url = await sock.profilePictureUrl('5511999999999@s.whatsapp.net', 'image');

// Assinar presença de contato (online/typing)
await sock.presenceSubscribe('5511999999999@s.whatsapp.net');
sock.ev.on('presence.update', ({ id, presences }) => {
  console.log('Presença de', id, ':', presences);
});

// Enviar presença (está digitando)
await sock.sendPresenceUpdate('composing', jid);

// Parar de digitar
await sock.sendPresenceUpdate('paused', jid);

// Marcar mensagem como lida
await sock.readMessages([msg.key]);
```

---

## 9. Recebendo e Fazendo Download de Mídia

```js
import { downloadMediaMessage } from 'baileys';
import { writeFileSync } from 'fs';

sock.ev.on('messages.upsert', async ({ messages }) => {
  for (const msg of messages) {
    const type = Object.keys(msg.message || {})[0];

    if (['imageMessage', 'videoMessage', 'audioMessage',
         'documentMessage', 'stickerMessage'].includes(type)) {

      // Download como Buffer
      const buffer = await downloadMediaMessage(
        msg,
        'buffer',
        {},
        { logger, reuploadRequest: sock.updateMediaMessage }
      );

      // Salvar no disco (ou enviar para GCS, etc.)
      const ext = type === 'imageMessage' ? 'jpg' : 'bin';
      writeFileSync(`./media/${Date.now()}.${ext}`, buffer);

      // Ou obter como Stream
      const stream = await downloadMediaMessage(msg, 'stream', {});
      // stream.pipe(arquivoDestino);
    }
  }
});
```

---

## 10. Store em Memória (desenvolvimento)

O `makeInMemoryStore` fornece um store simples para desenvolvimento e testes. Não o utilize em produção — implemente um store com banco de dados para ambientes de longa duração.

```js
import makeWASocket, { makeInMemoryStore } from 'baileys';

// Criar store
const store = makeInMemoryStore({});

// Persistir em arquivo a cada 30 segundos
store.readFromFile('./baileys_store.json');
setInterval(() => store.writeToFile('./baileys_store.json'), 30_000);

const sock = makeWASocket({ /* config */ });

// Vincular o store ao socket
store.bind(sock.ev);

// Acessar dados do store
sock.ev.on('chats.set', () => {
  console.log(`${store.chats.all().length} chats carregados`);
});
```

---

## 11. Principais Opções de Configuração do Socket

| Opção                    | Descrição                                                           |
|--------------------------|---------------------------------------------------------------------|
| `auth`                   | Estado de autenticação (obrigatório)                                |
| `logger`                 | Instância pino (padrão: `pino({level:"warn"})`)                     |
| `version`                | Versão WA — use `fetchLatestBaileysVersion()`                       |
| `browser`                | `Browsers.ubuntu('App')` \| `Browsers.macOS('Desktop')`             |
| `printQRInTerminal`      | Imprime QR no terminal (`true`/`false`)                             |
| `syncFullHistory`        | Sincroniza histórico completo (padrão: `false`)                     |
| `getMessage`             | Função para recuperar mensagem pelo ID (para retransmissão)         |
| `cachedGroupMetadata`    | Cache de metadados de grupos (NodeCache recomendado)                |
| `defaultQueryTimeoutMs`  | Timeout padrão para queries (ms)                                    |
| `connectTimeoutMs`       | Timeout de conexão inicial (ms)                                     |
| `keepAliveIntervalMs`    | Intervalo de keepalive do WebSocket                                 |
| `retryRequestDelayMs`    | Delay entre retentativas de requisição                              |

### 11.1 Configuração recomendada para produção

```js
import makeWASocket, {
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers
} from 'baileys';
import NodeCache from 'node-cache';
import P from 'pino';

const logger     = P({ level: 'warn' });
const groupCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const { version } = await fetchLatestBaileysVersion();

const sock = makeWASocket({
  version,
  auth: {
    creds: state.creds,
    keys:  makeCacheableSignalKeyStore(state.keys, logger),
  },
  logger,
  browser:                   Browsers.ubuntu('MyProdApp'),
  printQRInTerminal:         false,
  syncFullHistory:           false,
  connectTimeoutMs:          60_000,
  defaultQueryTimeoutMs:     60_000,
  keepAliveIntervalMs:       25_000,
  retryRequestDelayMs:       500,
  cachedGroupMetadata: async (jid) => groupCache.get(jid),
  getMessage: async (key) => {
    // Retorne a mensagem do seu banco de dados pelo key.id
    return undefined;
  }
});

// Atualiza cache de grupos
sock.ev.on('groups.update', ([event]) => {
  groupCache.set(event.id, event);
});
```

---

## 12. Migração para v7.x

> ⚠️ **Breaking Changes:** A versão 7.0.0 introduziu diversas breaking changes. O principal impacto é a migração para ESM puro e a troca do nome do pacote.

| De (v6)                    | Para (v7)                                     |
|----------------------------|-----------------------------------------------|
| `@whiskeysockets/baileys`  | `baileys`                                     |
| CJS/ESM misto              | ESM puro (`type: "module"`)                   |
| `makeWASocket.default`     | default export direto                         |
| `.fromObject()`            | `.create()`                                   |
| Encode direto              | Use `BufferJSON` utilities                    |
| PN JID sessions            | LID format por padrão (novas sessões)         |
| —                          | Novo método `decodeAndHydrate()` obrigatório  |

---

## 13. Deploy na GCP Compute Engine

### 13.1 Configuração do ambiente na VM

```bash
# 1. Instalar Node.js 20+ na VM (Debian/Ubuntu)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Instalar PM2 para gerenciamento de processos
sudo npm install -g pm2

# 3. Clonar/copiar a aplicação
git clone https://github.com/seu-usuario/sua-app.git /opt/whatsapp-app
cd /opt/whatsapp-app && npm install

# 4. Configurar variável de ambiente do projeto GCP
echo 'GCP_PROJECT_ID=seu-projeto-id' >> /etc/environment

# 5. Iniciar com PM2
pm2 start src/index.js --name whatsapp-app
pm2 save
pm2 startup  # configura autostart após reboot
```

### 13.2 Permissões IAM necessárias

| Papel IAM                                  | Finalidade                                   |
|--------------------------------------------|----------------------------------------------|
| `roles/secretmanager.secretAccessor`       | Leitura/acesso a versões de secrets          |
| `roles/secretmanager.secretVersionAdder`   | Criação de novas versões de secrets          |
| `roles/logging.logWriter`                  | Gravação de logs no Cloud Logging (opcional) |

### 13.3 Exemplo de ecosystem.config.cjs para PM2

```js
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name:         'whatsapp-app',
    script:       './src/index.js',
    interpreter:  'node',
    env: {
      NODE_ENV:       'production',
      GCP_PROJECT_ID: 'seu-projeto-gcp',
    },
    max_memory_restart: '512M',
    restart_delay:      5000,
    max_restarts:       10,
    log_date_format:    'YYYY-MM-DD HH:mm:ss',
    error_file:         '/var/log/pm2/whatsapp-error.log',
    out_file:           '/var/log/pm2/whatsapp-out.log',
  }]
};
```

---

## 14. Boas Práticas e Recomendações

### 14.1 Segurança

- Nunca persista credenciais de sessão em arquivos de texto, variáveis de ambiente ou repositórios Git.
- Use o Google Secret Manager para armazenar o estado de autenticação.
- Conceda o princípio de mínimos privilégios: a Service Account da VM deve ter apenas os roles necessários.
- Ative auditoria (Cloud Audit Logs) para o Secret Manager.
- Considere rotacionar/revogar a sessão periodicamente e re-autenticar via Pairing Code de forma automatizada.

### 14.2 Estabilidade

- Implemente reconexão automática com backoff exponencial (evite reconexão imediata em loops).
- Monitore o evento `creds.update` e persista **sempre** que disparado — perder este evento pode corromper a sessão.
- Utilize `makeCacheableSignalKeyStore` para reduzir I/O ao Secret Manager durante troca de chaves de sinal.
- Adicione healthcheck HTTP básico na aplicação para que o Load Balancer ou Cloud Monitoring possa verificar o estado.
- Evite múltiplas instâncias conectadas com a mesma sessão (`DisconnectReason.connectionReplaced`).

### 14.3 Performance

- Desative `syncFullHistory` em produção — o histórico completo consome memória e banda desnecessariamente.
- Use o cache de metadados de grupos (`cachedGroupMetadata`) com NodeCache para reduzir consultas repetidas.
- Configure o logger no nível `warn` ou `error` em produção; `debug` gera logs muito verbosos.
- Implemente debounce ao gravar no Secret Manager para evitar throttling em rajadas de eventos `keys.set`.

### 14.4 Conformidade

- Nunca use Baileys para envio em massa (spam) ou stalkerware. Isso viola os Termos de Serviço do WhatsApp.
- Implemente rate limiting e delays entre mensagens enviadas para evitar banimentos.
- Informe claramente ao usuário final que a aplicação age em nome de sua conta WhatsApp.

---

## 15. Referências e Recursos

| Recurso               | URL / Descrição                                      |
|-----------------------|------------------------------------------------------|
| Repositório oficial   | github.com/WhiskeySockets/Baileys                    |
| Documentação oficial  | baileys.wiki                                         |
| npm (v7+)             | npmjs.com/package/baileys                            |
| npm (v6)              | npmjs.com/package/@whiskeysockets/baileys            |
| Guia de migração v7   | baileys.wiki/docs/migration/to-v7.0.0/              |
| Discord da comunidade | whiskey.so/discord                                   |
| GCP Secret Manager    | cloud.google.com/secret-manager/docs                 |
| GCP IAM               | cloud.google.com/iam/docs/overview                   |
| PM2                   | pm2.keymetrics.io                                    |

---

*— Fim do Documento —*
