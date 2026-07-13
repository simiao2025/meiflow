# 🔐 Guia de Variáveis de Ambiente — MEIFlow

> Este documento explica **onde encontrar** e **como gerar** cada variável de ambiente necessária.

---

## Resumo Rápido

| Variável | Onde Obter | Segurança |
|----------|-----------|-----------|
| `SUPABASE_URL` | Supabase Dashboard → Settings → API | Pública (URL) |
| `SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API | Semi-pública |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API | 🔴 CRÍTICA — nunca no client |
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys | 🔴 CRÍTICA |
| `INTERNAL_API_KEY` | Gerar aleatoriamente (ver instrução abaixo) | 🔴 CRÍTICA |
| `WEBHOOK_SECRET_TOKEN` | Gerar aleatoriamente (ver instrução abaixo) | 🔴 CRÍTICA |

---

## 1. Supabase

### Onde encontrar:
1. Acesse https://supabase.com/dashboard
2. Selecione o projeto MEIFlow
3. Vá em **Settings** → **API**

### Valores:
```
SUPABASE_URL=https://xtnpqomctbryzzdkerfp.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...  (Project API key → anon public)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...  (Project API key → service_role)
```

### Para gerar novas chaves (recomendado após auditoria):
1. Dashboard → Settings → API → **Regenerate API keys**
2. ⚠️ Isso invalida as chaves antigas — atualize em todos os ambientes

---

## 2. OpenAI

### Onde encontrar:
1. Acesse https://platform.openai.com/api-keys
2. Clique em **+ Create new secret key**
3. Copie a chave (ela só aparece uma vez)

### Valores:
```
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o
```

### Custo estimado: ~$0.01-0.05 por mensagem do assistente

---

## 3. Anthropic (Fallback)

### Onde encontrar:
1. Acesse https://console.anthropic.com/settings/keys
2. Crie uma nova API key

### Valores:
```
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

---

## 4. ElevenLabs (TTS)

### Onde encontrar:
1. Acesse https://elevenlabs.io/app/settings/api-keys
2. Copie sua API key

### Valores:
```
ELEVENLABS_API_KEY=sk_...
```

---

## 5. Evolution Go (WhatsApp)

### Onde encontrar:
1. Acesse o painel do Evolution Go
2. Vá em **API** → **Global API Key**

### Valores:
```
EVOLUTION_API_URL=https://sua-evolution-api.com
EVOLUTION_API_KEY=sua-api-key
```

---

## 6. Asaas (Pagamentos)

### Onde encontrar:
1. Acesse https://www.asaas.com
2. Faça login na conta
3. Vá em **Conta** → **API Chave**
4. Para sandbox: acesse https://sandbox.asaas.com

### Valores:
```
ASAAS_API_KEY=$aact_...
ASAAS_ENVIRONMENT=sandbox  # ou 'production'
ASAAS_WEBHOOK_SECRET=token-aleatorio-gerado-por-voce
```

---

## 7. Pluggy (Open Finance)

### Onde encontrar:
1. Acesse https://dashboard.pluggy.ai
2. Vá em **API Keys**

### Valores:
```
PLUGGY_CLIENT_ID=seu-client-id
PLUGGY_CLIENT_SECRET=seu-client-secret
PLUGGY_API_KEY=sua-api-key
```

---

## 8. INTERNAL_API_KEY (Gerar Novamente)

### ⚠️ A chave anterior (`meiflow_secret_2026_internal`) foi comprometida.
### Gere uma nova usando o comando abaixo:

```bash
# PowerShell
-join ((1..32) | ForEach-Object { '{0:X}' -f (Get-Random -Max 16) })

# Linux/Mac
openssl rand -hex 32
```

### Valores:
```
# Usado por TODOS os serviços backend (ai-orchestrator, financial, fiscal, crm)
INTERNAL_API_KEY=<chave-gerada-acima>

# Usado pelo app mobile (precisa ser o MESMO valor)
EXPO_PUBLIC_INTERNAL_KEY=<chave-gerada-acima>
```

