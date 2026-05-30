# Protocolo de IA - MEIFlow (AI Context)

Este documento define as regras e o **Protocolo Pós-Implementação** que a Inteligência Artificial (Assistentes, Agentes de Codificação) deve OBRIGATORIAMENTE seguir em todas as suas interações e modificações de código neste projeto.

## Contexto do Projeto
- **Nome:** MEIFlow
- **Stack:** React Native (Expo) no Mobile, Python (FastAPI/LangGraph) no Backend de IA, Supabase como Backend DB/Auth.
- **Objetivo:** Facilitar a gestão financeira, fiscal e gerar oportunidades para MEIs.

---

## 🚀 PROTOCOLO PÓS-IMPLEMENTAÇÃO

Toda vez que uma nova *Feature* for implementada, uma *Refatoração* for concluída ou *Bugs* severos forem corrigidos, a IA **DEVE** executar o seguinte fluxo antes de finalizar sua tarefa:

### 1. Atualizar Contexto (Update Context)
- Revisar se a nova funcionalidade altera a arquitetura (`docs/architecture/README.md`) ou o modelo de dados (`docs/plans/2026-05-08-meiflow-design.md`).
- Atualizar o `CHANGELOG.md`.

### 2. Executar Skills de Qualidade e Segurança
A IA deve declarar e aplicar os guidelines e checklists das seguintes skills:
- **`/cybersecurity-web`**: Verificar possíveis injeções (SQLi no Supabase RLS), armazenamento seguro de tokens, sanitização e OWASP Top 10.
- **`/code-purity`**: Auditar o código alterado usando as diretrizes de pureza: procurar dead code, duplicação (DRY), imports perdidos, consoles esquecidos ou nomenclatura ambígua.
- **`/performance-optimization`**: Garantir que as alterações não introduziram gargalos de renderização (React Native) ou gargalos N+1 (Supabase/Python).

### 3. Rodar a Bateria de Testes
Sempre realizar/rodar os testes pertinentes:
- Rodar o linter/formatação (Ex: `npm run audit:all` no JS/TS, `ruff check .` no Python).
- Testar a aplicação (ou sugerir o comando exato para o usuário se não puder rodar em CI local).

**NUNCA DECLARE UMA TAREFA COMO COMPLETA SEM PASSAR POR ESTE PROTOCOLO.**
