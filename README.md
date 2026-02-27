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
- [Verificação de Saúde](#verificação-de-saúde)
- [Troubleshooting](#troubleshooting)
- [Estrutura do Projeto](#estrutura-do-projeto)

---

## Visão Geral

```
┌─────────────────────────────────────────┐
│         GCP Compute Engine (VM)         │
│                                         │
│  ┌──────────────────────────────────┐   │
│  │       Processo Node.js (PM2)     │   │
│  │                                  │   │
│  │  WhatsApp Bot  │  Express HTTP   │   │
│  │  (Baileys v7)  │  porta 3000     │   │
│  └──────────────────────────────────┘   │
│                │                        │
│  ┌─────────────────────┐               │
│  │  Google Secret Mgr  │               │
│  │  (sessão WhatsApp)  │               │
│  └─────────────────────┘               │
└─────────────────────────────────────────┘
```

**Funcionalidades principais:**
- Autenticação WhatsApp por Pairing Code (sem QR Code)
- Sessão persistida de forma segura no Google Secret Manager
- Reconexão automática em caso de queda de conexão
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

Resumo do que precisa estar configurado:

```bash
# 1. Habilitar a API do Secret Manager
gcloud services enable secretmanager.googleapis.com

# 2. Conceder roles à Service Account da VM
gcloud projects add-iam-policy-binding SEU_PROJECT_ID \
    --member="serviceAccount:SA_EMAIL" \
    --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding SEU_PROJECT_ID \
    --member="serviceAccount:SA_EMAIL" \
    --role="roles/secretmanager.secretVersionAdder"

# 3. Criar o secret para a sessão WhatsApp
gcloud secrets create whatsapp-baileys-session \
    --replication-policy="automatic"
```

> Para instruções detalhadas e troubleshooting, acesse `docs/setup-gcp.md`.

---

## Instalação na VM

Conecte-se à VM via SSH e execute os passos abaixo. **Execute apenas na primeira vez.**

### Passo 1 — Conectar à VM

```bash
gcloud compute ssh NOME_DA_VM --zone=ZONA
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
SECRET_NAME="whatsapp-baileys-session"
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
| `SECRET_NAME` | Sim | Nome do secret no Secret Manager | `whatsapp-baileys-session` |
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

### Autenticação inicial do WhatsApp (Pairing Code)

Na primeira execução, a aplicação não possui sessão WhatsApp salva. Um **Pairing Code** será gerado automaticamente:

```bash
# Acompanhe os logs em tempo real
pm2 logs whatsapp-app --lines 50
```

Procure no log uma linha similar a:

```
INFO  Pairing Code: ABCD-1234
```

Para vincular a conta:
1. Abra o **WhatsApp** no celular
2. Acesse **Configurações → Dispositivos Vinculados → Vincular um Dispositivo**
3. Selecione **Vincular com número de telefone** e insira o código exibido no log

Após a autenticação bem-sucedida, a sessão será salva automaticamente no Secret Manager. Nas próximas inicializações, a reconexão ocorrerá sem necessidade de novo código.

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

```bash
# 1. Conectar à VM
gcloud compute ssh NOME_DA_VM --zone=ZONA

# 2. Navegar para o diretório da aplicação
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

> **Sessão WhatsApp:** Versionada automaticamente pelo Secret Manager. Para rollback da sessão, reative uma versão anterior via GCP Console: **Secret Manager → whatsapp-baileys-session → Versões**.

---

## Verificação de Saúde

### Endpoint /health

```bash
# Verificar que o servidor HTTP está respondendo (da própria VM)
curl http://localhost:3000/health

# Resposta esperada:
# {"status":"ok","timestamp":"2026-02-26T00:00:00.000Z","uptime":12345.67}
```

### Verificar Landing Page

Acesse via browser o IP externo da VM:

```
http://IP_EXTERNO_DA_VM:3000
```

Para obter o IP externo da VM:

```bash
gcloud compute instances describe NOME_DA_VM \
    --zone=ZONA \
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

### Pairing Code não aparece no log

**Sintoma:** A aplicação inicia mas nenhum Pairing Code é exibido.

**Solução:**
```bash
# Verificar nível de log (deve ser info ou debug para ver o código)
# Alterar temporariamente no ecosystem.config.cjs: LOG_LEVEL: 'info'
pm2 restart whatsapp-app
pm2 logs whatsapp-app --lines 50
```

---

### Erro `PERMISSION_DENIED` no Secret Manager

**Sintoma:** Log exibe `PERMISSION_DENIED` ao tentar acessar o secret.

**Solução:** A Service Account da VM não possui as permissões necessárias. Consulte a seção [Setup GCP](#setup-gcp) e o guia `docs/setup-gcp.md`.

---

### Bot para de responder após algum tempo

**Sintoma:** Mensagens chegam mas não há resposta automática.

**Solução:**
```bash
# Verificar se o processo está vivo
pm2 status

# Verificar erros recentes
pm2 logs whatsapp-app --err --lines 50

# Em caso de connectionReplaced (sessão usada em outro dispositivo)
# A aplicação NÃO reconecta automaticamente neste caso — reconecte manualmente:
pm2 restart whatsapp-app
```

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
│   ├── index.js                      # Entry point — inicializa bot + servidor HTTP
│   ├── bot/
│   │   ├── connection.js             # Conexão Baileys, Pairing Code, reconexão
│   │   ├── auth/
│   │   │   └── secretManagerAuthState.js   # Auth state com Secret Manager
│   │   └── handlers/
│   │       └── messageHandler.js     # Processamento de mensagens recebidas
│   ├── server/
│   │   ├── index.js                  # App Express + arquivos estáticos
│   │   └── routes/
│   │       └── health.js             # GET /health
│   └── utils/
│       └── logger.js                 # Instância pino configurada
│
├── frontend/                         # Landing Page (React + Vite + Tailwind)
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   └── components/
│   ├── dist/                         # Build de produção (gerado, não versionado)
│   └── package.json
│
├── docs/                             # Documentação
│   ├── requirements.md               # Requisitos funcionais
│   ├── contextDoc.md                 # Arquitetura e padrões
│   ├── referenceDoc.md               # Referências técnicas
│   └── setup-gcp.md                  # Guia IAM e Secret Manager
│
├── ecosystem.config.cjs              # Configuração PM2
├── .env.example                      # Modelo de variáveis de ambiente
├── .gitignore
└── package.json                      # Dependências do backend
```

---

*Projeto: WhatsApp Server + Landing Page — v1.0.0*
*Para questões de segurança e arquitetura, consulte `docs/contextDoc.md` e `docs/requirements.md`.*
