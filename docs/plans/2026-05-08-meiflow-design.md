# MEIFlow — Design Document

**Data:** 2026-05-08
**Status:** Aprovado
**Stack:** Expo (React Native) + Supabase + Python AI Service

---

## 1. Visão Geral

**MEIFlow** é um app mobile (Android + iOS) de gestão completa para o Microempreendedor Individual (MEI) brasileiro. Combina gestão financeira, automação de obrigações fiscais, dashboard administrativo e dois agentes de IA autônomos — um assistente pessoal do MEI e um agente de atendimento ao cliente do negócio.

### Público-alvo
O próprio MEI — empreendedor individual que gerencia seu negócio no dia a dia.

### Monetização
Trial gratuito de 7 dias + assinatura mensal recorrente.

---

## 2. Arquitetura Geral

```
┌─────────────────────────────────────────┐
│  📱 Expo App (TypeScript)               │
│  UI → Zustand → WatermelonDB (local)    │
│  Supabase SDK → Sync Engine             │
└──────────────┬──────────────────────────┘
               │ HTTPS/TLS 1.3
┌──────────────▼──────────────────────────┐
│  ☁️ Supabase                             │
│  Auth (JWT) │ PostgreSQL (RLS)          │
│  Storage    │ Edge Functions │ Realtime │
└──────────────┬──────────────────────────┘
               │ Edge Function Proxy
┌──────────────▼──────────────────────────┐
│  🤖 Python AI Service (FastAPI)          │
│  LangGraph Agent 1: Assistente MEI      │
│  LangGraph Agent 2: Atendimento Cliente │
│  Redis (cache + filas) │ pgvector       │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  🔌 Integrações Externas                 │
│  Gov.br │ Asaas │ NFS-e │ Open Finance │
│  Evolution Go │ PNCP │ BNDES │ DOU     │
│  Google Maps │ Pluggy                   │
└─────────────────────────────────────────┘
```

### Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Mobile | Expo SDK 52+, TypeScript, Expo Router |
| Estado | Zustand (global) + React Hook Form + Zod |
| DB local | WatermelonDB (offline-first) |
| Cache KV | react-native-mmkv (criptografado) |
| UI | Tamagui ou Gluestack UI v2 |
| Gráficos | Victory Native |
| Chat | Gifted Chat |
| Backend | Supabase (Auth, PostgreSQL, Storage, Edge Functions, Realtime) |
| IA | Python 3.12, FastAPI, LangGraph, OpenAI GPT-4o + Claude fallback |
| Embeddings | OpenAI text-embedding-3-small + pgvector |
| WhatsApp | Evolution Go |
| Pagamentos | Asaas (PIX, boleto, cartão) |
| Mapas | React Native Maps + Google Places API |

---

## 3. Estrutura do App Mobile

### Navegação (Bottom Tabs)

| Aba | Função |
|-----|--------|
| 🏠 Home | Dashboard: faturamento, alertas, gráficos, vencimentos |
| 💰 Financeiro | Receitas, despesas, fluxo de caixa, conciliação |
| 📄 Fiscal | DAS, DASN-SIMEI, NFS-e, calendário fiscal |
| 👥 Clientes | CRM, histórico, agente IA WhatsApp |
| 🤖 Assistente | Chat com IA pessoal do MEI |

### Telas por Módulo

**Home/Dashboard:** Faturamento mensal vs limite anual (barra progresso), próximos vencimentos, alertas IA, resumo financeiro.

**Financeiro:** CRUD receitas/despesas, categorização IA, relatórios por período, extrato conciliado Open Finance.

**Fiscal:** Geração/consulta DAS com barcode/PIX, DASN-SIMEI assistida, emissão NFS-e, timeline calendário fiscal.

**Clientes:** Cadastro com geolocalização, canal WhatsApp com agente IA, histórico de atendimentos, mapa de clientes.

**Assistente:** Chat conversacional, ações rápidas contextuais, histórico de recomendações, alertas proativos.

---

## 4. Banco de Dados

### Schemas

