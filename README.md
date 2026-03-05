# WhatsApp Server + Landing Page

Servidor Node.js monolítico hospedado em GCP Compute Engine que gerencia um **bot WhatsApp** via Baileys v7 com sessão persistida no Google Secret Manager e serve uma **Landing Page** React estática no mesmo processo.

---

## Sumário

- [Visão Geral](#visão-geral)
- [Stack Tecnológica](#stack-tecnológica)
- [Pré-requisitos](#pré-requisitos)
- [Setup GCP](#setup-gcp)
- [Instalação na VM](#instalação-na-vm)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Iniciar a Aplicação](#iniciar-a-aplicação)
- [Comandos de Operação](#comandos-de-operação)
- [Deploy (Atualização de Código)](#deploy-atualização-de-código)
- [API WhatsApp](#api-whatsapp)
- [Verificação de Saúde](#verificação-de-saúde)
- [Troubleshooting](#troubleshooting)
- [Estrutura do Projeto](#estrutura-do-projeto)

---

## Visão Geral

```
┌────────────────────────────────────────────────────┐
│              GCP Compute Engine (VM)               │
│                                                    │
│  ┌─────────────────────────────────────────────┐   │
│  │          Processo Node.js (PM2)             │   │
│  │                                             │   │
│  │  ConnectionManager  │  Express HTTP         │   │
│  │  (Baileys v7)       │  porta 3000           │   │
│  │                     │                       │   │
│  │                     │  GET  /               │   │
│  │                     │  GET  /configuracoes  │   │
│  │                     │  GET  /health         │   │
│  │                     │  GET  /api/whatsapp/status  │
│  │                     │  GET  /api/whatsapp/config  │
│  │                     │  POST /api/whatsapp/connect │
│  │                     │  POST /api/whatsapp/disconnect │
│  └─────────────────────────────────────────────┘   │
│                     │                              │
│  ┌──────────────────────────┐                      │
│  │   Google Secret Manager  │                      │
│  │   (sessão WhatsApp)      │                      │
│  └──────────────────────────┘                      │
└────────────────────────────────────────────────────┘
```

**Funcionalidades principais:**
- Servidor HTTP sobe imediatamente — WhatsApp **não** é conectado no boot
- Autenticação WhatsApp por Pairing Code acionada via **página de configurações** (`/configuracoes`)
- Auto-reconexão no boot quando há sessão válida salva no Secret Manager
- Sessão persistida de forma segura no Google Secret Manager
- Reconexão automática com **backoff exponencial** em caso de queda de conexão (5s → 10s → 20s → … → 5min), com circuit breaker após 10 tentativas consecutivas sem sucesso
- Resposta automática ao comando `#iniciarBot#` com a mensagem `Bot Iniciado`
- Landing Page React servida pelo mesmo processo na rota raiz `/`
- Endpoint `/health` para monitoramento de disponibilidade

---

## Stack Tecnológica

| Componente | Tecnologia | Versão |
|---|---|---|
| Runtime | Node.js | 20 LTS |
| Módulos | ESM (`"type": "module"`) | — |
| Bot WhatsApp | Baileys | 7.x |
| Servidor HTTP | Express.js | 5.x |
| Logger | pino | 9.x |
| Gerenciamento de processos | PM2 | latest |
| Segredos | Google Secret Manager | 5.x |
| Frontend | React + Vite + Tailwind CSS | 18 / 5 / 3 |
| Infraestrutura | GCP Compute Engine | — |

---

## Pré-requisitos

Antes de iniciar, garanta que os itens abaixo estão disponíveis:

### Locais (máquina do desenvolvedor)
- **Git** instalado e configurado
- **Google Cloud SDK (`gcloud`)** instalado e autenticado:
  ```bash
  gcloud auth login
  gcloud config set project SEU_PROJECT_ID
  ```

### Na VM (GCP Compute Engine)
- **Node.js 20 LTS** (instalado na seção [Instalação na VM](#instalação-na-vm))
- **PM2** (instalado na seção [Instalação na VM](#instalação-na-vm))
- Acesso SSH via `gcloud compute ssh`

### GCP
- Projeto GCP criado com faturamento ativo
- API do Secret Manager habilitada
- VM do Compute Engine criada com Service Account associada
- Permissões IAM configuradas (ver [Setup GCP](#setup-gcp))

---

## Setup GCP

Configure as permissões IAM e o Secret Manager **antes** do primeiro deploy. Consulte o guia completo em:

```
docs/setup-gcp.md
```

Resumo do que precisa estar configurado (PowerShell):

```powershell
# Definir variáveis — substitua pelos valores reais
$PROJECT_ID = "SEU_PROJECT_ID"
$SA_EMAIL   = "SA_EMAIL"

# 1. Habilitar a API do Secret Manager
gcloud services enable secretmanager.googleapis.com

# 2. Conceder roles à Service Account da VM
gcloud projects add-iam-policy-binding $PROJECT_ID `
    --member="serviceAccount:$SA_EMAIL" `
    --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding $PROJECT_ID `
    --member="serviceAccount:$SA_EMAIL" `
    --role="roles/secretmanager.secretVersionAdder"

gcloud projects add-iam-policy-binding $PROJECT_ID `
    --member="serviceAccount:$SA_EMAIL" `
    --role="roles/secretmanager.secretVersionManager"

# 3. Criar o secret para a sessão WhatsApp
gcloud secrets create whatsapp-baileys-auth `
    --replication-policy="automatic" `
    --project=$PROJECT_ID
```

> Para instruções detalhadas e troubleshooting, acesse `docs/setup-gcp.md`.

---

## Instalação na VM

Conecte-se à VM via SSH e execute os passos abaixo. **Execute apenas na primeira vez.**

### Passo 1 — Conectar à VM

```powershell
# PowerShell local
gcloud compute ssh NOME_DA_VM `
    --zone=southamerica-east1-a `
    --project=$PROJECT_ID
```

### Passo 2 — Instalar Node.js 20 LTS

```bash
# Adicionar repositório oficial Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Instalar Node.js e npm
sudo apt-get install -y nodejs

# Verificar instalação
node --version   # Deve exibir v20.x.x
npm --version    # Deve exibir 10.x.x
```

### Passo 3 — Instalar PM2 globalmente

```bash
sudo npm install -g pm2

# Verificar instalação
pm2 --version
```

### Passo 4 — Clonar o repositório

```bash
# Clonar na pasta de aplicações
git clone https://github.com/SEU_USUARIO/whatsapp-server.git /opt/whatsapp-server
cd /opt/whatsapp-server
```

### Passo 5 — Instalar dependências do backend

```bash
npm install
```

### Passo 6 — Instalar dependências e gerar build do frontend

```bash
# Usando o script unificado do package.json raiz
npm run build:frontend
```

Este comando entra em `frontend/`, instala as dependências e gera o build de produção em `frontend/dist/`.

### Passo 7 — Configurar variáveis de ambiente da VM

Na VM, adicione as variáveis ao `/etc/environment` para que estejam disponíveis ao PM2:

```bash
# Editar o arquivo de variáveis de ambiente do sistema
sudo nano /etc/environment
```

Adicione as linhas abaixo (substituindo pelos valores reais):

```
GCP_PROJECT_ID="seu-projeto-gcp-id"
SECRET_NAME="whatsapp-baileys-auth"
PHONE_NUMBER="5511999999999"
PORT="3000"
LOG_LEVEL="warn"
NODE_ENV="production"
```

Recarregue as variáveis:

```bash
source /etc/environment
```

> **Alternativa:** Configure diretamente no `ecosystem.config.cjs` (ver seção [Variáveis de Ambiente](#variáveis-de-ambiente)).

---

## Variáveis de Ambiente

Consulte o arquivo `.env.example` para a lista completa e documentada. Para desenvolvimento local, copie-o:

```bash
cp .env.example .env
# Edite .env com seus valores reais (nunca commite este arquivo)
nano .env
```

| Variável | Obrigatória | Descrição | Exemplo |
|---|---|---|---|
| `NODE_ENV` | Sim | Ambiente de execução | `production` |
| `GCP_PROJECT_ID` | Sim | ID do projeto GCP | `meu-projeto-123` |
| `SECRET_NAME` | Sim | Nome do secret no Secret Manager | `whatsapp-baileys-auth` |
| `PHONE_NUMBER` | Sim | Número WhatsApp em formato E.164 sem `+` | `5511999999999` |
| `PORT` | Não | Porta HTTP do servidor Express | `3000` |
| `LOG_LEVEL` | Não | Nível de log (pino) | `warn` |

---

## Iniciar a Aplicação

### Primeira inicialização com PM2

```bash
cd /opt/whatsapp-server

# Iniciar usando o arquivo de configuração do PM2
pm2 start ecosystem.config.cjs

# Salvar a lista de processos para sobreviver a reboots
pm2 save

# Configurar PM2 para iniciar automaticamente após reboot da VM
pm2 startup
# Execute o comando que o PM2 sugerir na saída (começa com "sudo env PATH=...")
```

### Autenticação inicial do WhatsApp (Pairing Code via página de configurações)

O Pairing Code **não é mais gerado automaticamente no boot**. A conexão WhatsApp é iniciada sob demanda pelo administrador pela página de configurações.

**Comportamento no boot:**
- Se houver sessão válida salva no Secret Manager → reconecta automaticamente (sem ação do usuário)
- Se não houver sessão (primeira vez) → servidor HTTP sobe normalmente, WhatsApp permanece desconectado

**Para vincular a conta na primeira execução:**

1. Acesse `http://IP_DA_VM:3000/configuracoes` no browser
2. Verifique que o número pré-preenchido está correto (carregado da variável `PHONE_NUMBER`)
3. Clique em **Solicitar Pairing Code**
4. Aguarde o código aparecer na tela (status: *Aguardando pareamento*)
5. No celular: **WhatsApp → Configurações → Dispositivos Vinculados → Vincular com número de telefone**
6. Insira o código exibido na tela

Após a autenticação bem-sucedida, a sessão é salva automaticamente no Secret Manager. Nas próximas inicializações, a reconexão ocorrerá sem necessidade de novo código.

> **Diagnóstico via log:** Se precisar confirmar o Pairing Code nos logs da VM:
> ```bash
> pm2 logs whatsapp-app --lines 50
> # Procure pela linha: [Manager] Pairing Code disponível para o usuário
> ```

---

## Comandos de Operação

### Status e monitoramento

```bash
# Ver status de todos os processos PM2
pm2 status

# Ver status detalhado do processo específico
pm2 show whatsapp-app

# Monitorar CPU e memória em tempo real
pm2 monit
```

### Logs

```bash
# Exibir últimas linhas dos logs (stdout + stderr)
pm2 logs whatsapp-app --lines 100

# Seguir logs em tempo real
pm2 logs whatsapp-app

# Logs apenas de erro
pm2 logs whatsapp-app --err

# Limpar logs acumulados
pm2 flush whatsapp-app
```

Arquivos de log em `/var/log/pm2/`:
- `whatsapp-out.log` — saída padrão
- `whatsapp-error.log` — erros

### Reiniciar / Recarregar

```bash
# Reload sem downtime (recomendado para atualizações)
pm2 reload whatsapp-app

# Restart forçado (encerra e reinicia o processo)
pm2 restart whatsapp-app

# Parar o processo
pm2 stop whatsapp-app

# Iniciar processo parado
pm2 start whatsapp-app
```

### Gerenciamento de processos

```bash
# Remover processo da lista do PM2
pm2 delete whatsapp-app

# Listar todos os processos gerenciados
pm2 list

# Salvar estado atual dos processos
pm2 save
```

---

## Deploy (Atualização de Código)

Para atualizar a aplicação com novas versões do código:

```powershell
# 1. Conectar à VM (PowerShell local)
gcloud compute ssh NOME_DA_VM `
    --zone=southamerica-east1-a `
    --project=$PROJECT_ID
```

```bash
# 2. Navegar para o diretório da aplicação (dentro da VM — Linux)
cd /opt/whatsapp-server

# 3. Atualizar código
git pull origin main

# 4. Instalar novas dependências do backend (se houver)
npm install

# 5. Rebuildar o frontend (se houver alterações em frontend/)
npm run build:frontend

# 6. Recarregar o processo sem downtime
pm2 reload whatsapp-app

# 7. Verificar que está rodando corretamente
pm2 status
pm2 logs whatsapp-app --lines 30
```

### Rollback

```bash
# Voltar para um commit ou tag específico
git checkout v1.0.0   # ou o hash do commit

# Rebuildar se necessário
npm install
npm run build:frontend

# Recarregar
pm2 reload whatsapp-app
```

> **Sessão WhatsApp:** Versionada automaticamente pelo Secret Manager. Para rollback da sessão, reative uma versão anterior via GCP Console: **Secret Manager → whatsapp-baileys-auth → Versões**.

---

## API WhatsApp

Endpoints REST expostos pelo servidor para gerenciamento da conexão. Consumidos internamente pela página de configurações (`/configuracoes`).

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/whatsapp/status` | Status atual + pairing code (usado em polling a cada 2s) |
| `GET` | `/api/whatsapp/config` | Número pré-configurado (`PHONE_NUMBER` da env) |
| `POST` | `/api/whatsapp/connect` | Inicia conexão / solicita pairing code |
| `POST` | `/api/whatsapp/disconnect` | Encerra conexão ativa |

**Estados possíveis em `/api/whatsapp/status`:**

| Status | Significado |
|---|---|
| `disconnected` | Nenhuma conexão ativa |
| `connecting` | Socket criado, aguardando resposta do servidor WhatsApp |
| `awaiting_pairing` | Pairing code gerado — aguardando o usuário inserir no celular |
| `connected` | Sessão autenticada e ativa |
| `error` | Falha crítica — `GCP_PROJECT_ID` ausente **ou** circuit breaker acionado após 10 tentativas de reconexão sem sucesso |

---

## Verificação de Saúde

### Endpoint /health

```bash
# Verificar que o servidor HTTP está respondendo (da própria VM)
curl http://localhost:3000/health

# Resposta esperada:
# {"status":"ok","timestamp":"2026-02-26T00:00:00.000Z","uptime":12345.67}
```

### Verificar Landing Page e Página de Configurações

Acesse via browser o IP externo da VM:

```
http://IP_EXTERNO_DA_VM:3000               → Landing Page
http://IP_EXTERNO_DA_VM:3000/configuracoes → Página de configurações (conexão WhatsApp)
```

Para obter o IP externo da VM:

```powershell
gcloud compute instances describe NOME_DA_VM `
    --zone=southamerica-east1-a `
    --project=$PROJECT_ID `
    --format="value(networkInterfaces[0].accessConfigs[0].natIP)"
```

### Teste do bot WhatsApp

1. Envie a mensagem `#iniciarBot#` para o número WhatsApp conectado
2. A resposta `Bot Iniciado` deve chegar em poucos segundos
3. Confirme no log:
   ```bash
   pm2 logs whatsapp-app --lines 20
   ```

---

## Troubleshooting

### A aplicação não inicia — erro de variável de ambiente

**Sintoma:** Log exibe `undefined` para `GCP_PROJECT_ID` ou similar.

**Solução:**
```bash
# Verificar se as variáveis estão disponíveis na sessão SSH
echo $GCP_PROJECT_ID

# Se vazio, recarregar o /etc/environment
source /etc/environment

# Restartar o processo PM2
pm2 restart whatsapp-app
```

---

### Pairing Code não aparece na página de configurações

**Sintoma:** Clicou em "Solicitar Pairing Code" mas o status não avança ou o código não aparece.

**Verificações:**

1. Confirme que a requisição chegou ao backend:
   ```bash
   pm2 logs whatsapp-app --lines 30
   # Deve aparecer: [Route] POST /api/whatsapp/connect
   # Deve aparecer: [Manager] Pairing Code disponível para o usuário
   ```

2. Se o log não aparecer, verifique o nível de log (deve ser `info` ou `debug`):
   ```bash
   # Alterar temporariamente no ecosystem.config.cjs: LOG_LEVEL: 'info'
   pm2 restart whatsapp-app
   ```

3. Verifique se o `GCP_PROJECT_ID` está definido — sem ele o auth state falha silenciosamente:
   ```bash
   echo $GCP_PROJECT_ID
   ```

**Teste manual da API:**
```bash
curl -X POST http://localhost:3000/api/whatsapp/connect \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"5511999999999"}'
# Resposta esperada: 202 Accepted

curl http://localhost:3000/api/whatsapp/status
# Deve retornar status: "awaiting_pairing" com o pairingCode
```

---

### Erro `PERMISSION_DENIED` no Secret Manager

**Sintoma:** Log exibe `PERMISSION_DENIED` ao tentar acessar o secret.

**Solução:** A Service Account da VM não possui as permissões necessárias. Consulte a seção [Setup GCP](#setup-gcp) e o guia `docs/setup-gcp.md`.

---

### Erro `ACCESS_TOKEN_SCOPE_INSUFFICIENT` no Secret Manager

**Sintoma:** Log exibe `Request had insufficient authentication scopes` ou `ACCESS_TOKEN_SCOPE_INSUFFICIENT`.

**Causa:** A VM foi criada sem o OAuth scope `cloud-platform`. Os roles IAM podem estar corretos, mas o token gerado pela VM não tem autorização para chamar o Secret Manager.

**Solução (PowerShell local):**
```powershell
$VM   = "NOME_DA_VM"
$ZONE = "southamerica-east1-a"

gcloud compute instances stop $VM --zone=$ZONE --project=$PROJECT_ID
gcloud compute instances set-service-account $VM `
    --zone=$ZONE `
    --scopes=cloud-platform `
    --project=$PROJECT_ID
gcloud compute instances start $VM --zone=$ZONE --project=$PROJECT_ID
```

> **Prevenção:** Sempre crie a VM com `--scopes=cloud-platform` (ver `docs/vmConfig.md` seção 2.2).

---

### Bot para de responder após algum tempo

**Sintoma:** Mensagens chegam mas não há resposta automática.

**Solução:**
```bash
# Verificar se o processo está vivo e o status da conexão
pm2 status
curl http://localhost:3000/api/whatsapp/status

# Verificar erros recentes
pm2 logs whatsapp-app --err --lines 50
```

**Causas possíveis:**

| Status retornado | Causa | Ação |
|---|---|---|
| `disconnected` | Queda momentânea — reconexão em andamento com backoff | Aguardar; acompanhar logs |
| `error` (circuit breaker) | 10 tentativas de reconexão sem sucesso | Acesse `/configuracoes` → **Conectar** |
| `error` (loggedOut) | Sessão revogada pelo usuário no celular (código 401) | Acesse `/configuracoes` → **Solicitar Pairing Code** |

```bash
# Confirmar circuit breaker nos logs:
pm2 logs whatsapp-app --lines 30
# Procure: [Manager] Circuit breaker acionado — muitas tentativas sem sucesso

# Confirmar loggedOut nos logs:
# Procure: [Manager] Sessão encerrada (loggedOut) — aguardando ação do usuário
```

---

### Timeout na sincronização inicial (contas com histórico grande)

**Sintoma:** Log exibe `Query timed out` ou `Connection Failure` logo após o boot, especialmente nas primeiras tentativas de reconexão.

**Causa:** O `defaultQueryTimeoutMs` padrão é `60s`. Contas com milhares de chats ou ambientes com alta latência (ex: VM em região distante dos servidores WA) podem exceder esse limite durante a sincronização inicial.

**Solução:** Aumentar o timeout em `src/bot/connection.js`:

```javascript
defaultQueryTimeoutMs: 120_000,  // aumentar de 60s para 120s
```

> Recomendado especialmente ao migrar a VM para uma nova região (ex: `southamerica-east1`), momento em que a latência até os servidores do WhatsApp pode ser diferente.

---

### Porta 3000 já em uso

**Sintoma:** Erro `EADDRINUSE` ao iniciar.

**Solução:**
```bash
# Identificar processo usando a porta
sudo lsof -i :3000

# Encerrar o processo conflitante ou alterar PORT no ecosystem.config.cjs
pm2 reload whatsapp-app
```

---

## Estrutura do Projeto

```
whatsapp-server/
│
├── src/                              # Código-fonte do backend/bot
│   ├── index.js                      # Entry point — inicia HTTP + tryAutoConnect()
│   ├── bot/
│   │   ├── connectionManager.js      # Singleton: ciclo de vida da conexão WhatsApp
│   │   ├── connection.js             # Fábrica do socket Baileys (aceita callbacks)
│   │   ├── auth/
│   │   │   └── secretManagerAuthState.js   # Auth state com Secret Manager
│   │   └── handlers/
│   │       └── messageHandler.js     # Processamento de mensagens recebidas
│   ├── server/
│   │   ├── index.js                  # App Express + arquivos estáticos
│   │   └── routes/
│   │       ├── health.js             # GET /health
│   │       └── whatsapp.js           # GET|POST /api/whatsapp/*
│   └── utils/
│       └── logger.js                 # Instância pino configurada
│
├── frontend/                         # Landing Page + Configurações (React + Vite + Tailwind)
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx                   # Roteamento SPA (/ e /configuracoes)
│   │   ├── components/               # Header, Footer, seções da Landing Page
│   │   └── pages/
│   │       └── Settings.jsx          # Página de configurações — gerencia conexão WhatsApp
│   ├── dist/                         # Build de produção (gerado, não versionado)
│   └── package.json
│
├── docs/                             # Documentação
│   ├── requirements.md               # Requisitos funcionais
│   ├── contextDoc.md                 # Arquitetura e padrões
│   ├── referenceDoc.md               # Referências técnicas
│   ├── setup-gcp.md                  # Guia IAM e Secret Manager
│   └── vmConfig.md                   # Configuração da VM no GCP
│
├── ecosystem.config.cjs              # Configuração PM2
├── .env.example                      # Modelo de variáveis de ambiente
├── .gitignore
└── package.json                      # Dependências do backend
```

---

*Projeto: WhatsApp Server + Landing Page — v1.0.0*
*Para questões de segurança e arquitetura, consulte `docs/contextDoc.md` e `docs/requirements.md`.*
