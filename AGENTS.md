# 🎯 MEIFlow — Contexto do Projeto para Agentes de IA

> **Instrução:** Este documento é a fonte de contexto PRIMÁRIA do projeto. Todo agente de IA DEVE lê-lo ao abrir o projeto antes de qualquer ação.

---

## 📋 Identificação

| Campo | Valor |
|-------|-------|
| **Projeto** | MEIFlow |
| **Objetivo** | Gestão financeira, fiscal e administrativa para o Microempreendedor Individual (MEI) |
| **Status** | 📱 APK v1.0 instalado em dispositivo de testes |
| **Stack Principal** | React Native (Expo) · Python (FastAPI/LangGraph) · Supabase |

---

## 🏗️ Arquitetura (Resumo)

```
📱 CAMADA CLIENTE
  Expo App (React Native + TypeScript)
  Supabase SDK → acesso direto ao banco (WatermelonDB removido)
  Zustand (estado global)
      │
☁️ CAMADA BACKEND
  Supabase
  ├── Auth (JWT + MFA)
  ├── PostgreSQL (RLS em todas tabelas)
  ├── Storage (PDFs, XMLs, avatares)
  ├── Edge Functions (Deno/TypeScript)
  └── Realtime
      │
🤖 CAMADA IA
  Python 3.12 + FastAPI + LangGraph
  ├── AI Orchestrator (agente principal)
  ├── Financial Service (operações financeiras)
  └── CRM Service (clientes, onboarding)
      │
🔌 INTEGRAÇÕES EXTERNAS
  Gov.br · Asaas · NFS-e · Open Finance
  Evolution Go · PNCP · BNDES · DOU
  Google Maps · Pluggy
```

**Schemas do Banco:**
| Schema | Finalidade |
|--------|-----------|
| `public` | profiles, bank_accounts (view de compatibilidade) |
| `financial` | transactions, bank_accounts (unificado), bank_statements, credit_opportunities |
| `fiscal` | das_records, dasn_declarations, nfse |
| `crm` | clients, whatsapp_sessions, service_visits |
| `ai` | conversations, messages, agent_memory |
| `billing` | subscriptions, payments |
| `legal` | legislation_updates, user_legislation_reads |
| `procurement` | opportunities, user_matches, user_preferences |
| `app` | config (chave de criptografia, protegido por RLS rigoroso) |

---

## 🔄 Últimas Mudanças (Sessão Atual)

### FASE 1 — Unificação Bancária ✅
- ⬆️ **Migration `00015_unify_bank_accounts.sql`** — criada para unificar `public.bank_accounts` e `financial.bank_accounts` com:
  - Schema `app.config` para armazenamento seguro de chave de criptografia (pgcrypto)
  - Proteção RLS rigorosa na chave (`FOR ALL USING (false)`)
  - Triggers de sync bidirecional entre `public` e `financial`
  - Criptografia automática de `client_id`/`client_secret` via `pgp_sym_encrypt`
  - VIEW `financial.vw_accounts_full` segura (expõe apenas `has_credentials`, NUNCA valores decriptados)
  - Melhorias em `financial.bank_statements`: `pluggy_id`, `belvo_id`, `source`, `category_ai`, `matched_invoice_id`
- ⬆️ **Edge Function `sync-bank-statements`** — refatorada: remove dados mock, usa `financial.bank_accounts` via service_role

### FASE 0 — Segurança Urgente 🔴
- 🔒 **CORS restrito** em `financial-service` e `crm-service` (whitelist: localhost:8081, localhost:3000, app.meiflow.com.br)
- 🔒 **Log seguro** no CRM Service — email mascarado no log, senha temporária não exposta em produção
- 🔒 **CSP atualizado** no `shared/middleware.py` — inclui Supabase, Pluggy, Asaas
- 🔒 **`temporary_password`** protegido por flag de ambiente (`ENV=production` → oculto)

