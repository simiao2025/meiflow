# MEIFlow — Guia de Execução Local 🚀

Este guia detalha como iniciar os três pilares do projeto MEIFlow em seu ambiente de desenvolvimento.

## 1. AI Service (Backend Python)
O cérebro do MEIFlow que processa o chat e as mensagens do WhatsApp.

1. Navegue até a pasta: `cd services/ai-orchestrator`
2. Crie o ambiente virtual: `python -m venv venv`
3. Ative o ambiente:
   - Windows: `venv\Scripts\activate`
   - Mac/Linux: `source venv/bin/activate`
4. Instale as dependências: `pip install -r requirements.txt`
5. Inicie o servidor: `uvicorn app.main:app --reload --port 8000`

## 2. Mobile App (Expo)
A interface premium onde o MEI gerencia tudo.

1. Navegue até a pasta: `cd apps/mobile`
2. Instale as dependências: `npm install`
3. Inicie o Expo: `npx expo start`
4. **Dica:** Para testar a sincronização offline, você pode desligar o Wi-Fi do seu simulador/dispositivo e continuar usando o app. Os dados sincronizarão assim que você religar.

## 3. Webhook do WhatsApp (Opcional)
Para testar o atendimento via WhatsApp:
1. Certifique-se de que o **AI Service** está rodando.
2. Use um túnel (ex: `ngrok http 8000`) para expor sua porta local.
3. Configure a URL do webhook na sua instância da **Evolution GO**: `https://seu-dominio.ngrok-free.app/webhook/whatsapp`

## 4. Variáveis de Ambiente (.env)
Certifique-se de ter um arquivo `.env` configurado tanto em `apps/mobile` quanto em `services/ai-orchestrator` com:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `OPENAI_API_KEY` (ou Anthropic/Google)
- `EVOLUTION_API_KEY`

---
**Dúvidas?** O MEIFlow utiliza o padrão 2026, então sinta-se à vontade para pedir ajuda com qualquer erro de dependência.
