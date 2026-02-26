# Documento de Contexto Técnico — WhatsApp Server + Landing Page

**Versão:** 1.0
**Data:** 2026-02-25
**Baseado em:** `docs/requirements.md` + `docs/referenceDoc.md`

---

## 1. VISÃO GERAL DA ARQUITETURA

### Tipo de Arquitetura

**Monolítica de processo único** — um único processo Node.js gerencia os dois responsabilidades da aplicação:

1. O **bot WhatsApp** (conexão WebSocket via Baileys, leitura de mensagens, resposta automática)
2. O **servidor HTTP** (Express.js servindo o build estático da Landing Page React)

### Justificativa

- **Simplicidade operacional:** Uma única VM, um único processo gerenciado pelo PM2, sem orquestração de containers ou redes internas
- **Baixo volume:** Os requisitos indicam uso pessoal ou de pequena equipe — não há necessidade de separação em microserviços
- **Recursos compartilhados:** A Landing Page aproveita a VM já ativa 24×7 para o bot, sem custo adicional
- **Manutenibilidade:** Codebase unificado, deploy único, logs centralizados

### Diagrama Conceitual

```
┌─────────────────────────────────────────────────────────────────┐
│                    GCP Compute Engine (VM)                      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │               Processo Node.js (PM2)                    │   │
│  │                                                         │   │
│  │   ┌─────────────────┐     ┌──────────────────────────┐  │   │
│  │   │   WhatsApp Bot  │     │     Express HTTP Server  │  │   │
│  │   │   (Baileys v7)  │     │     porta 3000 / 80      │  │   │
│  │   │                 │     │                          │  │   │
│  │   │  - Pairing Code │     │  GET /        → React    │  │   │
│  │   │  - Auth State   │     │  GET /health  → JSON     │  │   │
│  │   │  - Msg Listener │     │  GET /assets/* → static  │  │   │
│  │   │  - Auto Reply   │     │                          │  │   │
│  │   └────────┬────────┘     └──────────────────────────┘  │   │
│  │            │                           ▲                 │   │
│  └────────────┼───────────────────────────┼─────────────────┘   │
│               │                           │                     │
│               ▼                           │                     │
│  ┌────────────────────┐      ┌────────────────────────┐        │
│  │  Google Secret     │      │   frontend/dist/       │        │
│  │  Manager           │      │   (React build)        │        │
│  │  (sessão WhatsApp) │      └────────────────────────┘        │
│  └────────────────────┘                                        │
│               │                                                 │
└───────────────┼─────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────┐        ┌──────────────────────────┐
│  WhatsApp Web (Meta)     │        │  Browser do Visitante    │
│  WebSocket criptografado │        │  (Landing Page)          │
└──────────────────────────┘        └──────────────────────────┘
```

### Fluxo de Inicialização

```
PM2 inicia o processo Node.js
  └─> Carrega credenciais do Secret Manager
       ├─> [Sessão existe] → Conecta ao WhatsApp automaticamente
       └─> [Sessão não existe] → Gera Pairing Code → exibe no log
  └─> Express inicia e serve a Landing Page (porta configurável)
  └─> Bot escuta eventos messages.upsert
       └─> Recebe mensagem com "#iniciarBot#" → responde "Bot Iniciado"
```

---

## 2. STACK TECNOLÓGICA

### Frontend

| Item | Decisão |
|---|---|
| **Framework** | React 18 |
| **Linguagem** | JavaScript (JSX) |
| **Build Tool** | Vite |
| **Estilização** | Tailwind CSS |
| **Tipo de entrega** | Build estático (`frontend/dist/`) servido pelo Express |

**Justificativa:**
- React é mandatório conforme requisitos
- Vite oferece build rápido e output otimizado para produção (tree-shaking, code splitting, minificação)
- Tailwind CSS permite construir interface moderna e responsiva sem biblioteca de componentes adicional
- Build estático elimina a necessidade de SSR, mantendo a arquitetura simples