| Schema | Responsabilidade |
|--------|-----------------|
| public | Perfis, configurações |
| financial | Receitas, despesas, contas bancárias, crédito |
| fiscal | DAS, DASN, NFS-e |
| crm | Clientes, visitas, WhatsApp sessions |
| ai | Conversas, mensagens, memória dos agentes |
| billing | Assinaturas, pagamentos |
| legal | Atualizações de legislação |
| procurement | Licitações, oportunidades |

### Tabelas Principais

**public.profiles:** id (FK auth.users), full_name, cpf, cnpj, razao_social, nome_fantasia, atividade_cnae, data_abertura_mei, telefone, email, endereco (jsonb), avatar_url, limite_anual_mei, created_at, updated_at

**financial.transactions:** id, user_id, type (receita|despesa), amount, category, description, date, payment_method, client_id, nfse_id, bank_account_id, ai_categorized, receipt_url, created_at

**financial.bank_accounts:** id, user_id, bank_name, bank_code, agency, account_number, open_finance_consent_id, is_primary, balance_cached, last_sync_at

**financial.bank_statements:** id, bank_account_id, transaction_date, amount, description, category_auto, reconciled, transaction_id, raw_data (jsonb)

**financial.credit_opportunities:** id, source, institution_name, product_name, min_amount, max_amount, interest_rate_monthly, max_term_months, requirements (jsonb), target_audience, region, url, affiliate_url, valid_from, valid_until, is_active, last_checked_at

**financial.credit_suggestions:** id, user_id, opportunity_id, match_score (0-100), reasoning, status (suggested|viewed|clicked|applied|dismissed), suggested_at

**fiscal.das_records:** id, user_id, reference_month, due_date, amount, status (pendente|pago|vencido|isento), barcode, pix_code, payment_date, receipt_url, auto_generated

**fiscal.dasn_declarations:** id, user_id, reference_year, total_revenue, had_employee, status (rascunho|enviada|retificada), submission_receipt, submitted_at

**fiscal.nfse:** id, user_id, client_id, numero_nf, valor, descricao_servico, codigo_servico, status (emitida|cancelada|pendente), prefeitura_code, xml_url, pdf_url, emitted_at

**crm.clients:** id, user_id, name, email, phone, whatsapp_number, document, notes, total_revenue, last_contact_at, ai_agent_enabled, latitude, longitude, formatted_address, place_id, address_components (jsonb), location_notes

**crm.whatsapp_sessions:** id, user_id, instance_name, instance_id, status, qrcode_url, evolution_go_config (jsonb)

**crm.service_visits:** id, user_id, client_id, scheduled_date, scheduled_time, status, start_location_lat/lng, arrival_at, departure_at, route_distance_km, route_duration_min, notes, transaction_id

**ai.conversations:** id, user_id, agent_type (assistant|customer_service), client_id, channel (app|whatsapp), status, summary, started_at, ended_at

**ai.messages:** id, conversation_id, role (user|assistant|system|tool), content, metadata (jsonb), tokens_used, created_at

**ai.agent_memory:** id, user_id, agent_type, memory_type (fact|preference|context), content, relevance_score, expires_at

**billing.subscriptions:** id, user_id, plan (trial|monthly), status (trial|active|past_due|cancelled), trial_ends_at, current_period_start/end, payment_provider, external_subscription_id, cancelled_at

**billing.payments:** id, subscription_id, amount, status (paid|failed|refunded), payment_method, external_payment_id, paid_at

**legal.legislation_updates:** id, source, original_title, original_url, published_at, ai_summary, ai_impact_analysis, ai_action_required, impact_level (info|attention|urgent|critical), affects_all_mei, affected_cnaes, affected_regions, is_active

**legal.user_legislation_reads:** id, user_id, legislation_id, status (notified|read|discussed_with_ai), notified_at, read_at

**procurement.opportunities:** id, source, external_id, title, description, modality, type, entity_name, entity_level, uf, municipality, estimated_value, cnae_codes, category_keywords, edital_url, edital_pdf_url, published_at, proposals_deadline, session_date, status, is_exclusive_mpe, ai_summary, ai_requirements_simplified

**procurement.user_matches:** id, user_id, opportunity_id, match_score, match_reasons (jsonb), status, notified_at

