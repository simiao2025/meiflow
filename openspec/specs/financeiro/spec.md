# financeiro Specification

## Purpose
Gestão financeira completa para o MEI: receitas, despesas, fluxo de caixa projetado e conciliação bancária automática via Open Finance.

## Requirements
- **Registro:** CRUD de receitas e despesas com categorização automática por IA.
- **Conciliação:** Importação de extratos via Open Finance (Pluggy/Belvo) e matching automático com vendas.
- **Projeção:** Fluxo de caixa projetado para 30/60/90 dias considerando receitas previstas e despesas fixas (incluindo DAS).

## Data Model
- `financial.transactions`: Registro unificado de receitas/despesas.
- `financial.bank_accounts`: Contas bancárias conectadas via Open Finance.
- `financial.bank_statements`: Extratos importados.

## Acceptance Criteria
- [ ] Conciliação automática > 95% para transações Pix.
- [ ] Fluxo de caixa projetado atualizado em tempo real.
- [ ] Alertas de saldo baixo ou vencimentos próximos.