---

### Backend / Bot

| Item | Decisão |
|---|---|
| **Runtime** | Node.js 20 LTS |
| **Módulo** | ESM puro (`"type": "module"` no `package.json`) |
| **Servidor HTTP** | Express.js |
| **Biblioteca WhatsApp** | `baileys` v7.x |
| **Logger** | `pino` |
| **Gerenciamento de Processos** | PM2 |
| **Cache de grupos** | `node-cache` |
| **Segredos** | `@google-cloud/secret-manager` |
| **Error handling** | `@hapi/boom` |

**Justificativa:**
- **Node.js 20 LTS:** Versão mínima exigida pelo Baileys v7 (mínimo recomendado: 18+); LTS garante suporte até 2026
- **ESM puro:** Obrigatório para o Baileys v7, que não suporta CommonJS de forma nativa
- **Express.js:** Maduro, simples e suficiente para servir arquivos estáticos + endpoint de health check
- **pino:** Logger de alta performance e baixo overhead, recomendado pelo próprio Baileys
- **PM2:** Padrão de mercado para gerenciamento de processos Node.js em produção; suporta autostart, logs, restart automático

---

### Banco de Dados

**Não há banco de dados nesta versão.**

Conforme definido no escopo, não há persistência de mensagens ou histórico. O único estado persistido é a sessão do WhatsApp, armazenada no Google Secret Manager.

> Se no futuro for necessário persistir mensagens, avaliar **PostgreSQL** (via Cloud SQL no GCP) por ser maduro, suportado nativamente pelo GCP e adequado ao padrão relacional esperado.

---

### Infraestrutura

| Item | Decisão |
|---|---|
| **Plataforma** | GCP Compute Engine (VM Linux — Debian/Ubuntu) |
| **Gerenciamento de Segredos** | Google Secret Manager |
| **Gerenciamento de Processo** | PM2 |
| **Porta HTTP** | `3000` (desenvolvimento) / `80` ou via proxy reverso (produção) |
| **IAM** | Service Account com `secretmanager.secretAccessor` + `secretmanager.secretVersionAdder` |

**Estratégia de Deploy:**
1. SSH na VM via `gcloud compute ssh`
2. `git pull` no diretório da aplicação
3. `npm install` (se houver novas dependências)
4. `npm run build:frontend` (rebuilda o React)
5. `pm2 reload whatsapp-app` (reload sem downtime)

---

## 3. ESTRUTURA DE PASTAS

```
whatsapp-server/
│
├── src/                              # Código-fonte do backend/bot
│   ├── index.js                      # Entry point — inicializa bot + servidor HTTP
│   │
│   ├── bot/                          # Módulo WhatsApp
│   │   ├── connection.js             # Cria e gerencia a conexão Baileys (makeWASocket)
│   │   ├── auth/
│   │   │   └── secretManagerAuthState.js   # Auth state customizado (Secret Manager)
│   │   └── handlers/
│   │       └── messageHandler.js     # Lógica de processamento de mensagens recebidas
│   │
│   └── server/                       # Módulo HTTP (Express)
│       ├── index.js                  # Configura e exporta o app Express
│       └── routes/
│           └── health.js             # GET /health — verifica estado da aplicação
│
├── frontend/                         # Código-fonte da Landing Page (React)
│   ├── src/
│   │   ├── main.jsx                  # Entry point React
│   │   ├── App.jsx                   # Componente raiz
│   │   ├── components/               # Componentes reutilizáveis
│   │   ├── pages/                    # Páginas da Landing Page
│   │   └── assets/                   # Imagens, fontes, ícones
│   ├── public/                       # Arquivos públicos estáticos (favicon, etc.)
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json                  # Dependências exclusivas do frontend
│
├── docs/                             # Documentação do projeto
│   ├── demanda-cliente.md
│   ├── requirements.md
│   ├── referenceDoc.md
│   └── contextDoc.md                 # Este arquivo
│
├── ecosystem.config.cjs              # Configuração PM2 (CJS por necessidade do PM2)
├── .env.example                      # Exemplo de variáveis de ambiente
├── .gitignore
└── package.json                      # Dependências do backend/bot
```

