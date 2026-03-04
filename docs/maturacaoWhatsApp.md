# Código / Infraestrutura 

* **User Agent e Nome da Sessão:** No Baileys, você pode definir o nome da plataforma de conexão. Evite nomes óbvios como "Bot_System". Use algo que simule um navegador comum ou o próprio WhatsApp Web. Implementado em `src/bot/connection.js` como `Browsers.ubuntu('Chrome')` — enviado ao WhatsApp como `['Chrome', 'Chrome', '10.15.7']`, indistinguível de um navegador Chrome comum no Ubuntu.

* **IP e Geolocalização:** Se o seu chip é brasileiro, o servidor onde o Baileys está rodando deve, preferencialmente, usar um IP do Brasil. O WhatsApp estranha um chip de SP conectando subitamente de um data center em Frankfurt. Utilizar região GCP `southamerica-east1` (São Paulo). **Importante:** IPs de qualquer região GCP pertencem ao ASN 15169 (Google LLC), reconhecível como datacenter — a migração para São Paulo elimina o mismatch geográfico mas não o fato de ser IP de nuvem. Não é possível atribuir um IP de outra região a uma VM existente; é necessário criar nova VM na região desejada.

* A automação não deve enviar mensagens rápido demais (use delays aleatórios entre 5 e 15 segundos).

* **Quedas de conexão e reconexão automática**

  Quedas de conexão **não forçam re-autenticação** enquanto `creds.registered === true` estiver salvo no Secret Manager — o Baileys reutiliza as credenciais existentes. Re-autenticação (novo Pairing Code) só é exigida se o usuário remover o dispositivo pelo celular (loggedOut / código 401).

  O código implementa **backoff exponencial com jitter ±20%** em `connectionManager.js`:

  | Tentativa | Delay aproximado |
  | :-------: | :-------------- |
  | 1ª | ~5s |
  | 2ª | ~10s |
  | 3ª | ~20s |
  | 4ª | ~40s |
  | 5ª | ~80s |
  | 6ª | ~160s |
  | 7ª+ | ~300s (teto de 5 min) |

  Após **10 tentativas consecutivas** sem sucesso, o circuit breaker é acionado: o status vai para `error` e a reconexão automática para. O usuário precisa acessar a UI e clicar em "Conectar" para retomar. O contador de tentativas é zerado ao conectar com sucesso ou ao desconectar manualmente.

  **Risco de quota do Secret Manager:** cada reinício do processo consome 1 leitura + 1 escrita no Secret Manager. Loops de restart do PM2 (ex: EADDRINUSE) podem esgotar a quota gratuita de 10.000 ops/mês em poucas horas. O fix do `process.exit(1)` no handler de erro do servidor HTTP (`src/server/index.js`) mitiga este cenário ao garantir saída limpa do processo em erros não-recuperáveis.

* Timeout do Socket: No código do Baileys, se você não configurar o defaultQueryTimeoutMs, a conexão pode cair se a sincronização inicial demorar muito (comum em contas com milhares de chats).

# Prazos 

| Etapa | Prazo | Ação |
| :---- | :---: | :--- |
| 1. Ativação do Chip | 0h | Ative o chip na operadora e faça uma ligação ou use dados móveis para garantir que a linha está ativa na rede. | 
| 2. Cadastro no App Oficial |	+2 horas | Registre o número no app oficial (Android/iOS). Nunca registre direto via API ou em emuladores "limpos" demais. |
| 3. Perfil e Bio |	Imediato |	Coloque foto, nome e um recado. Contas sem foto são alvos fáceis para o banimento automático. |
| 4. Maturação Humana |	24 a 48 horas |	Use o número como um humano: entre em 1 ou 2 grupos reais, envie mensagens para amigos, responda alguém e poste um Status. |
| 5. Pairing Code (Baileys) | Após 48-72 horas | Só então gere o código de pareamento para conectar ao seu sistema via WhiskeySockets. |
|

# Outros

* Mantenha o App Oficial Aberto: Durante os primeiros dias, mantenha o chip ativo em um celular físico com o app oficial instalado em segundo plano. Isso ajuda a validar que a sessão "Web" (Baileys) é legítima.

* WhatsApp Business (Recomendado para Automações). Contas Business que preenchem todos os dados (e-mail, site, endereço, horário de funcionamento) ganham pontos extras de legitimidade. O sistema entende que há uma entidade comercial ali, o que justifica uma atividade de mensagens mais frequente.

* Não enviar links externos logo na primeira mensagem para um contato que não salvou seu número.

* O WhatsApp é muito mais tolerante com bots que enviam notificações para pessoas que possuem o número salvo. 

* Solicitar ao usuário que SALVE o seu número em sua AGENDA. Criar um fluxo de "Boas-vindas". No primeiro contato. Exemplo:  "Olá! Para que eu possa te enviar notificações de status e documentos importantes, por favor, adicione este número aos seus contatos."

## Estratégias para verificar se o usuário salvou o seu número na agenda

1. O Teste da Lista de Transmissão (O mais confiável)
Esta é a regra de ouro do WhatsApp: Mensagens enviadas por Lista de Transmissão só chegam para quem tem o seu número salvo.

Como funciona no Baileys: Você pode criar uma lista de transmissão programaticamente e enviar uma mensagem.

A Prova: Se a mensagem aparecer com apenas um tique cinza (enviado) por muito tempo, mas o contato estiver online ou respondendo outras mensagens, é quase certo que ele não tem seu número salvo. Se aparecer o tique duplo, ele salvou você.

2. Visibilidade da Foto de Perfil (O sinal visual)
A maioria dos usuários mantém a configuração de privacidade da foto de perfil como "Meus Contatos".

O "Pulo do Gato": Se o seu bot tentar buscar a URL da foto de perfil do contato (sock.profilePictureUrl(jid)) e ela retornar vazia ou der erro, há uma alta probabilidade de que:

O usuário não tem foto.

O usuário restringiu a foto para contatos e ele não tem o seu número salvo.

Limitação: Se o usuário deixou a foto como "Todos", esse teste falha.

3. Visualização de Status (Stories)
Assim como na lista de transmissão, os Status do WhatsApp só são entregues para quem possui o contato mútuo (ambos salvos).

Estratégia: Se você postar um Status pelo bot e o contato visualizá-lo, você tem a confirmação absoluta de que ele possui seu número na agenda. No Baileys, você consegue monitorar o evento de messages.upsert para tipos de mensagem de "status" e ver quem visualizou.