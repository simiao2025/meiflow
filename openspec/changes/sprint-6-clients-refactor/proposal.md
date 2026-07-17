# Proposal: Sprint 6 - Clients Refactor

## Why
O componente `ClientsScreen` apresenta altíssima complexidade cognitiva (39) e 502 LOC, sendo o arquivo mais crítico do projeto.

## What Changes
- Extração de lógica de API para hooks (`useClients`).
- Componentes de UI separados (ClientCard, ClientForm, ClientList).

## Impact
Redução drástica de complexidade e preparação para features de geolocalização e CRM.