**Notas sobre a estrutura:**
- `frontend/` é um **sub-pacote independente** com seu próprio `package.json`. O build output (`frontend/dist/`) é servido pelo Express no backend
- `ecosystem.config.cjs` usa extensão `.cjs` porque PM2 não suporta arquivo de config em ESM
- Não há pasta `database/` — sem banco de dados no escopo atual

---

## 4. PADRÕES E CONVENÇÕES

### Nomenclatura

| Contexto | Convenção | Exemplo |
|---|---|---|
| Arquivos JS | camelCase | `messageHandler.js` |
| Funções | camelCase | `connectToWhatsApp()` |
| Constantes | UPPER_SNAKE_CASE | `GCP_PROJECT_ID` |
| Componentes React | PascalCase | `HeroSection.jsx` |
| Variáveis de ambiente | UPPER_SNAKE_CASE | `PORT`, `GCP_PROJECT_ID` |
| Pastas | kebab-case | `secret-manager/` |

### Padrão de Módulos

Todos os arquivos do backend utilizam **ESM** (`import/export`). Exceção: `ecosystem.config.cjs` (PM2).

```js
// ✅ Correto (ESM)
import makeWASocket from 'baileys';
export default connectToWhatsApp;

// ❌ Evitar (CJS)
const makeWASocket = require('baileys');
module.exports = connectToWhatsApp;
```

### Padrão de Commits (Conventional Commits)

```
tipo(escopo): descrição curta no imperativo

feat(bot): adicionar handler para comando #iniciarBot#
fix(auth): corrigir reconexão após logout
chore(frontend): atualizar dependências do Vite
docs: atualizar requirements.md
```

| Tipo | Uso |
|---|---|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `chore` | Manutenção, deps, config |
| `docs` | Documentação |
| `refactor` | Refatoração sem mudança de comportamento |
| `test` | Testes |

### Tratamento de Erros

- Erros esperados (ex: Secret não encontrado na primeira execução) são tratados com `try/catch` local e fallback definido
- Erros inesperados sobem para o PM2, que reinicia o processo automaticamente
- `@hapi/boom` é utilizado para erros HTTP padronizados no Express
- Nunca expor stack traces em respostas HTTP em produção

### Logging

- Biblioteca: `pino`
- Nível em produção: `warn` (reduz verbosidade do Baileys)
- Nível em desenvolvimento: `debug`
- Controlado pela variável de ambiente `LOG_LEVEL`

```js
import P from 'pino';
const logger = P({ level: process.env.LOG_LEVEL || 'warn' });
```

---

## 5. SEGURANÇA

### Credenciais e Segredos

| Item | Abordagem |
|---|---|
| Sessão WhatsApp | Armazenada **exclusivamente** no Google Secret Manager |
| `GCP_PROJECT_ID` | Variável de ambiente na VM (não sensível — é o ID do projeto) |
| Chaves privadas de Service Account | **Não necessárias** — a VM usa Application Default Credentials (ADC) automaticamente |

**Regra:** Nenhuma credencial, token ou chave privada deve constar em:
- Arquivos commitados no repositório Git
- Variáveis de ambiente expostas em `.env` no servidor
- Logs da aplicação

### .gitignore obrigatório

```
node_modules/
frontend/node_modules/
frontend/dist/
.env
*.session.json
baileys_auth_info/
/var/log/
```

### Proteção de Dados

- A VM utiliza IAM com mínimos privilégios (apenas `secretmanager.secretAccessor` e `secretmanager.secretVersionAdder`)
- O endpoint `/health` não expõe informações sensíveis sobre o estado interno da sessão WhatsApp
- A Landing Page não coleta dados do usuário (sem formulários, sem analytics — a menos que o cliente solicite)

