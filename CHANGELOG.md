# Changelog

Todas as mudanças notáveis do MEIFlow serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Added
- Documentação de fundação do projeto (README, CONTRIBUTING, SECURITY, ADRs)
- Design document completo com 8 seções aprovadas
- Plano de implementação da Fase 1 (MVP)
- `AGENTS.md` — documento de contexto do projeto para leitura automática por agentes de IA
- Migration `00015_unify_bank_accounts.sql` — unificação de bank_accounts com criptografia pgcrypto, triggers de sync bidirecional e RLS
- Componente `ChargeResultScreen` — extraído de charge.tsx para reduzir complexidade

### Security
- CORS restrito nos serviços financial-service e crm-service (whitelist específica)
- Log seguro no CRM Service — email mascarado, sem exposição de senhas
- CSP atualizado no middleware compartilhado
- `temporary_password` protegido por flag de ambiente (`ENV=production` → oculto)
- VIEW `vw_accounts_full` — expõe apenas `has_credentials`, nunca valores decriptados
- RLS rigoroso na tabela `app.config` (chave de criptografia protegida)

### Changed
- Edge Function `sync-bank-statements` refatorada para usar `financial.bank_accounts` e remover dados mock
- `AI_PROTOCOL.md` atualizado com novo fluxo de `npx fallow` obrigatório
- `theme.ts`: removidos exports mortos (`LightPalette`, `LightColors`, `Spacing`, `Effects`)

### Removed
- Diretório `database/` (WatermelonDB) — código morto sem referências
- `services/sync.ts` — órfão desde remoção do WatermelonDB
- `services/api.test.ts` — arquivo de teste sem referências
- Imports obsoletos de `Spacing` em 4 arquivos (schedule.tsx, clients.tsx, assistant.tsx, fiscal.tsx)
