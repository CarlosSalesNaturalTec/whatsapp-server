# Documento de Requisitos — WhatsApp Server + Landing Page

**Versão:** 1.0
**Data:** 2026-02-25
**Status:** Em revisão

---

## 1. DESCRIÇÃO GERAL

### Propósito da Aplicação

A aplicação é um servidor Node.js hospedado em uma VM do Google Cloud Platform (Compute Engine) com dois propósitos integrados: **gerenciamento de mensagens do WhatsApp** e **hospedagem de uma Landing Page** institucional em React.

O módulo de WhatsApp utiliza a biblioteca **WhiskeySockets/Baileys** para conectar-se à conta WhatsApp via protocolo WebSocket, autenticando-se por **Pairing Code** (sem necessidade de escanear QR Code) e respondendo automaticamente a comandos recebidos via mensagem.

A Landing Page, servida pelo mesmo processo, aproveita a infraestrutura já ativa 24×7 da VM para disponibilizar uma interface moderna ao usuário final sem custo adicional de hospedagem.

### Problema que Resolve

- Elimina a necessidade de manter um dispositivo físico sempre ligado para gerenciar o WhatsApp
- Centraliza a automação de respostas em um ambiente controlado e seguro na nuvem
- Aproveita a VM já contratada para servir conteúdo web, evitando custos extras

### Valor Entregue

- Disponibilidade contínua (24×7) do bot de WhatsApp
- Segurança no armazenamento de credenciais via Google Secret Manager
- Interface web moderna disponível no mesmo endpoint do servidor
- Infraestrutura simples e consolidada em uma única VM

---

## 2. FUNCIONALIDADES PRINCIPAIS

### 2.1 Autenticação WhatsApp via Pairing Code

| Campo | Detalhe |
|---|---|
| **Descrição** | O servidor realiza a autenticação na conta WhatsApp usando Pairing Code gerado pela biblioteca Baileys, sem exibir QR Code. |
| **Prioridade** | Alta |

**Critérios de Aceitação:**
- [ ] O servidor gera um Pairing Code ao iniciar pela primeira vez sem sessão ativa
- [ ] O código é exibido no console/log para que o administrador o vincule manualmente ao WhatsApp
- [ ] Após autenticação, a sessão é persistida de forma segura (ver 2.2)
- [ ] Reconexão automática é realizada sem necessidade de novo Pairing Code enquanto a sessão for válida

---

### 2.2 Gerenciamento Seguro de Sessão com Google Secret Manager

| Campo | Detalhe |
|---|---|
| **Descrição** | As credenciais de sessão do WhatsApp (chaves de autenticação geradas pelo Baileys) são armazenadas e recuperadas do Google Secret Manager, evitando exposição em disco ou variáveis de ambiente. |
| **Prioridade** | Alta |

**Critérios de Aceitação:**
- [ ] As credenciais de sessão são salvas no Secret Manager após autenticação bem-sucedida
- [ ] Ao reiniciar o servidor, as credenciais são recuperadas do Secret Manager automaticamente
- [ ] Nenhuma chave sensível é armazenada em arquivos locais desprotegidos ou hardcoded no código
- [ ] A VM utiliza uma Service Account com permissão mínima necessária (`secretmanager.secretAccessor`)

---

### 2.3 Leitura de Mensagens Recebidas

| Campo | Detalhe |
|---|---|
| **Descrição** | O servidor escuta todas as mensagens recebidas na conta WhatsApp conectada. |
| **Prioridade** | Alta |

**Critérios de Aceitação:**
- [ ] O servidor processa mensagens de texto recebidas em chats individuais e grupos
- [ ] As mensagens são lidas em tempo real via conexão WebSocket mantida pelo Baileys
- [ ] O servidor registra (log) as mensagens recebidas com remetente e timestamp

---

### 2.4 Resposta Automática ao Comando `#iniciarBot#`

| Campo | Detalhe |
|---|---|
| **Descrição** | Quando o corpo de uma mensagem recebida contiver exatamente o comando `#iniciarBot#`, o servidor responde automaticamente com a mensagem fixa "Bot Iniciado". |
| **Prioridade** | Alta |

**Critérios de Aceitação:**
- [ ] A verificação do comando é feita no corpo (text) da mensagem recebida
- [ ] A resposta "Bot Iniciado" é enviada para o mesmo chat (individual ou grupo) que enviou o comando
- [ ] O comando é case-sensitive conforme especificado (`#iniciarBot#`)
- [ ] Mensagens que não contenham o comando são ignoradas (sem resposta automática)
- [ ] O envio da resposta é registrado em log com status de sucesso ou falha

---

### 2.5 Hospedagem de Landing Page em React

| Campo | Detalhe |
|---|---|
| **Descrição** | O mesmo servidor Node.js serve os arquivos estáticos do build de uma Landing Page desenvolvida em React, com interface moderna ao usuário. |
| **Prioridade** | Média |