**procurement.user_preferences:** id, user_id, watch_ufs, watch_municipalities, watch_cnaes, watch_keywords, min_value, max_value, modalities_interest, only_exclusive_mpe, notification_enabled

### Segurança DB
- RLS habilitado em TODAS as tabelas
- Política base: `user_id = auth.uid()`
- Assinatura ativa verificada via RLS para operações de escrita
- CPF/CNPJ criptografados com pgcrypto (pgp_sym_encrypt)
- Tokens de integração no Supabase Vault

---

## 5. Agentes IA

### Agente 1: Assistente Pessoal do MEI

**Orquestração:** LangGraph com nós Router → Fiscal/Finance/Advisory/General → Response

**Ferramentas:**
- consultar_faturamento, calcular_limite_mei, gerar_das, preencher_dasn
- emitir_nfse, consultar_situacao_cnpj, analisar_fluxo_caixa
- categorizar_transacao, buscar_calendario_fiscal, consultar_extrato_bancario
- buscar_oportunidades_credito, simular_financiamento
- buscar_atualizacoes_legais, explicar_legislacao, avaliar_impacto_fiscal
- buscar_licitacoes, explicar_edital, verificar_documentacao, calcular_proposta
- planejar_rota_dia, buscar_clientes_proximos, estimar_deslocamento

**Comportamento proativo:**
- Alerta de limite (80% do teto anual)
- Lembrete de DAS (5 dias antes)
- Aviso de DASN (jan-mai)
- Anomalia financeira
- Oportunidade fiscal, crédito, licitação

### Agente 2: Atendimento ao Cliente do MEI

**Orquestração:** LangGraph com nós Intake → Intent Classifier → Product/Order/Schedule/Handoff → Reply

**Ferramentas:**
- buscar_info_negocio, consultar_produtos_servicos
- verificar_disponibilidade, registrar_pedido
- escalar_para_humano, buscar_historico_cliente

**Configurável pelo MEI:** tom de voz, horário, informações do negócio, regras de escalação, FAQs.

### Infraestrutura IA

| Componente | Tecnologia |
|-----------|-----------|
| API | FastAPI (async) |
| Agentes | LangGraph |
| LLM | GPT-4o + Claude fallback |
| Embeddings | text-embedding-3-small + pgvector |
| Cache | Redis |
| Jobs | Redis + ARQ |
| Container | Docker |

**Comunicação:** App → Edge Function (JWT) → FastAPI → LangGraph. Streaming via SSE.

---

## 6. Integrações Externas (9 total)

### 1. Gov.br / Simples Nacional
Web scraping + API PGMEI. Geração DAS, situação cadastral, DASN. Edge Function agenda job → Python executa → Storage salva PDF.

### 2. Gateway de Pagamento (Asaas)
Trial 7 dias sem cartão → checkout in-app. Webhooks: payment.confirmed, subscription.cancelled, payment.overdue. RLS bloqueia acesso se assinatura expirada.

### 3. NFS-e (Prefeituras)
Via gateway intermediário (eNotas, Focus NFe). Padrão ABRASF 2.04. Emissão, consulta, cancelamento, download XML/PDF.

### 4. Open Finance Brasil
Via agregador certificado (Pluggy ou Belvo). OAuth2 para consentimento. Sync a cada 6h. IA categoriza transações automaticamente.

### 5. Evolution Go (WhatsApp)
Self-hosted Docker. Conexão via QR Code no app. Webhook → FastAPI → LangGraph. Envio via REST API. Painel de conversas no app.

### 6. Oportunidades de Crédito
Fontes: BNDES, PRONAMPE, Sebrae, Caixa, BB, fintechs (BizCapital, Nexoos, Creditas). Job semanal coleta ofertas → IA cruza com perfil → top 3 sugestões. Monetização adicional via links de afiliado.

### 7. Monitoramento de Legislação
Fontes: DOU (API INLABS), Portal Simples Nacional, Receita Federal, Sebrae, Planalto/Lexml, portais municipais. Job diário → LLM filtra impacto MEI → resumo humanizado → push notification.

### 8. Licitações e Compras Públicas
Fonte principal: PNCP (API REST pública). Complementares: ComprasNet, BLL, portais estaduais/municipais. Matchmaking por CNAE/UF/município. IA explica editais em linguagem simples.

