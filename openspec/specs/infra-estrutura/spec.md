# infra-estrutura Specification

## Purpose
Estabelecer a fundação técnica do projeto MEIFlow, garantindo escalabilidade, segurança (RLS) e suporte ao modo offline-first.

## Requirements
- **Stack:** Expo (React Native), TypeScript, Supabase, Python (FastAPI/LangGraph).
- **Offline:** WatermelonDB (SQLite local) com sync bidirecional.
- **Segurança:** RLS em todas as tabelas (policy: `auth.uid() = user_id`), criptografia de PII, Rate Limiting.
- **CI/CD:** EAS Build (preview/production), GitHub Actions.
- **Observabilidade:** Logs centralizados no Supabase, monitoramento de métricas de uso.

## Data Model
- `app.config`: Chaves de criptografia e configurações protegidas.

## Acceptance Criteria
- [ ] RLS validado em todas as tabelas.
- [ ] Sync offline funcionando com reconciliação de conflitos.
- [ ] CI/CD operando corretamente.