### ⚠️ IMPORTANTE:
- A mesma chave deve estar no backend E no mobile
- Gere uma chave DIFERENTE para cada ambiente (dev, staging, production)
- **NUNCA** coloque a chave de produção no código fonte

---

## 9. WEBHOOK_SECRET_TOKEN (Gerar Novamente)

### ⚠️ O token anterior (`meiflow-webhook-2026`) era previsível.
### Gere um novo:

```bash
# PowerShell
-join ((1..32) | ForEach-Object { '{0:X}' -f (Get-Random -Max 16) })

# Linux/Mac
openssl rand -hex 32
```

### Valores:
```
# No ai-orchestrator (.env)
WEBHOOK_SECRET_TOKEN=<chave-gerada-acima>

# No Asaas webhook (se aplicável)
ASAAS_WEBHOOK_TOKEN=<chave-gerada-acima>
```

---

## 10. Render (Deploy Backend)

### Onde encontrar:
1. Acesse https://dashboard.render.com
2. Selecione o serviço MEIFlow
3. Vá em **Environment** → **Environment Variables**

### Valores para configurar no Render:
```
ENV=production
SUPABASE_URL=https://xtnpqomctbryzzdkerfp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<sua-service-role-key>
OPENAI_API_KEY=<sua-openai-key>
INTERNAL_API_KEY=<chave-gerada-acima>
WEBHOOK_SECRET_TOKEN=<chave-gerada-acima>
REDIS_URL=<url-do-redis-no-render>
```

---

## 11. Expo (Deploy Mobile)

### Valores para configurar no EAS:
Os valores ficam no `apps/mobile/eas.json` e/ou variáveis de build do EAS.

Para builds via EAS, configure as variáveis no dashboard:
```bash
eas env:create --name EXPO_PUBLIC_INTERNAL_KEY --value <chave-gerada>
eas env:create --name EXPO_PUBLIC_API_URL --value https://meiflow-ai-orchestrator.onrender.com
eas env:create --name EXPO_PUBLIC_AI_SERVICE_URL --value https://meiflow-ai-orchestrator.onrender.com/api/v1/chat
```

---

## 12. Webhook URLs (Configurar nos Terceiros)

### Asaas:
1. Dashboard → Conta → Configurações → Webhook
2. URL: `https://meiflow-ai-orchestrator.onrender.com/api/webhooks/asaas`
3. Token: `<ASAAS_WEBHOOK_TOKEN>`

### Evolution Go:
1. Painel → Instância → Webhook
2. URL: `https://meiflow-ai-orchestrator.onrender.com/webhook/whatsapp`
3. Token: `<WEBHOOK_SECRET_TOKEN>`

### Pluggy:
1. Dashboard → Webhooks
2. URL: `https://<SUPABASE_URL>/functions/v1/sync-bank-statements/webhook`
3. Token: `<PLUGGY_WEBHOOK_SECRET>`

---

## Checklist Pós-Auditoria

- [ ] Gerar novo `INTERNAL_API_KEY` (diferente de `meiflow_secret_2026_internal`)
- [ ] Gerar novo `WEBHOOK_SECRET_TOKEN` (diferente de `meiflow-webhook-2026`)
- [ ] Rotacionar `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` no Dashboard
- [ ] Atualizar todas as variáveis no Render
- [ ] Atualizar `eas.json` com as novas chaves
- [ ] Atualizar `apps/mobile/.env` com as novas chaves
- [ ] Atualizar `services/ai-orchestrator/.env` com as novas chaves
- [ ] Re-deploy do backend no Render
- [ ] Novo build do app via EAS
- [ ] Publicar páginas de Privacidade e Termos em `meiflow.com.br`
- [ ] Aplicar migration `00018_lgpd_compliance.sql` via `supabase db push`