### 🧹 Cleanup Fallow (Código Morto)
- **theme.ts**: removidos `LightPalette`, `LightColors`, `Spacing`, `Effects` (4 exports mortos)
- **database/**: diretório WatermelonDB removido (schema.ts, index.ts, models/)
- **charge.tsx**: extraído `ChargeResultScreen` (521 → ~200 linhas)
- **Removidos**: `services/sync.ts`, `services/api.test.ts` (órfãos)
- **Imports corrigidos**: `schedule.tsx`, `clients.tsx`, `assistant.tsx`, `fiscal.tsx`

### 📊 Métricas de Qualidade (pós-cleanup)
| Métrica | Antes | Depois | Meta |
|---------|-------|--------|------|
| Dead Files | 20,3% | **14,3%** ✅ | <15% |
| Dead Exports | 13,1% | **7,6%** 🟡 | <5% |
| Maintainability | 90,0 | **90,9** ✅ | >90 |
| Duplicação | 11,3% | 11,6% | Estável |

---

## 🚀 PROTOCOLO PÓS-IMPLEMENTAÇÃO

**Toda vez** que implementar uma feature, refatorar código ou corrigir bugs:

### 1. Atualizar Contexto
- Atualizar este `AGENTS.md` se a arquitetura mudar
- Atualizar `AI_PROTOCOL.md` se o protocolo mudar
- Atualizar `CHANGELOG.md` com as mudanças
- Atualizar `docs/architecture/README.md` se schema ou arquitetura mudar

### 2. Rodar `npx fallow` (OBRIGATÓRIO)
Execute **imediatamente** após cada fase/mudança significativa:
```bash
cd MEIFlow && npx fallow
```
Em seguida, **corrija todos os problemas** apontados antes de prosseguir.

### 3. Review de Segurança
- Verificar injeções SQL (RLS, Edge Functions)
- Confirmar que secrets não estão expostos em logs ou responses
- Validar CORS e CSP quando aplicável
- Verificar `temporary_password` ou dados sensíveis em APIs

### 4. Executar Skills de Qualidade
- **`/security-review`** — checklist de segurança
- **`/code-purity`** — dead code, DRY, imports, consoles esquecidos

### 5. Validar
- Rodar linter: `ruff check .` nos serviços Python, ESLint no mobile
- Verificar typecheck se aplicável

**NUNCA DECLARE UMA TAREFA COMO COMPLETA SEM PASSAR POR ESTE PROTOCOLO.**

---

## 📁 Estrutura de Diretórios (Relevante)

```
MEIFlow/
├── apps/mobile/                    # App Expo (React Native)
│   ├── app/                        # Expo Router (file-based routing)
│   ├── components/                 # Componentes UI
│   ├── constants/theme.ts          # Design tokens (cores, tipografia)
│   ├── stores/                     # Zustand stores
│   └── services/                   # API calls (sync.ts removido)
│
├── services/
│   ├── ai-orchestrator/            # Agente IA principal (Python/FastAPI)
│   ├── financial-service/          # Operações financeiras (Python)
│   └── crm-service/               # Gestão de clientes (Python)
│
├── supabase/
│   ├── migrations/                 # SQL migrations (00001 a 00015)
│   ├── functions/                  # Edge Functions (Deno)
│   └── seed.sql
│
├── AGENTS.md                       ← VOCÊ ESTÁ AQUI (leia primeiro)
├── AI_PROTOCOL.md                  # Protocolo de IA detalhado
├── CONTRIBUTING.md                 # Padrões de contribuição
├── SECURITY.md                     # Política de segurança
├── CHANGELOG.md                    # Histórico de mudanças
└── docs/architecture/README.md     # Arquitetura detalhada + ADRs
```

---

## 🔐 Segurança: Regras Críticas

1. **APK instalado não pode ser quebrado** — mudanças no backend/deploy são seguras, mudanças no mobile exigem novo build
2. **CORS restrito** — nunca usar `allow_origins=["*"]` em produção
3. **Dados sensíveis** — `client_id`, `client_secret`, senhas temporárias NUNCA em logs
4. **RLS** — toda tabela pública deve ter Row Level Security
5. **Chave de criptografia** — armazenada em `app.config`, acessível apenas via `SECURITY DEFINER` triggers
6. **VIEW `vw_accounts_full`** — NUNCA expõe valores decriptados de credentials

---

## 🧪 Comandos Úteis

```bash
# Qualidade
npx fallow                          # Auditoria completa de código morto/duplicado
npx fallow --dead-code --health    # Modo detalhado (dead code + maintainability)
ruff check .                        # Linting Python
ruff format .                       # Formatação Python

# Migrations (via Supabase CLI)
supabase db push                    # Aplicar migrations pendentes

# Deploy Edge Functions
supabase functions deploy <nome>
```

---

## 📌 Notas Importantes

- **WatermelonDB foi removido** — não tentar importar `database/` ou `@nozbe/watermelondb`
- **A migration 00015** contém a unificação bancária — aplicá-la exige `pgcrypto` habilitado no Supabase
- **`temporary_password`** só deve ser retornado quando `ENV=development`
- **Sync de bank statements** usa `financial.bank_accounts` diretamente via service_role