### Validação de Inputs

- O handler de mensagens valida o tipo e o corpo da mensagem antes de processar (`msg.message?.conversation || msg.message?.extendedTextMessage?.text`)
- Mensagens sem corpo de texto são descartadas sem erro

### OWASP — Considerações Aplicáveis

| Risco | Mitigação |
|---|---|
| Exposição de dados sensíveis | Secret Manager + sem logs de credenciais |
| Injeção | Não há SQL ou shell execution; textos das mensagens nunca são executados |
| Dependências vulneráveis | Manter dependências atualizadas; auditar com `npm audit` |

---

## 6. INTEGRAÇÕES

### 6.1 WhatsApp Web (via Baileys)

| Item | Detalhe |
|---|---|
| **Propósito** | Conectar ao WhatsApp, receber e enviar mensagens |
| **Biblioteca** | `baileys` v7.x |
| **Protocolo** | WebSocket criptografado (protocolo proprietário WhatsApp Web) |
| **Autenticação** | Pairing Code (número em formato E.164 sem `+`, ex: `5511999999999`) |
| **Reconexão** | Automática via `setTimeout(connectToWhatsApp, 5000)` nos casos recuperáveis |

**Eventos utilizados:**
- `connection.update` — gerencia estados da conexão e Pairing Code
- `creds.update` — persiste credenciais atualizadas no Secret Manager
- `messages.upsert` — processa mensagens recebidas

### 6.2 Google Secret Manager

| Item | Detalhe |
|---|---|
| **Propósito** | Armazenar e recuperar o estado de autenticação da sessão WhatsApp |
| **SDK** | `@google-cloud/secret-manager` v5.x |
| **Autenticação com GCP** | Application Default Credentials (ADC) — automático na VM do Compute Engine |
| **Secret Name** | `whatsapp-baileys-session` (configurável via env) |
| **Operações** | `accessSecretVersion` (leitura) + `addSecretVersion` (escrita) |

**Permissões IAM necessárias na Service Account da VM:**

| Role | Finalidade |
|---|---|
| `roles/secretmanager.secretAccessor` | Ler versões do secret |
| `roles/secretmanager.secretVersionAdder` | Adicionar novas versões (salvar sessão atualizada) |
| `roles/logging.logWriter` | Gravar logs no Cloud Logging (opcional) |

---

## 7. CONSIDERAÇÕES DE DEPLOYMENT

### Ambientes

| Ambiente | Descrição | Branch Git |
|---|---|---|
| **Desenvolvimento** | Máquina local do desenvolvedor, variáveis via `.env`, log em `debug` | `develop` ou feature branch |
| **Produção** | VM GCP Compute Engine, variáveis via `/etc/environment`, log em `warn` | `main` |

> Não há ambiente de staging definido nesta versão. Avaliar criação conforme crescimento do projeto.

### Variáveis de Ambiente

Arquivo `.env.example` (nunca commitar o `.env` real):

```env
# Ambiente
NODE_ENV=development

# GCP
GCP_PROJECT_ID=seu-projeto-gcp-aqui
SECRET_NAME=whatsapp-baileys-session

# WhatsApp
PHONE_NUMBER=5511999999999

# Servidor HTTP
PORT=3000

# Logging
LOG_LEVEL=warn
```

### Scripts de Deploy (manual)

```bash
# 1. Conectar na VM
gcloud compute ssh NOME_DA_VM --zone=ZONA

# 2. Atualizar código
cd /opt/whatsapp-server
git pull origin main

# 3. Instalar dependências do backend (se necessário)
npm install

# 4. Rebuildar frontend (se houver alterações)
cd frontend && npm install && npm run build && cd ..

# 5. Recarregar processo sem downtime
pm2 reload whatsapp-app

# 6. Verificar status
pm2 status
pm2 logs whatsapp-app --lines 50
```

