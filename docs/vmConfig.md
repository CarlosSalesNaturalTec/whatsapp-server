<!--
  Arquivo: docs/vm-config.md
  Descrição: Configuração recomendada da VM no GCP Compute Engine para executar o WhatsApp Server + Landing Page.
  Criado em: 2026-02-26
-->

# Configuração da VM — GCP Compute Engine

**Projeto:** WhatsApp Server + Landing Page
**Pré-requisito:** `gcloud` CLI instalado e autenticado com permissões de administrador do projeto

> Consulte [setup-gcp.md](./setup-gcp.md) para configuração de IAM e Secret Manager após provisionar a VM.

---

## 1. Especificações Recomendadas

### 1.1 Tipo de Máquina

| Cenário | Tipo | vCPU | RAM | Custo estimado/mês |
|---|---|---|---|---|
| Mínimo viável | `e2-micro` | 2 (shared) | 1 GB | ~$6 |
| **Recomendado** | **`e2-small`** | **2 (shared)** | **2 GB** | **~$13** |
| Com folga | `e2-medium` | 2 (shared) | 4 GB | ~$26 |

**Recomendação: `e2-small`**

A aplicação é composta por Node.js + Baileys (WebSocket direto, sem Selenium ou Chromium) + serve de arquivos estáticos React. O consumo de recursos é baixo — 2 GB de RAM oferecem margem confortável para o processo principal, PM2 e o SO, além de absorver eventuais picos.

> A configuração `max_memory_restart: '512M'` no `ecosystem.config.cjs` garante que o PM2 reinicie o processo caso ultrapasse 512 MB, operando dentro do limite da `e2-small`.

---

### 1.2 Sistema Operacional

| Opção | Image Family | Image Project |
|---|---|---|
| **Recomendado** | `debian-12` | `debian-cloud` |
| Alternativa | `ubuntu-2204-lts` | `ubuntu-os-cloud` |

Debian 12 é a opção mais enxuta e compatível com o script de instalação do Node.js 20+ via NodeSource (conforme [referenceDoc.md](./referenceDoc.md) seção 13.1).

---

### 1.3 Disco de Boot

| Atributo | Valor |
|---|---|
| **Tipo** | SSD Persistente Balanceado (`pd-balanced`) |
| **Tamanho** | 20 GB |

20 GB cobrem SO + Node.js + dependências npm + logs do PM2 com ampla folga para esta aplicação.

---

### 1.4 Região e Zona

| Atributo | Valor recomendado |
|---|---|
| **Região** | `southamerica-east1` (São Paulo) |
| **Zona** | `southamerica-east1-b` |

Menor latência para usuários brasileiros do WhatsApp e visitantes da Landing Page.

---

### 1.5 Rede

| Recurso | Configuração |
|---|---|
| **IP externo** | Estático (necessário para acesso consistente à Landing Page) |
| **Porta 80 (HTTP)** | Liberada para `0.0.0.0/0` |
| **Porta 443 (HTTPS)** | Liberada para `0.0.0.0/0` (preparação para SSL futuro) |
| **Porta 22 (SSH)** | Restrita ao IP de gerenciamento do administrador |

---

### 1.6 Service Account

Criar uma Service Account dedicada com permissões mínimas (princípio do menor privilégio):

| Role | Finalidade |
|---|---|
| `roles/secretmanager.secretAccessor` | Leitura da sessão WhatsApp no Secret Manager |
| `roles/secretmanager.secretVersionAdder` | Persistência de atualizações de sessão |
| `roles/logging.logWriter` | Gravação de logs no Cloud Logging *(opcional)* |

> Detalhes de criação e concessão de roles em [setup-gcp.md](./setup-gcp.md).

---

## 2. Criar a VM via gcloud

### 2.1 Pré-requisito: criar a Service Account

```bash
# Criar SA dedicada
gcloud iam service-accounts create whatsapp-server-sa \
    --display-name="WhatsApp Server Service Account" \
    --project=SEU_PROJECT_ID

# Conceder roles necessários (detalhado em setup-gcp.md)
SA_EMAIL="whatsapp-server-sa@SEU_PROJECT_ID.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding SEU_PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding SEU_PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/secretmanager.secretVersionAdder"
```