### 9. Geolocalização e Mapas
Google Maps SDK + Google Places API (autocomplete) + Geocoding. Expo Location para GPS. Deep link para Google Maps/Waze. Rota otimizada para múltiplos clientes. Mapbox offline para áreas sem sinal.

---

## 7. Segurança e Autenticação

### Auth (Supabase Auth)
- Cadastro email/senha + Google + Apple + Gov.br (OAuth2)
- MFA (TOTP) para ações sensíveis
- Biometria (Fingerprint/Face ID) via Expo LocalAuthentication
- JWT: access 1h, refresh 30 dias
- Bloqueio após 5 tentativas falhas

### Proteção de dados
- CPF/CNPJ: pgcrypto encryption at rest, mascarado na UI
- Dados bancários: criptografados, nunca logados
- Tokens de integração: Supabase Vault
- Certificate pinning no app
- Bloqueio de screenshots em telas financeiras (FLAG_SECURE)
- Detecção de root/jailbreak
- Tela de bloqueio após 5 min inatividade

### LGPD
- Consentimento granular no onboarding
- Exportar meus dados (JSON/PDF)
- Excluir conta com cascade delete
- Portabilidade (CSV/JSON)
- Retenção: fiscal 5 anos, conversas IA 12 meses, logs 90 dias
- Tela "Privacidade e Dados" no app

### Segurança IA
- Prompt injection: system prompts blindados + input sanitization + guardrails
- Data isolation: cada chamada recebe apenas dados do user_id autenticado
- Rate limiting: 30 msgs/min, 500/dia
- Validação: respostas fiscais validadas contra DB real
- API keys em env vars, rotação mensal

---

## 8. Modo Offline (Offline-First)

### Arquitetura
App lê/escreve sempre no WatermelonDB (SQLite local). Sync Engine bidirecional com Supabase quando online. Sync queue (MMKV) armazena operações pendentes.

### Funcionalidades offline
✅ Registrar receitas/despesas, ver dashboard, lista de clientes, PDFs salvos, calendário fiscal, alertas já baixados.
❌ Chat IA, gerar DAS, emitir NFS-e, sync bancário, WhatsApp, pagamentos.

### Sync
- Detecção via NetInfo
- Fila processada em ordem cronológica ao voltar online
- Conflitos: server wins (fiscal), client wins (transações manuais)
- Banner de status: "📴 Offline — X operações pendentes"

### Cache proativo
Perfil, últimas 100 transações, clientes, PDFs recentes, calendário fiscal, tiles de mapa (~40 MB configurável).

---

## 9. MVP e Fases de Entrega

### Fase 1 — MVP (Mai-Set 2026) ~4 meses
Auth, onboarding, dashboard, financeiro (manual), fiscal (DAS + DASN), assistente IA básico, billing, segurança base, offline básico. Publicação Play Store + App Store.

### Fase 2 — Expansão (Set-Dez 2026) ~3 meses
NFS-e, Open Finance, agente WhatsApp, CRM completo, geolocalização + mapa de clientes.

### Fase 3 — Diferencial (Jan-Abr 2027) ~4 meses
Crédito, legislação, licitações, rota otimizada, analytics avançado.

### Estrutura do Repositório
```
MEIFlow/
├── apps/mobile/          # Expo app (TypeScript)
│   ├── app/              # Expo Router (file-based)
│   ├── components/
│   ├── hooks/
│   ├── services/
│   ├── stores/
│   ├── utils/
│   └── assets/
├── services/ai-service/  # Python AI Service
│   ├── app/              # FastAPI
│   ├── agents/           # LangGraph
│   ├── tools/
│   ├── integrations/
│   └── Dockerfile
├── supabase/
│   ├── migrations/
│   ├── functions/        # Edge Functions (Deno)
│   ├── seed.sql
│   └── config.toml
├── docs/
│   ├── plans/
│   ├── api/
│   └── architecture/
├── docker-compose.yml
└── README.md
```

### Métricas pós-lançamento
Downloads: 1K (MVP) → 10K (6 meses). Conversão trial→pago: 15→25%. Retenção 30d: 40→60%. NPS: 30→50+. Churn: <10→<5%.
