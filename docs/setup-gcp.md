<!--
  Arquivo: docs/setup-gcp.md
  Descrição: Guia de configuração de permissões IAM e Secret Manager no GCP para a VM que executa o WhatsApp Server.
  Feature: feat-028 - Configurar permissões IAM no GCP para a Service Account da VM
  Criado em: 2026-02-26
-->

# Guia de Setup GCP — Permissões IAM e Secret Manager

**Projeto:** WhatsApp Server + Landing Page
**Feature:** feat-028
**Pré-requisito:** `gcloud` CLI instalado e autenticado com permissões de administrador do projeto

---

## 1. Pré-requisitos

Antes de executar os comandos abaixo, garanta que:

1. O **Google Cloud SDK** (`gcloud`) está instalado e atualizado:
   ```bash
   gcloud version
   # Se necessário, atualize:
   gcloud components update
   ```

2. Você está autenticado com uma conta que tem permissão de **Project IAM Admin** ou **Owner** no projeto GCP:
   ```bash
   gcloud auth login
   gcloud config set project SEU_PROJECT_ID
   ```

3. A **VM do Compute Engine** já foi criada e está rodando com uma Service Account associada.

4. As APIs necessárias estão habilitadas no projeto:
   ```bash
   # Habilitar Secret Manager API
   gcloud services enable secretmanager.googleapis.com

   # Confirmar que está ativa
   gcloud services list --enabled --filter="name:secretmanager"
   ```

---

## 2. Identificar a Service Account da VM

A VM do Compute Engine precisa de uma Service Account para autenticar-se automaticamente com o GCP (Application Default Credentials — ADC). Execute o comando abaixo para obter o e-mail da Service Account vinculada à VM:

```bash
# Substitua NOME_DA_VM e ZONA pelos valores reais
gcloud compute instances describe NOME_DA_VM \
    --zone=ZONA \
    --format="value(serviceAccounts[0].email)"
```

**Exemplo de saída:**
```
123456789-compute@developer.gserviceaccount.com
```

> ⚠️ **Atenção:** Se o comando retornar vazio, a VM não possui Service Account configurada. Nesse caso, associe uma antes de continuar:
> ```bash
> # Criar uma Service Account dedicada (recomendado)
> gcloud iam service-accounts create whatsapp-server-sa \
>     --display-name="WhatsApp Server Service Account"
>
> # Associar à VM (requer parada temporária da instância)
> gcloud compute instances stop NOME_DA_VM --zone=ZONA
> gcloud compute instances set-service-account NOME_DA_VM \
>     --zone=ZONA \
>     --service-account=whatsapp-server-sa@SEU_PROJECT_ID.iam.gserviceaccount.com \
>     --scopes=cloud-platform
> gcloud compute instances start NOME_DA_VM --zone=ZONA
> ```

Salve o e-mail da Service Account — ele será usado em todos os comandos a seguir. Referenciamos como `SA_EMAIL` neste documento.

---

## 3. Conceder Permissões IAM

### 3.1 Role: `roles/secretmanager.secretAccessor`

Permite que a VM **leia** versões de secrets no Secret Manager. É obrigatório para que a aplicação carregue as credenciais da sessão WhatsApp ao iniciar.

```bash
gcloud projects add-iam-policy-binding SEU_PROJECT_ID \
    --member="serviceAccount:SA_EMAIL" \
    --role="roles/secretmanager.secretAccessor"
```

**Exemplo com valores reais:**
```bash
gcloud projects add-iam-policy-binding meu-projeto-gcp \
    --member="serviceAccount:123456789-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

---

### 3.2 Role: `roles/secretmanager.secretVersionAdder`

Permite que a VM **adicione novas versões** a secrets existentes. É obrigatório para que a aplicação persista atualizações da sessão WhatsApp (evento `creds.update` do Baileys).

```bash
gcloud projects add-iam-policy-binding SEU_PROJECT_ID \
    --member="serviceAccount:SA_EMAIL" \
    --role="roles/secretmanager.secretVersionAdder"
```

---

### 3.3 Role: `roles/logging.logWriter` *(opcional)*

Permite que a VM grave logs no **Cloud Logging**. Recomendado para centralizar os logs do PM2 e da aplicação no console GCP.

```bash
gcloud projects add-iam-policy-binding SEU_PROJECT_ID \
    --member="serviceAccount:SA_EMAIL" \
    --role="roles/logging.logWriter"
```

---

### 3.4 Script completo — conceder todos os roles de uma vez

```bash
#!/bin/bash
# setup-iam.sh
# Uso: ./setup-iam.sh SEU_PROJECT_ID SA_EMAIL

PROJECT_ID=$1
SA_EMAIL=$2

if [ -z "$PROJECT_ID" ] || [ -z "$SA_EMAIL" ]; then
  echo "Uso: $0 <PROJECT_ID> <SA_EMAIL>"
  exit 1
fi

echo "Concedendo roles à Service Account: $SA_EMAIL"
echo "Projeto: $PROJECT_ID"
echo "---"

# Role obrigatório: leitura de secrets
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/secretmanager.secretAccessor" \
    && echo "✓ secretAccessor concedido"

# Role obrigatório: criação de versões de secrets
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/secretmanager.secretVersionAdder" \
    && echo "✓ secretVersionAdder concedido"

# Role opcional: gravação de logs
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/logging.logWriter" \
    && echo "✓ logWriter concedido"