### Configuração PM2 — `ecosystem.config.cjs`

```js
module.exports = {
  apps: [{
    name:         'whatsapp-app',
    script:       './src/index.js',
    interpreter:  'node',
    env: {
      NODE_ENV:       'production',
      GCP_PROJECT_ID: 'seu-projeto-gcp',
      SECRET_NAME:    'whatsapp-baileys-session',
      PHONE_NUMBER:   '5511999999999',
      PORT:           '3000',
      LOG_LEVEL:      'warn',
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

### Backup e Rollback

- **Sessão WhatsApp:** Versionada automaticamente pelo Secret Manager. Rollback via GCP Console (reativar versão anterior do secret)
- **Código:** Versionado via Git. Rollback via `git checkout <tag>` + `pm2 reload`
- **Não há banco de dados** para backup nesta versão

---

## 8. DEPENDÊNCIAS E PRÉ-REQUISITOS

### Versões de Runtime

| Tecnologia | Versão Mínima | Recomendada |
|---|---|---|
| Node.js | 18 | **20 LTS** |
| npm | 8 | 10 |

### Configuração Inicial da VM (primeiro deploy)

```bash
# 1. Node.js 20 (Debian/Ubuntu)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. PM2
sudo npm install -g pm2

# 3. Clonar repositório
git clone https://github.com/SEU_USER/whatsapp-server.git /opt/whatsapp-server
cd /opt/whatsapp-server

# 4. Instalar dependências do backend
npm install

# 5. Build do frontend
cd frontend && npm install && npm run build && cd ..

# 6. Configurar variável de ambiente do projeto
echo 'GCP_PROJECT_ID=seu-projeto-id' | sudo tee -a /etc/environment

# 7. Iniciar com PM2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # configura autostart após reboot da VM
```

### Serviços Externos Dependentes

| Serviço | Obrigatório | Finalidade |
|---|---|---|
| Google Cloud Platform | Sim | Hospedagem (Compute Engine) |
| Google Secret Manager | Sim | Armazenamento da sessão WhatsApp |
| WhatsApp Web (Meta) | Sim | Protocolo de mensagens |
| npm registry | Apenas no deploy | Download de dependências |

### Limites e Quotas a Considerar

| Item | Limite / Observação |
|---|---|
| Secret Manager — versões | Sem limite de versões; versões antigas podem ser destruídas manualmente para economizar armazenamento |
| Secret Manager — requests | 10.000 requests/mês gratuitos (free tier); escrita frequente deve usar cache + debounce |
| Baileys — sessão única | Uma conta WhatsApp por instância; múltiplas instâncias com a mesma sessão causam `connectionReplaced` |
| WhatsApp — rate limiting | Não enviar mensagens em massa; respeitar delays entre envios para evitar banimento da conta |
| Compute Engine — recursos | Sem requisitos mínimos especificados; e2-micro ou e2-small são suficientes para o volume estimado |

### Dependências npm (backend)

```json
{
  "dependencies": {
    "baileys":                      "^7.0.0",
    "@hapi/boom":                   "^10.0.0",
    "pino":                         "^9.0.0",
    "node-cache":                   "^5.1.2",
    "@google-cloud/secret-manager": "^5.0.0",
    "express":                      "^4.18.0"
  }
}
```

### Dependências npm (frontend)

```json
{
  "dependencies": {
    "react":     "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "vite":                  "^5.0.0",
    "@vitejs/plugin-react":  "^4.0.0",
    "tailwindcss":           "^3.0.0",
    "autoprefixer":          "^10.0.0",
    "postcss":               "^8.0.0"
  }
}
```

---

*Documento gerado com base em `docs/requirements.md` e `docs/referenceDoc.md`.*
*Revisar antes de iniciar o desenvolvimento. Decisões arquiteturais podem ser ajustadas conforme necessidades identificadas na implementação.*
