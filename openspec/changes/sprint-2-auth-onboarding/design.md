# Design: Sprint 2 - Auth & Onboarding

## Overview
O fluxo de login receberá um campo de CNPJ. Ao digitar, o app chamará um service que consulta a Receita Federal (simulado ou via API). No onboarding, exibiremos um formulário pré-preenchido com os dados retornados.

## Architecture
- `apps/mobile/app/auth/login.tsx`: UI de Login.
- `services/auth-service/` (a criar): Para orquestrar a consulta de CNPJ.