### 2.2 Criar a instância

```bash
gcloud compute instances create whatsapp-server \
    --zone=southamerica-east1-b \
    --machine-type=e2-small \
    --image-family=debian-12 \
    --image-project=debian-cloud \
    --boot-disk-size=20GB \
    --boot-disk-type=pd-balanced \
    --service-account=whatsapp-server-sa@SEU_PROJECT_ID.iam.gserviceaccount.com \
    --scopes=cloud-platform \
    --tags=http-server,https-server \
    --project=SEU_PROJECT_ID
```

### 2.3 Reservar IP externo estático

```bash
# Reservar endereço IP estático na mesma região
gcloud compute addresses create whatsapp-server-ip \
    --region=southamerica-east1 \
    --project=SEU_PROJECT_ID

# Associar o IP estático à VM
gcloud compute instances add-access-config whatsapp-server \
    --zone=southamerica-east1-b \
    --access-config-name="External NAT" \
    --address=$(gcloud compute addresses describe whatsapp-server-ip \
        --region=southamerica-east1 \
        --format="value(address)")
```

### 2.4 Criar regras de firewall

```bash
# Liberar HTTP (porta 80)
gcloud compute firewall-rules create allow-http \
    --allow=tcp:80 \
    --target-tags=http-server \
    --description="Allow HTTP traffic" \
    --project=SEU_PROJECT_ID

# Liberar HTTPS (porta 443)
gcloud compute firewall-rules create allow-https \
    --allow=tcp:443 \
    --target-tags=https-server \
    --description="Allow HTTPS traffic" \
    --project=SEU_PROJECT_ID
```

---

## 3. Configurar o Ambiente na VM

Após criar a instância, conecte-se via SSH e execute:

```bash
# Conectar via gcloud SSH
gcloud compute ssh whatsapp-server \
    --zone=southamerica-east1-b \
    --project=SEU_PROJECT_ID
```

```bash
# 1. Atualizar o sistema
sudo apt-get update && sudo apt-get upgrade -y

# 2. Instalar Node.js 20+ via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar instalação
node --version   # deve exibir v20.x.x ou superior
npm --version

# 3. Instalar PM2 globalmente
sudo npm install -g pm2

# 4. Configurar variável de ambiente do projeto GCP
echo 'GCP_PROJECT_ID=SEU_PROJECT_ID' | sudo tee -a /etc/environment
source /etc/environment

# 5. Clonar a aplicação
git clone https://github.com/seu-usuario/whatsapp-server.git /opt/whatsapp-server
cd /opt/whatsapp-server && npm install

# 6. Iniciar com PM2 usando ecosystem.config.cjs
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # configura autostart após reboot — copie e execute o comando gerado
```

---

## 4. Verificar o Deploy

```bash
# Status do processo no PM2
pm2 status

# Logs em tempo real
pm2 logs whatsapp-server

# Verificar IP externo da VM
gcloud compute instances describe whatsapp-server \
    --zone=southamerica-east1-b \
    --format="value(networkInterfaces[0].accessConfigs[0].natIP)"
```

Após a inicialização, acesse `http://IP_DA_VM` no browser para confirmar que a Landing Page está sendo servida.

---

## 5. Resumo da Configuração

| Item | Valor |
|---|---|
| **Tipo de máquina** | `e2-small` |
| **vCPU** | 2 (shared core) |
| **RAM** | 2 GB |
| **SO** | Debian 12 (Bookworm) |
| **Disco** | 20 GB SSD (`pd-balanced`) |
| **Região / Zona** | `southamerica-east1` / `southamerica-east1-b` |
| **IP externo** | Estático |
| **Firewall** | TCP 80, 443 abertos; 22 restrito |
| **Service Account** | Dedicada com roles mínimos |
| **Node.js** | 20+ (via NodeSource) |
| **Gerenciador de processos** | PM2 com `ecosystem.config.cjs` |
| **Custo estimado** | ~$13/mês (e2-small + disco + IP estático) |

---

*Consulte [setup-gcp.md](./setup-gcp.md) para configuração de IAM e Secret Manager.*
*Consulte [referenceDoc.md](./referenceDoc.md) para detalhes de configuração do Baileys e PM2.*
