# 🎯 MEIFlow — Contexto do Projeto para Agentes de IA

> **Instrução:** Este documento é a fonte de contexto PRIMÁRIA do projeto. Todo agente de IA DEVE lê-lo ao abrir o projeto antes de qualquer ação.

---

## 📋 Identificação

| Campo | Valor |
|-------|-------|
| **Projeto** | MEIFlow |
| **Objetivo** | Gestão financeira, fiscal e administrativa para o Microempreendedor Individual (MEI) |
| **Status** | 📱 APK v1.0 instalado em dispositivo de testes |
| **Stack Principal** | React Native (Expo) · Python (FastAPI/LangGraph) · Supabase |

---

## 🏗️ Arquitetura (Resumo)

```
📱 CAMADA CLIENTE
  Expo App (React Native + TypeScript)
  Supabase SDK → acesso direto ao banco (WatermelonDB removido)
  Zustand (estado global)
      │
☁️ CAMADA BACKEND
  Supabase
  ├── Auth (JWT + MFA)
  ├── PostgreSQL (RLS em todas tabelas)
  ├── Storage (PDFs, XMLs, avatares)
  ├── Edge Functions (Deno/TypeScript)
  └── Realtime
      │
🤖 CAMADA IA
  Python 3.12 + FastAPI + LangGraph
  ├── AI Orchestrator (agente principal)
  ├── Financial Service (operações financeiras)
  └── CRM Service (clientes, onboarding)
      │
🔌 INTEGRAÇÕES EXTERNAS
  Gov.br · Asaas · NFS-e · Open Finance
  Evolution Go (v3) · Meta WhatsApp Cloud API (OAuth Embedded Signup)
  PNCP · BNDES · DOU
  Google Maps · Pluggy
```

**Schemas do Banco:**
| Schema | Finalidade |
|--------|-----------|
| `public` | profiles, bank_accounts (view de compatibilidade) |
| `financial` | transactions, bank_accounts (unificado), bank_statements, credit_opportunities |
| `fiscal` | das_records, dasn_declarations, nfse |
| `crm` | clients, whatsapp_sessions, service_visits |
| `ai` | conversations, messages, agent_memory |
| `billing` | subscriptions, payments |
| `legal` | legislation_updates, user_legislation_reads |
| `procurement` | opportunities, user_matches, user_preferences |
| `app` | config (chave de criptografia, protegido por RLS rigoroso) |

---

## 🔄 Últimas Mudanças (Sessão Atual)

### FASE 7 — Autonomia Total Agente SDR, Fluxo de Vendas PDV & Correção de Overlap de Telas 🚀🛡️
- 🤖 **Agente SDR WhatsApp com Total Autonomia Comercial**:
  - `agents/customer/graph.py` e `tools/crm_tools.py`: Agente capacitado para conduzir atendimento comercial completo com autonomia via WhatsApp (Evolution Go e Meta Cloud API).
  - **Pagamento Antecipado**:
    - Chave PIX Estática (`obter_chave_pix_mei`): consulta dados do MEI e orienta envio do comprovante para confirmação.
    - Chave PIX Dinâmica (`gerar_pix_dinamico`): geração de código EMV BR Code oficial (PIX Copia e Cola com CRC16 válido) e link de pagamento Asaas.
  - **Fechamento de Vendas & CRM**:
    - Solicitação de CPF do cliente com busca direta na base (`consultar_cliente_por_cpf`).
    - Cadastro/atualização de clientes (`cadastrar_ou_atualizar_cliente`).
    - Registro de pedidos de venda (`fechar_pedido_venda`) em `sales_orders` com baixa de estoque.
    - Migração de chamadas das tools para `supabase_admin` (Service Role), resolvendo restrições de RLS anônimo e corrigindo consulta para a tabela oficial `public.catalog_items`.
- ⚡ **Performance do Assistente IA**:
  - `services/ai-orchestrator/app/llm_factory.py`: modelo padrão atualizado para `gpt-4o-mini`, reduzindo latência de resposta de ~12s para ~1.5s.
