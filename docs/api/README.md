# Documentação de API — MEIFlow

## Endpoints

### Supabase SDK (Client)
O app usa o SDK oficial do Supabase. RLS garante isolamento de dados por usuário.

### Edge Functions

| Function | Método | Descrição |
|----------|--------|-----------|
| `ai-proxy` | POST | Proxy autenticado para serviço IA |
| `generate-das` | POST | Gera guia DAS via PGMEI |
| `create-checkout` | POST | Cria sessão de pagamento Asaas |
| `billing-webhook` | POST | Webhooks do Asaas |

### AI Service (FastAPI — interno)

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/v1/chat` | POST | Chat assistente IA (SSE) |
| `/api/v1/customer/webhook` | POST | Mensagens Evolution Go |
| `/health` | GET | Health check |

## Autenticação

Header obrigatório: `Authorization: Bearer <jwt_token>`

## Tipos TypeScript

Gerados via: `supabase gen types typescript --project-id <id>`