**Critérios de Aceitação:**
- [ ] O build de produção do React (pasta `dist` ou `build`) é servido pelo servidor Node.js via rota raiz (`/`)
- [ ] A Landing Page é acessível pelo IP público ou domínio da VM
- [ ] A interface é responsiva (compatível com desktop e dispositivos móveis)
- [ ] A página carrega com desempenho adequado (assets otimizados via build de produção)

---

## 3. USUÁRIOS / PERSONAS

### 3.1 Administrador do Sistema

| Campo | Detalhe |
|---|---|
| **Perfil** | Desenvolvedor ou responsável técnico que configura e mantém o servidor |
| **Necessidades** | Configurar autenticação WhatsApp, monitorar logs, gerenciar credenciais no Secret Manager |
| **Ações no sistema** | Iniciar o servidor, associar Pairing Code, acessar logs, reiniciar serviço, atualizar código |

### 3.2 Usuário Final do WhatsApp (Contato)

| Campo | Detalhe |
|---|---|
| **Perfil** | Qualquer pessoa que envie mensagens para o número WhatsApp conectado ao servidor |
| **Necessidades** | Interagir com o bot enviando comandos reconhecidos |
| **Ações no sistema** | Enviar mensagem com `#iniciarBot#` e receber resposta automática |

### 3.3 Visitante da Landing Page

| Campo | Detalhe |
|---|---|
| **Perfil** | Usuário de internet que acessa o domínio/IP da VM via browser |
| **Necessidades** | Visualizar informações institucionais ou de produto na Landing Page |
| **Ações no sistema** | Navegar pela Landing Page, consumir conteúdo informativo |

---

## 4. RESTRIÇÕES E REQUISITOS TÉCNICOS

### 4.1 Infraestrutura

| Item | Requisito |
|---|---|
| **Plataforma** | Google Cloud Platform — Compute Engine (VM Linux) |
| **Disponibilidade** | 24×7 (VM sempre ativa) |
| **Gerenciamento de Segredos** | Google Secret Manager |
| **Biblioteca WhatsApp** | WhiskeySockets/Baileys (versão mais recente estável) |

### 4.2 Stack Tecnológica

| Componente | Tecnologia |
|---|---|
| **Backend / Bot** | Node.js |
| **Frontend** | React (build estático servido pelo Node.js) |
| **Protocolo WhatsApp** | WebSocket via Baileys |
| **Autenticação WhatsApp** | Pairing Code (sem QR Code) |

### 4.3 Segurança

- Credenciais de sessão do WhatsApp armazenadas **exclusivamente** no Google Secret Manager
- A VM deve utilizar Service Account com permissões mínimas (princípio do menor privilégio)
- Nenhuma chave ou token sensível deve constar no repositório de código (`.gitignore` obrigatório para arquivos de credenciais locais)
- Comunicação com a API do WhatsApp via WebSocket criptografado (padrão do Baileys)

### 4.4 Performance

- O servidor deve ser capaz de processar mensagens recebidas em tempo real sem atraso perceptível
- A Landing Page deve carregar em menos de 3 segundos em conexão padrão (assets minificados e comprimidos no build de produção)

### 4.5 Compatibilidade da Landing Page

| Plataforma | Requisito |
|---|---|
| **Browsers** | Chrome, Firefox, Edge, Safari (versões modernas) |
| **Dispositivos** | Desktop, tablet e mobile (design responsivo) |

### 4.6 Volumes Estimados

| Métrica | Estimativa |
|---|---|
| Mensagens WhatsApp processadas | Baixo volume (uso pessoal ou pequena equipe) |
| Sessões simultâneas WhatsApp | 1 (uma conta por instância Baileys) |
| Visitantes Landing Page | Não especificado pelo cliente |

> ⚠️ **Nota:** Volumes não foram informados pelo cliente. Revisar conforme crescimento do uso.

---

## 5. FORA DO ESCOPO

Os itens abaixo **não serão desenvolvidos** nesta versão:

- [ ] **Painel administrativo web** para gerenciar o bot ou visualizar mensagens
- [ ] **Múltiplas sessões WhatsApp** simultâneas (multi-device / multi-account)
- [ ] **Banco de dados** para persistência de mensagens ou histórico de conversas
- [ ] **Autenticação de usuários** na Landing Page (área de login/admin)
- [ ] **Integração com outros sistemas** (CRM, ERP, APIs externas além do GCP)
- [ ] **Envio proativo de mensagens** (campanha, disparos em massa)
- [ ] **Outros comandos de bot** além do `#iniciarBot#`
- [ ] **Configuração de domínio personalizado / HTTPS / SSL** (não mencionado na demanda)
- [ ] **CI/CD automatizado** para deploy na VM
- [ ] **Monitoramento e alertas** (uptime, health checks automatizados)

---

*Documento gerado com base em `docs/demanda-cliente.md`. Revisar com o cliente antes de iniciar o desenvolvimento.*
