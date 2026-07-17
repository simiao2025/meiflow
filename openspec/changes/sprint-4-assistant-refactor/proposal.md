# Proposal: Sprint 4 - Assistant Refactor

## Why
O componente `AssistantScreen` apresenta alta complexidade cognitiva (31) e precisa ser refatorado para permitir maior testabilidade e manutenção.

## What Changes
- Extração de lógica de API para hooks.
- Componentes de UI separados (MessageBubble, QuickActions, etc.).

## Impact
Melhoria na manutenibilidade e preparação para futuras features de IA.