echo "---"
echo "Setup IAM concluído."
```

**Como executar:**
```bash
chmod +x setup-iam.sh
./setup-iam.sh meu-projeto-gcp 123456789-compute@developer.gserviceaccount.com
```

---

## 4. Criar o Secret no Secret Manager

O secret `whatsapp-baileys-auth` armazenará o estado de autenticação da sessão WhatsApp. Deve ser criado **antes** da primeira execução da aplicação.

### 4.1 Criar o secret com replicação automática

```bash
gcloud secrets create whatsapp-baileys-auth \
    --replication-policy="automatic"
```

> **Replication policy `automatic`:** O GCP gerencia automaticamente a replicação entre regiões, garantindo disponibilidade e durabilidade. Não é necessário especificar regiões manualmente para este caso de uso.

### 4.2 Verificar que o secret foi criado

```bash
gcloud secrets describe whatsapp-baileys-auth
```

**Saída esperada:**
```yaml
createTime: '2026-02-26T00:00:00Z'
etag: '"..."'
name: projects/SEU_PROJECT_ID/secrets/whatsapp-baileys-auth
replication:
  automatic: {}
```

### 4.3 Verificar se o nome do secret bate com o .env

Confirme que a variável `SECRET_NAME` no seu `.env` (ou no `ecosystem.config.cjs`) corresponde exatamente ao nome criado:

```env
SECRET_NAME=whatsapp-baileys-auth
```

---

## 5. Verificar as Permissões Concedidas

### 5.1 Listar roles da Service Account no projeto

```bash
gcloud projects get-iam-policy SEU_PROJECT_ID \
    --flatten="bindings[].members" \
    --format="table(bindings.role)" \
    --filter="bindings.members:SA_EMAIL"
```

**Saída esperada (ao menos):**
```
ROLE
roles/secretmanager.secretAccessor
roles/secretmanager.secretVersionAdder
```

### 5.2 Verificar acesso ao secret pela Service Account

Para testar que a Service Account tem acesso correto ao secret, você pode executar o comando abaixo **de dentro da VM** (onde as ADC estão configuradas automaticamente):

```bash
# Acesso à versão mais recente do secret (teste de leitura)
gcloud secrets versions access latest \
    --secret="whatsapp-baileys-auth" \
    --project="SEU_PROJECT_ID"
```

Se o secret ainda não possui versões (primeira execução), o comando retornará erro `NOT_FOUND` — isso é esperado. A aplicação criará a primeira versão automaticamente na autenticação inicial.

### 5.3 Testar permissão de escrita (adicionar versão de teste)

```bash
echo '{"test": true}' | gcloud secrets versions add whatsapp-baileys-auth \
    --data-file=- \
    --project="SEU_PROJECT_ID"
```

Se bem-sucedido, o comando exibirá o número da versão criada. Você pode remover a versão de teste em seguida:

```bash
# Listar versões
gcloud secrets versions list whatsapp-baileys-auth

# Destruir a versão de teste (substitua NUMERO pela versão listada)
gcloud secrets versions destroy NUMERO \
    --secret="whatsapp-baileys-auth"
```

---

## 6. Resumo das Configurações

| Item | Valor |
|---|---|
| **Secret Name** | `whatsapp-baileys-auth` |
| **Replication Policy** | `automatic` |
| **Role (obrigatório)** | `roles/secretmanager.secretAccessor` |
| **Role (obrigatório)** | `roles/secretmanager.secretVersionAdder` |
| **Role (opcional)** | `roles/logging.logWriter` |
| **Autenticação** | Application Default Credentials (ADC) — automático na VM |

---

## 7. Troubleshooting

### Erro: `PERMISSION_DENIED` ao acessar o Secret Manager

**Causa:** A Service Account não possui o role `secretmanager.secretAccessor` ou o role ainda não propagou.

**Solução:**
1. Confirme que o role foi concedido (seção 5.1).
2. Aguarde até 2 minutos para propagação das políticas IAM.
3. Verifique se a API do Secret Manager está habilitada (seção 1).

---

### Erro: `NOT_FOUND` ao tentar adicionar versão ao secret

**Causa:** O secret `whatsapp-baileys-auth` não existe no projeto.

**Solução:** Execute o comando de criação do secret (seção 4.1). A aplicação também cria automaticamente o secret se ele não existir, desde que a Service Account tenha o role `secretmanager.secretVersionAdder`.

---

### Erro: `RESOURCE_EXHAUSTED` ou throttling no Secret Manager

**Causa:** Muitas versões sendo adicionadas em curto período. O Secret Manager tem limite de 10.000 requests/mês no free tier.

**Solução:**
- O debounce implementado na feature `feat-012` (3 segundos) reduz drasticamente a frequência de escrita.
- Se necessário, destrua versões antigas do secret para manter o histórico enxuto:
  ```bash
  # Listar versões
  gcloud secrets versions list whatsapp-baileys-auth --limit=20

  # Destruir versões antigas (mantenha apenas as últimas 2-3)
  gcloud secrets versions destroy NUMERO --secret="whatsapp-baileys-auth"
  ```

---

### A VM não encontra ADC (Application Default Credentials)

**Causa:** A VM foi iniciada sem Service Account ou o escopo `cloud-platform` não foi configurado.

**Solução:** Associe a Service Account à VM conforme descrito na seção 2 e garanta que o escopo `cloud-platform` está habilitado.

---

*Documento gerado para o projeto WhatsApp Server + Landing Page.*
*Consulte `docs/contextDoc.md` para detalhes da arquitetura e `docs/requirements.md` para os requisitos de segurança.*