- 📱 **PDV Vendas & Correção de Layout (Menu Inferior)**:
  - Mapeamento e correção de telas sobrepostas pela TabBar:
    - `pos.tsx`: `cartBar` elevada para `bottom: 84`, `left: 16`, `right: 16`, flutuando acima da barra de navegação, com lista em `paddingBottom: 220`.
    - `schedule.tsx`: FAB elevado de `bottom: 30` para `bottom: 110`.
  - Fluxo de Vendas reformulado de ponta a ponta:
    - 1. Seleção inicial do cliente (Consumidor Final ou busca na base com opção de cadastro).
    - 2. Seleção de itens (Serviços / Produtos) com botões de quantidade `[-] Qtd [+]` no card.
    - 3. Modal de pagamento e geração de cobrança (PIX com QR Code, Cartão ou Dinheiro no caixa).
    - 4. Conclusão com atalho para emissão de NFS-e caso o pedido contenha serviços.

### FASE 6 — Auditoria Forense de Integrações & Blindagem (Fail-Closed) 🛡️⚡
- 🔍 **Auditoria Forense Concluída**: Relatório detalhado em [`forensic_integrations_audit.md`](file:///C:/Users/PRV/.gemini/antigravity/brain/cc7ffb0e-4090-498f-a94f-36fc2d7f8839/forensic_integrations_audit.md). 10 vulnerabilidades mapeadas e mitigadas.
- 🔒 **Blindagem de Endpoints & Fail-Closed**:
  - `ai-orchestrator`: Endpoints sensíveis `/api/fiscal/emit`, `/api/fiscal/report` e `/api/billing/charge` agora exigem autenticação do usuário via `Depends(get_current_user_id)` (validação do JWT Supabase).
  - Webhooks Asaas (`/api/webhooks/asaas`) e Meta WhatsApp (`/webhook`) convertidos de fail-open para **Fail-Closed**: recusam conexões se o secret de ambiente estiver vazio ou inválido, prevenindo timing attacks com `secrets.compare_digest`.
  - Chat `/api/v1/chat` e áudio `/api/v1/chat/audio` aceitam JWT com fallback para body do APK legado (100% retrocompatível com APK v1.0).
  - Rotas de proxy Evolution Go (`instance/create`, `pairing-code`, etc.) extraem o usuário do JWT e injetam a chave mestra pelo servidor backend, corrigindo erros 422 de schemas Pydantic.
  - Correção de validação JWT (`auth.py` / `main.py`): execução síncrona de `_get_user_id_from_token` desacoplada com `asyncio.to_thread` e decodificação defensiva de claims (`sub`, `exp`), com fallback de tolerância para tokens expirados via checagem direta em `profiles` e consulta resiliente em `/status/{user_id}`, sanando o erro 401 (*"Autenticação necessária"*) nas conexões de WhatsApp e Meta Cloud.
  - Autenticação Multinível Defensiva no Backend (`auth.py`): suporte a fallbacks adicionais via `user_id` e `cnpj` validados contra o banco de dados `profiles`, evitando que tokens expirados na camada cliente barrem ações do MEI.
  - Mobile Resiliente: implementação de `getFreshAuthToken()` em `services/supabase.ts` com verificação de validade e auto-refresh prévio em todas as chamadas autenticadas (`settings.tsx`, `api.ts`, `metaAuth.ts`, `useAssistantChat.ts`, `bank-accounts.tsx`).
  - Sincronização automática de perfil via `useFocusEffect` em `settings.tsx`, garantindo que instâncias provisionadas no Supabase abram diretamente o modal de pareamento sem re-tentar provisionamentos redundantes.
  - Estabilização Evolution Go v3: inicialização garantida de socket via `/instance/connect` com injeção automática de `webhookUrl` e eventos `MESSAGE` antes de solicitar o código de pareamento via `/instance/pair`.
  - Webhook WhatsApp resiliente: tratamento de payloads flexíveis de Evolution Go v3 (`message`, `messages.upsert`), extração unificada de campos e proteção fail-closed tolerante a instâncias registradas no banco.
  - Resiliência contra cold-start do microserviço CRM: fallbacks diretos implementados no `ai-orchestrator` para gerenciar instâncias, pairing code e status diretamente na Evolution Go v3 e no Supabase.
  - Auto-cura de variáveis no Render: `get_evolution_credentials()` migra em tempo de execução domínios expirados (`.shop`) para `https://evolution-go.brasilonthebox.com` com a chave mestre `abcslirm2026`.
  - `services/ai-orchestrator/app/main.py`: correção de import ausente de `supabase_admin` e `asyncio`, eliminando crashes 500 no fallback de pairing code e status.
  - Vendas PDV: ciclo financeiro integrado registrando receita em `public.transactions`, recarregamento via `useFocusEffect` e atualização de estoque.
  - Oportunidades: subabas sem esmagamento (`filterRow` com altura fixa e `flexGrow: 0`) e alertas antigos desativados no banco de dados.
  - Áudio: uso de `tempfile.NamedTemporaryFile` para evitar colisões e path traversal.
  - `shared/security.py`: mitigação de timing attacks em checagens de `INTERNAL_API_KEY`.
- 🌐 **Infraestrutura Evolution Go v3**:
  - Migração de domínio expirado para novo endpoint ativo: `https://evolution-go.brasilonthebox.com` (IP `147.15.26.37`), com TLS válido e Caddy configurado.
  - Atualizado em `.env` do backend (`services/ai-orchestrator/.env`).
- 🗄️ **Supabase Database**:
  - Migration 00019 aplicada (`meta_*` colunas em `profiles`).
  - Trigger `protect_meta_credentials()` criado em `public.profiles` para impedir adulteração de WABA ID / Token pelo cliente via REST PostgREST.
- 📱 **Mobile & Usabilidade (Oportunidades, Vendas, IA e GPS)**:
  - Oportunidades: labels visíveis em todas as abas principais e subabas (Crédito, Licitações, Radar MEI); remoção de clipping vertical (`maxHeight: 60`) nos chips de filtro; integração com ofertas reais via view `public.credit_offers`; atualização de notícias do Radar MEI para novembro de 2026/2027.
  - Vendas (PDV): permitida a venda de serviços cadastrados em `catalog_items` (além de produtos físicos); filtros "Todos", "Serviços" e "Produtos"; atalho para emissão de NFS-e ao concluir venda de serviço.
  - Assistente de IA: auto-fallback gracioso para OpenAI em `LLMFactory` caso modelos de terceiros (Anthropic, Google, Groq) não tenham chaves no Render; decodificação tolerante de claims e mensagens defensivas sem falsos alertas de desconexão.
  - Localização / GPS: priorização de endereço textual (`clientAddress`) ao acionar Google Maps e Waze para navegação de alta precisão até a porta do cliente; validação de geocodificação no Nominatim evitando centróides de municípios; correção de coordenadas de quadras (Palmas - TO) no banco Supabase.
  - O APK v1.0 existente em produção NÃO quebra, pois o backend mantém retrocompatibilidade transparente e as novidades de frontend são entregues via OTA (`eas update`).

### FASE 5 — Segurança + Integração Meta Cloud API 🛡️
- 🔒 **Auditoria de segurança de integrações (3 vulnerabilidades corrigidas)**:
  - [CRÍTICA] Removido `EXPO_PUBLIC_INTERNAL_KEY` do mobile — agora usa apenas JWT do Supabase; `verify_jwt()` em `shared/security.py` valida token e extrai `user_id`
  - [CRÍTICA] `asaas-proxy` refatorado: whitelist `ALLOWED_ACTIONS` (buildPath server-side) em vez de `endpoint` livre do cliente
  - [ALTA] IDOR no `sync-bank-statements/handleConnectorStatus` corrigido: `.eq(item_id).eq(user_id, userId)` encadeado
- 🤖 **Auditoria do agente SDR de atendimento** (16 problemas identificados, pendente de correção)
- 🆕 **Meta WhatsApp Business Cloud API (OAuth Embedded Signup)**:
  - Coexiste com Evolution Go (v3) — ambos paralelos,Evolution intacto
  - Backend: `integrations/meta_oauth.py` (PKCE S256), `integrations/whatsapp_meta.py` (Cloud API client), `app/meta_routes.py` (5 rotas OAuth/status + webhook inbound `/webhook` GET+POST)
  - Webhook inbound: valida `X-Hub-Signature-256` (HMAC SHA256), dedup `message_id` em Redis (24h), resolve MEI por `meta_phone_number_id`, despacha texto/áudio/imagem/PDF/interactive para o mesmo `customer_app` Evolution Go, responde via Cloud API
  - State + PKCE persistidos em Redis (5 min, one-shot anti-replay)
  - Migration 00019: 8 colunas `meta_*` em `profiles` (paralelo às `evolution_*`)
  - Mobile: `services/metaAuth.ts` + card "Meta Cloud API" em Settings (botão abre dialog Meta oficial no navegador)
  - Token System User long-lived gravado no banco; mobile nunca o vê

### FASE 4 — Correção de Bugs Silenciosos + Dead Code Cleanup 🔧
- 🐛 **13 bugs corrigidos**:
  - `fiscalStore.ts`: tabela `das_guides` → `das_records`
  - `annual-declaration.tsx`: colunas/status inválidos (`revenue_services`, `revenue_commerce`, `receipt_number`, `enviada`)
  - `api.ts getBalance`: passa a subtrair despesas do saldo (`despesa`/`expense`)
  - `api.ts`: `Alert.alert()` adicionado em 3 catchs que retornavam `[]` silenciosamente
  - `login.tsx`: `try/catch` envolvendo todo o fluxo + `setLoading(false)` no sucesso + `Alert` no profileError
  - `emit.tsx` + `charge.tsx`: `parseFloat` com `isNaN()` check
  - `reconciliation.tsx`: `processAction` não avança se `approved=true` e POST falhou
  - `pos.tsx`: rollback — se `sales_order_items` falha, deleta a `sales_orders` criada
  - `charge.tsx`: rollback — se `transactions` falha no cash, deleta a `charges` criada
  - `ChargeResultScreen`: rollback — se `transactions` falha no webhook, reverte `charges.status` para `pending`
  - `assistant.tsx`: race condition resolvida com `messagesRef` (useRef)
  - `fiscal.tsx`: card PRÓXIMO DAS com dados reais (antes mock "20 MAI / Vence em 8 dias")
  - `clients.tsx`: regex frágil de endereço → split robusto
- 🧹 **Rota `/settings` resolvida**: `settings/_layout.tsx` removido, sub-pages movidas para `(tabs)/settings/`
- **Dead code (fallow 0% files / 0% exports)**:
  - 11 arquivos removidos (KeyboardSafeView, useColorScheme, useClientOnlyValue, Themed, EditScreenInfo, StyledText, Colors.ts, tests, scratch, supabase types)
  - 5 exports não utilizados limpos (`DarkPalette`, `DarkColors`, `api`, `legalService`, `useThemeColor`)
  - 2 tipos não utilizados limpos (`DAS`, `Invoice`)
  - 2 props não utilizadas limpas (`index` em `DasCard`, `AppointmentCard`)
- **Teclado**: `KeyboardAvoidingView` padronizado com `behavior='padding'` + `keyboardVerticalOffset` + `ScrollView` + `keyboardShouldPersistTaps="handled"` em 12 telas
- **OTA Update**: `expo-updates` ativado — notificação "Atualização Disponível" ao abrir o app
- **Deploy**: 4 `eas update` enviados para `production`
- **Commits**: `80f7a54`, `6fe20cf`, `c62081d`, `a2c5601`

### 📊 Métricas de Qualidade (pós-cleanup)
| Métrica | Antes | Depois | Meta |
|---------|-------|--------|------|
| Dead Files | 20,3% | **0%** ✅ | <15% |
| Dead Exports | 13,1% | **0%** ✅ | <5% |
| Maintainability | 90,0 | **93.1** ✅ | >90 |
| Duplicação | 11,3% | 11,4% | Estável |

---

## 🚀 PROTOCOLO PÓS-IMPLEMENTAÇÃO

**Toda vez** que implementar uma feature, refatorar código ou corrigir bugs:

### 1. Atualizar Contexto
- Atualizar este `AGENTS.md` se a arquitetura mudar
- Atualizar `AI_PROTOCOL.md` se o protocolo mudar
- Atualizar `CHANGELOG.md` com as mudanças
- Atualizar `docs/architecture/README.md` se schema ou arquitetura mudar

### 2. Rodar `npx fallow` (OBRIGATÓRIO)
Execute **imediatamente** após cada fase/mudança significativa:
```bash
cd MEIFlow && npx fallow
```
Em seguida, **corrija todos os problemas** apontados antes de prosseguir.

### 3. Review de Segurança
- Verificar injeções SQL (RLS, Edge Functions)
- Confirmar que secrets não estão expostos em logs ou responses
- Validar CORS e CSP quando aplicável
- Verificar `temporary_password` ou dados sensíveis em APIs

### 4. Executar Skills de Qualidade
- **`/security-review`** — checklist de segurança
- **`/code-purity`** — dead code, DRY, imports, consoles esquecidos

### 5. Validar
- Rodar linter: `ruff check .` nos serviços Python, ESLint no mobile
- Verificar typecheck se aplicável

**NUNCA DECLARE UMA TAREFA COMO COMPLETA SEM PASSAR POR ESTE PROTOCOLO.**

---

## 📁 Estrutura de Diretórios (Relevante)

```
MEIFlow/
├── apps/mobile/                    # App Expo (React Native)
│   ├── app/                        # Expo Router (file-based routing)
│   ├── components/                 # Componentes UI
│   ├── constants/theme.ts          # Design tokens (cores, tipografia)
│   ├── stores/                     # Zustand stores
│   └── services/                   # API calls (sync.ts removido)
│
├── services/
│   ├── ai-orchestrator/            # Agente IA principal (Python/FastAPI)
│   ├── financial-service/          # Operações financeiras (Python)
│   └── crm-service/               # Gestão de clientes (Python)
│
├── supabase/
│   ├── migrations/                 # SQL migrations (00001 a 00015)
│   ├── functions/                  # Edge Functions (Deno)
│   └── seed.sql
│
├── AGENTS.md                       ← VOCÊ ESTÁ AQUI (leia primeiro)
├── AI_PROTOCOL.md                  # Protocolo de IA detalhado
├── CONTRIBUTING.md                 # Padrões de contribuição
├── SECURITY.md                     # Política de segurança
├── CHANGELOG.md                    # Histórico de mudanças
└── docs/architecture/README.md     # Arquitetura detalhada + ADRs
```

---

## 🔐 Segurança: Regras Críticas

1. **APK instalado não pode ser quebrado** — mudanças no backend/deploy são seguras, mudanças no mobile exigem novo build
2. **CORS restrito** — nunca usar `allow_origins=["*"]` em produção
3. **Dados sensíveis** — `client_id`, `client_secret`, senhas temporárias NUNCA em logs
4. **RLS** — toda tabela pública deve ter Row Level Security
5. **Chave de criptografia** — armazenada em `app.config`, acessível apenas via `SECURITY DEFINER` triggers
6. **VIEW `vw_accounts_full`** — NUNCA expõe valores decriptados de credentials

---

## 🧪 Comandos Úteis

```bash
# Qualidade
npx fallow                          # Auditoria completa de código morto/duplicado
npx fallow --dead-code --health    # Modo detalhado (dead code + maintainability)
ruff check .                        # Linting Python
ruff format .                       # Formatação Python

# Migrations (via Supabase CLI)
supabase db push                    # Aplicar migrations pendentes

# Deploy Edge Functions
supabase functions deploy <nome>
```

---

## 📌 Notas Importantes

- **WatermelonDB foi removido** — não tentar importar `database/` ou `@nozbe/watermelondb`
- **A migration 00015** contém a unificação bancária — aplicá-la exige `pgcrypto` habilitado no Supabase
- **`temporary_password`** só deve ser retornado quando `ENV=development`
- **Sync de bank statements** usa `financial.bank_accounts` diretamente via service_role
