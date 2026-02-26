Servidor para gestão de mensagens do WhatsApp utilizando WhiskeySockets/Baileys
Hospedagem da aplicação em uma VM Compute Engine da GCP
Autenticação por Pairing Code (sem QR)
A sessão de autenticação do WhatsApp deve ser gerenciada de forma segura usando o Google Secret Manager.

O servidor deve ser capaz de ler as mensagens recebidas e, se a mensagem tiver no corpo o comando #iniciarBot# , o mesmo deve responder com uma mensagem fixa: "Bot Iniciado" 

Para aproveitar o funcionamento 24x7 desta VM Compute ENgine, este mesmo Servidor além de gerenciar mensagens do whatsapp deve ser capaz de hospedar uma Landing Page utilizando interface com usuária moderna (react)