# Proposal: Sprint 5 - Charge Refactor

## Why
O componente `ChargeScreen` apresenta alta complexidade cognitiva (39) e precisa ser refatorado.

## What Changes
- Extração de lógica de API para hooks.
- Componentes de UI separados (ChargeForm, PaymentMethods, etc.).

## Impact
Melhoria na manutenibilidade e preparação para integração com gateways de pagamento.