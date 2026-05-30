# Guia Completo para Cenário 100% de Produção (MEIFlow)

Este documento descreve arquitetura, integrações, chaves e os passos exatos necessários para migrar as simulações e os mockups do **MEIFlow** para um ambiente 100% funcional, conectado a APIs governamentais e de pagamento no mundo real.

---

## 1. Gateway de Pagamento Real (PIX e Cartão de Crédito)
Atualmente, a tela de cobrança gera QR Codes fictícios e insere os dados diretamente no Supabase. Em produção, você precisará de uma integradora bancária.
**Recomendação:** Asaas, Pagar.me ou MercadoPago.

### O Fluxo Real:
1. **Frontend:** O App faz um POST para o seu servidor backend com os dados do cliente e valor.
2. **Backend (Node.js ou Edge Functions):** Com a sua Chave Secreta (`API_KEY`), o servidor chama a API do Asaas para gerar uma cobrança (`POST /api/v3/payments`).
3. **Retorno:** O Asaas devolve o *Link de Pagamento* e a string *PIX Copia e Cola*. Seu backend salva isso no Supabase e devolve para o App exibir.
4. **Webhook:** Quando o cliente paga, o Asaas dispara um evento HTTP (Webhook) avisando o seu servidor. Seu servidor atualiza o status na tabela `charges` para `paid` e registra a transação na tabela `transactions`.
5. **Push:** O Supabase pode disparar um gatilho para o `expo-notifications` avisando o celular do MEI: "Dinheiro na conta!".

---

## 2. Emissão de Notas Fiscais (NF-e, NFC-e e NFS-e)
A emissão no MVP atual apenas grava o registro no Supabase. Para ter validade legal, precisa chegar à SEFAZ ou à Prefeitura.
**Recomendação de API:** Focus NFe, eNotas ou WebmaniaBR.

### O Fluxo Real:
1. **Certificado Digital:** O usuário (MEI) precisará fazer o upload do Certificado Digital A1. O seu backend armazenará esse `.pfx` com segurança (AWS KMS ou Supabase Vault).
2. **Requisição:** Ao clicar em "Emitir" no app, o backend monta o JSON/XML com os dados do cliente, produtos (NCM, CEST, CFOP) e assina usando o certificado.
3. **Envio e Polling:** O backend envia para a API do Focus NFe. A SEFAZ processa. O backend deve ficar consultando (polling) ou receber um webhook para baixar o XML e o PDF (DANFE).
4. **Armazenamento:** O XML e o DANFE são salvos no Supabase Storage e os URLs inseridos na tabela `fiscal.nfe_records`.

---

## 3. Transmissão da DASN-SIMEI e Gov.br
A Receita Federal **não possui uma API pública e aberta** para que terceiros transmitam a DASN de forma simples como um POST.

### A Solução de Produção:
Para que o MEIFlow consiga transmitir a DASN automaticamente para o usuário, você tem duas opções tecnológicas:
1. **Integração via e-CAC (Certificado Digital):** Usar o Certificado A1 do cliente e um serviço especializado B2B de mensageria fiscal para validar e enviar (mais robusto, mas custoso).
2. **RPA / Web Scraping (Robô):** Ter um servidor em nuvem rodando Puppeteer/Playwright. O MEI fornece CPF e Senha Gov.br. O robô loga no site do Simples Nacional, preenche os campos "Receita de Comércio" e "Receita de Serviços", aperta enviar, baixa o recibo em PDF e sobe no seu Supabase Storage. *(É a abordagem mais comum em fintechs que atendem MEI atualmente).*

---

## 4. Notificações Push Globais (FCM e APNs)
No momento, o app usa notificações *Locais* (alertas gerados pelo próprio celular quando o app está aberto). Em produção, você precisa avisar o usuário com o app fechado (Ex: "Sua NF foi aprovada", "Você recebeu um PIX").

### O Fluxo Real:
1. Configurar o projeto no Firebase Cloud Messaging (Android) e Apple Developer (APNs - iOS).
2. O App coleta um `ExpoPushToken` ao logar e salva na tabela `users` do Supabase.
3. Quando ocorre um evento no backend (Webhook do Asaas aprovando PIX, por exemplo), o backend dispara um POST para a API do Expo (`https://exp.host/--/api/v2/push/send`) contendo o token do usuário e a mensagem. A notificação acorda o celular do MEI onde quer que ele esteja.

---

## 5. Banco de Dados e Segurança (Supabase)
O MVP usa *Row Level Security* (RLS) para garantir que um MEI não veja os dados do outro. Mas em produção:
1. **Restrição de IP:** Configure o Supabase para só aceitar requisições do seu App autenticado ou do seu Servidor Backend.
2. **Backups Diários (Point-in-Time Recovery):** Ative no painel do Supabase, pois dados fiscais não podem ser perdidos.
3. **Supabase Vault:** Não salve senhas Gov.br ou Chaves API de clientes em texto plano nas tabelas. Use o *Supabase Vault* para criptografar essas colunas.

---

## 6. Lançamento nas Lojas (CI/CD)
O projeto usa Expo. Em vez de rodar o código no seu PC, você usará o **EAS (Expo Application Services)**:
1. Rodar `eas build -p android --profile production` para gerar o `.aab` e mandar para o Google Play Console.
2. Rodar `eas build -p ios --profile production` para gerar o `.ipa`, assinar com a sua conta de desenvolvedor da Apple (US$ 99/ano) e submeter ao TestFlight / App Store Connect.
3. Ativar o **EAS Update**: Permite que você corrija pequenos bugs no app (como cores ou textos) sem precisar que os usuários baixem uma nova versão nas lojas (Over-the-Air updates).

---

## Resumo da Arquitetura Necessária para Produção

- **App Mobile:** React Native (Expo) - Interface, Câmera, Notificações.
- **Banco e Storage:** Supabase - RLS, Storage de PDFs, Autenticação de Usuários.
- **Servidor (O "Motor"):** Node.js rodando no Render, Vercel ou Supabase Edge Functions. É ele que possui o segredo bancário e se comunica com o FocusNFe/Asaas sem expor a chave no celular.
- **APIs Terceiras:** Asaas (Cobranças) e Focus NFe (Emissão de Notas Fiscais).
