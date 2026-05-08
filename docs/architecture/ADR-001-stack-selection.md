# ADR-001: Seleção de Stack Técnica

**Status:** Aceita
**Data:** 2026-05-08
**Decisores:** Equipe MEIFlow

## Contexto

O MEIFlow precisa de uma stack que suporte:
- App mobile cross-platform (Android + iOS)
- Backend com auth, banco relacional, storage e realtime
- Serviço de IA com agentes autônomos
- Modo offline
- Dados financeiros sensíveis (segurança crítica)
- Time-to-market de ~4 meses para MVP

## Decisão

### Mobile: **Expo SDK 52+ (React Native gerenciado)**

**Alternativas consideradas:**
- Flutter (Dart) — UI superior, mas ecossistema separado do backend
- React Native bare — mais controle, mas mais complexidade de build
- PWA — sem acesso a biometria, notificações limitadas

**Motivo:** Expo em 2026 é a forma mais madura de cross-platform. EAS Build, OTA updates, push notifications nativos, e TypeScript unificado com Edge Functions.

### Backend: **Supabase**

**Alternativas consideradas:**
- Firebase — lock-in do Google, Firestore não é relacional
- NestJS custom — 2-3x mais código, mais tempo
- AWS Amplify — complexo, over-engineered para MVP

**Motivo:** Supabase oferece Auth + PostgreSQL + RLS + Storage + Edge Functions + Realtime em uma plataforma. Elimina 70% do backend boilerplate. RLS nativo é essencial para dados financeiros.

### IA: **Python 3.12 + FastAPI + LangGraph**

**Alternativas consideradas:**
- Node.js + LangChain.js — ecossistema IA menos maduro em JS
- Vercel AI SDK — limitado para agentes autônomos com estado
- Edge Functions com OpenAI direto — sem orquestração de agentes

**Motivo:** Python é imbatível para IA. LangGraph permite agentes com estado, memória, ferramentas e ciclos. FastAPI oferece async + performance. Serviço separado permite escalar IA independentemente.

## Consequências

### Positivas
- TypeScript unificado (mobile + Edge Functions)
- Velocidade de desenvolvimento alta (Supabase elimina boilerplate)
- Ecossistema IA maduro (Python)
- Custo inicial baixo (Supabase free tier)

### Negativas
- Dependência do ecossistema Supabase
- Dois runtimes (TypeScript + Python) = dois sets de ferramentas
- Edge Functions têm limitações (tempo de execução, cold start)

### Riscos e Mitigações
| Risco | Mitigação |
|-------|----------|
| Supabase fora do ar | Modo offline com WatermelonDB |
| Edge Function timeout | Jobs assíncronos via Python service |
| Custo Supabase escalar | Plano Pro previsto para 5K+ usuários |
