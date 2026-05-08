# ADR-002: Estratégia Offline-First

**Status:** Aceita
**Data:** 2026-05-08
**Decisores:** Equipe MEIFlow

## Contexto

Muitos MEIs brasileiros trabalham em locais com conectividade ruim ou inexistente:
- Pedreiros/eletricistas em obras
- Ambulantes em feiras
- Técnicos em zonas rurais
- Prestadores em subsolos/garagens

O app precisa funcionar sem internet para operações essenciais do dia a dia.

## Decisão

### Banco local: **WatermelonDB**

**Alternativas consideradas:**
- AsyncStorage — muito simples, sem queries, sem sync
- Realm (MongoDB) — bom, mas MongoDB Atlas como backend (não Supabase)
- SQLite puro (expo-sqlite) — sem sync engine built-in
- MMKV — key-value apenas, sem relações

**Motivo:** WatermelonDB é SQLite otimizado para React Native com lazy loading, observable queries e sync engine bidirecional. Integra bem com Supabase via API customizada.

### Estratégia de Sync

```
App lê/escreve → WatermelonDB (local)
                     ↕ (quando online)
              Supabase PostgreSQL (cloud)
```

- **Write-local-first:** Toda operação salva localmente antes de sincronizar
- **Sync bidirecional:** Push local changes → Pull remote changes
- **Conflict resolution:** Server wins (fiscal), Client wins (transações manuais)
- **Queue de operações:** MMKV armazena ações pendentes para sync

### O que funciona offline

| ✅ Offline | ❌ Online only |
|-----------|--------------|
| Registrar receitas/despesas | Chat com assistente IA |
| Ver dashboard (dados cacheados) | Gerar DAS |
| Listar clientes | Emitir NFS-e |
| Ver PDFs salvos | Sync bancário |
| Calendário fiscal | Agente WhatsApp |
| Alertas já baixados | Pagamento de assinatura |

## Consequências

### Positivas
- App funciona em qualquer lugar
- UX mais rápido (leitura local = instantânea)
- Resiliência a falhas de rede

### Negativas
- Complexidade de sync e resolução de conflitos
- Tamanho do app aumenta (~40MB de cache)
- WatermelonDB adiciona camada de abstração

### Riscos e Mitigações
| Risco | Mitigação |
|-------|----------|
| Conflitos de sync | Estratégia clara: server wins para fiscal, client wins para manual |
| Dados desatualizados | Banner "Última sync: há X minutos" visível |
| Storage do device cheio | Configuração de limite de cache pelo MEI |
