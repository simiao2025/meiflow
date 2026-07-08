# 📜 Protocolo de IA — MEIFlow (AI Context)

> ⚠️ **PRIMEIRO, LEIA `AGENTS.md`** — contém o contexto completo e atualizado do projeto.

Este documento define as regras e o **Protocolo Pós-Implementação** que todo agente de IA deve OBRIGATORIAMENTE seguir.

---

## 🔄 Informação da Sessão

- **Última atualização:** Julho 2026
- **APK**: v1.0 instalado em dispositivo de testes
- **Status geral**: FASE 0 (segurança) + FASE 1 (unificação bancária) concluídas

---

## 🚀 PROTOCOLO PÓS-IMPLEMENTAÇÃO

Toda vez que implementar uma feature, refatorar ou corrigir bugs:

### 1. Atualizar Contexto (OBRIGATÓRIO)
- Atualizar `AGENTS.md` se arquitetura/schemas mudarem
- Atualizar `CHANGELOG.md`
- Atualizar `docs/architecture/README.md` se schema ou arquitetura mudar

### 2. Rodar `npx fallow` (OBRIGATÓRIO)
Execute **imediatamente** após cada fase/mudança significativa e **corrija os problemas antes de prosseguir**:
```bash
cd MEIFlow && npx fallow
```

### 3. Executar Skills de Qualidade
Aplicar os guidelines das skills:
- **`/security-review`** — OWASP, injeções, tokens, RLS, sanitização
- **`/code-purity`** — dead code, DRY, imports perdidos, consoles esquecidos

### 4. Rodar Bateria de Testes
- Python: `ruff check .` nos serviços
- Lint/typecheck quando aplicável

**NUNCA DECLARE UMA TAREFA COMO COMPLETA SEM PASSAR POR ESTE PROTOCOLO.**

---

## 🔐 Regras de Segurança (Aplicar Sempre)

1. **Nunca usar CORS aberto (`*`)** em produção — usar whitelist específica
2. **Nunca logar senhas, tokens ou dados sensíveis** — mascarar emails e credentials
3. **`temporary_password`** só deve ser retornado quando `ENV=development`
4. **Chave de criptografia** (`app.config`) protegida por RLS — só acessível via `SECURITY DEFINER` triggers
5. **VIEW `vw_accounts_full`** NUNCA expõe valores decriptados de `client_id`/`client_secret`

---

## 📌 Contexto do Projeto

| Item | Detalhe |
|------|---------|
| **Nome** | MEIFlow |
| **Stack** | React Native (Expo), Python (FastAPI/LangGraph), Supabase |
| **Objetivo** | Gestão financeira, fiscal e oportunidades para MEIs |
| **Leia primeiro** | `AGENTS.md` (contexto completo) |
| **Arquitetura** | `docs/architecture/README.md` |
| **Contribuição** | `CONTRIBUTING.md` |
| **Segurança** | `SECURITY.md` |
