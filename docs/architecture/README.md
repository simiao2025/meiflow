# Arquitetura MEIFlow

## Visão Geral

O MEIFlow é composto por três camadas principais que se comunicam de forma segura e desacoplada:

```
┌──────────────────────────────────────────────────┐
│  📱 CAMADA CLIENT                                │
│  Expo App (React Native + TypeScript)            │
│  WatermelonDB (SQLite local) ← Offline-First     │
│  Zustand (estado global)                         │
└────────────────────┬─────────────────────────────┘
                     │ HTTPS / TLS 1.3
                     │ Supabase SDK + JWT
┌────────────────────▼─────────────────────────────┐
│  ☁️ CAMADA BACKEND                                │
│  Supabase                                        │
│  ├── Auth (JWT + MFA + OAuth)                    │
│  ├── PostgreSQL (RLS em TODAS as tabelas)        │
│  ├── Storage (PDFs, XMLs, avatares)              │
│  ├── Edge Functions (proxy + lógica de negócio)  │
│  └── Realtime (push updates)                     │
└────────────────────┬─────────────────────────────┘
                     │ Edge Function → FastAPI
┌────────────────────▼─────────────────────────────┐
│  🤖 CAMADA IA                                     │
│  Python 3.12 + FastAPI + LangGraph               │
│  ├── Agente Assistente (pessoal do MEI)           │
│  ├── Agente Atendimento (clientes do MEI)        │
│  ├── Redis (cache + filas)                       │
│  └── pgvector (memória vetorial)                 │
└────────────────────┬─────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────┐
│  🔌 INTEGRAÇÕES EXTERNAS                         │
│  Gov.br │ Asaas │ NFS-e │ Open Finance           │
│  Evolution Go │ PNCP │ BNDES │ DOU               │
│  Google Maps │ Pluggy                            │
└──────────────────────────────────────────────────┘
```

## Princípios Arquiteturais

| Princípio | Aplicação |
|-----------|-----------|
| **Offline-First** | App funciona sem internet. WatermelonDB local + sync bidirecional |
| **Security by Default** | RLS em todas tabelas, JWT obrigatório, criptografia de PII |
| **Separation of Concerns** | Client (UI), Backend (dados/auth), IA (agentes) são independentes |
| **Fail Gracefully** | Fallbacks para todas integrações externas. App nunca trava |
| **Single Source of Truth** | Supabase PostgreSQL é a fonte de verdade. Local DB é cache |

## Decisões Arquiteturais (ADRs)

| ADR | Decisão | Status |
|-----|---------|--------|
| [ADR-001](ADR-001-stack-selection.md) | Stack técnica: Expo + Supabase + Python | Aceita |
| [ADR-002](ADR-002-offline-first.md) | Estratégia offline com WatermelonDB | Aceita |
| [ADR-003](ADR-003-ai-agents.md) | Agentes IA com LangGraph em serviço separado | Aceita |
| [ADR-004](ADR-004-babel-hermes-stability.md) | Estabilidade de Runtime (Babel, Hermes, Compiler) | Aceita |

## Schemas do Banco

| Schema | Tabelas | Responsabilidade |
|--------|---------|-----------------|
| `public` | profiles | Dados do MEI |
| `financial` | transactions, bank_accounts, bank_statements, credit_opportunities, credit_suggestions | Financeiro |
| `fiscal` | das_records, dasn_declarations, nfse | Fiscal |
| `crm` | clients, whatsapp_sessions, service_visits | CRM |
| `ai` | conversations, messages, agent_memory | Agentes IA |
| `billing` | subscriptions, payments | Assinatura |
| `legal` | legislation_updates, user_legislation_reads | Legislação |
| `procurement` | opportunities, user_matches, user_preferences | Licitações |

## Referências

- [Design Document Completo](../plans/2026-05-08-meiflow-design.md)
- [Supabase Docs](https://supabase.com/docs)
- [Expo Docs](https://docs.expo.dev)
- [LangGraph Docs](https://langchain-ai.github.io/langgraph/)
