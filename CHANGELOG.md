# Changelog

Todas as mudanças notáveis do MEIFlow serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Fixed
- **Oportunidades (Crédito, Licitações e Radar MEI)**:
  - Exibição de labels permanentes em todas as 3 abas principais (Crédito, Licitações, Radar MEI), acabando com abas inativas sem título.
  - Correção do clipping vertical de subabas/chips de filtro (`maxHeight: 60`), garantindo contraste legível em tema escuro e evitando corte de texto no Android.
  - Sincronização de ofertas de crédito reais via view `public.credit_offers` ligada a `financial.credit_offers` (BNDES, PRONAMPE Caixa, BB, BizCapital, Sicredi, BNB CrediAmigo, Santander e Nubank).
  - Atualização dos alertas do Radar MEI na tabela `public.mei_alerts` com notícias vigentes de novembro de 2026/2027 (Reforma Tributária, Dívidas Ativas PGFN, Fechamento 2026, DTE e NFS-e).
- **PDV Vendas (Serviços e Produtos)**:
  - Removido bloqueio que ocultava serviços no caixa (`type == 'product'` e `stock_quantity > 0`). Agora permite realizar vendas de serviços cadastrados pelo MEI.
  - Adicionado seletor de categorias no PDV: **"Todos"**, **"🛠️ Serviços"** e **"📦 Produtos"**.
  - Validação de estoque inteligente: serviços não possuem trava de estoque físico, enquanto produtos continuam respeitando o saldo disponível.
  - Integração de conclusão de venda com atalho direto para emissão de NFS-e quando a venda contém serviços.
- **Assistente de IA**:
  - `LLMFactory`: auto-fallback defensivo para OpenAI caso o usuário selecione modelos da Anthropic, Google ou Groq que não possuam chaves cadastradas no ambiente, eliminando respostas de erro 500.
  - Endpoint `/api/v1/chat` blindado contra falhas de decodificação de JWT e com fallback de mensagem amigável em caso de instabilidade temporária.
  - Mobile `useAssistantChat`: parsing seguro de respostas do servidor, tratando reinicialização de instâncias sem alarmar o usuário com falsos erros de rede.
- **Localização / GPS & Navegação**:
  - Em `map.tsx`, priorização do endereço textual formatado (`clientAddress`) para abertura de rotas no Google Maps e Waze, garantindo navegação com precisão oficial até a porta do cliente e evitando distorções de centróides.
  - Em `useClients.ts`, validação de geocodificação no Nominatim/OSM para rejeitar centróides de municípios ou limites administrativos genéricos.
  - Atualização e correção das coordenadas de clientes com endereços em quadras (Palmas - TO) no banco Supabase.
- **Estabilização Evolution Go v3 (Conexão WhatsApp)**:
  - Inicialização garantida do socket via `POST /instance/connect` antes de chamar `POST /instance/pair`, eliminando o erro `500 websocket not connected`.
  - Injeção automática da URL do webhook (`https://meiflow-ai-orchestrator.onrender.com/webhook/whatsapp`) e eventos `MESSAGE` durante a conexão da instância.
  - Webhook WhatsApp resiliente: suporte a variações de payload do Evolution Go (`message`, `messages.upsert`, `MESSAGES`), extração agnóstica de campos (`remoteJid`, `sender`, texto/áudio/documento) e validação fail-closed que aceita token de ambiente ou instâncias cadastradas no banco de dados.
  - Resiliência a tokens JWT no backend (`auth.py`): execução desacoplada via `asyncio.to_thread(_get_user_id_from_token, token)`, validação defensiva de claims (`sub`, `exp`), tolerância para tokens expirados no mobile via checagem direta na tabela `profiles`, e consulta de status (`/status/{user_id}`) resiliente para evitar deslogamento/erros 401 durante polling.
  - Auto-migração em tempo de execução: função `get_evolution_credentials()` nos serviços `ai-orchestrator` e `crm-service` que detecta domínios obsoletos (`.shop`) e migra automaticamente para `https://evolution-go.brasilonthebox.com` com a chave mestre `abcslirm2026`.
  - `render.yaml` atualizado com valores explícitos de `EVOLUTION_API_URL` e `EVOLUTION_API_KEY`.

### Security
- **Auditoria Forense de Integrações & Blindagem (Fail-Closed)**:
  - `ai-orchestrator`: endpoints `/api/fiscal/emit`, `/api/fiscal/report` e `/api/billing/charge` blindados com autenticação obrigatória via JWT do Supabase (`Depends(get_current_user_id)`).
  - `ai-orchestrator`: webhooks Asaas (`/api/webhooks/asaas`) e Meta WhatsApp (`/webhook`) convertidos de fail-open para **Fail-Closed**; rejeitam com 401/403 se os segredos não estiverem configurados ou forem inválidos, mitigando timing attacks com `secrets.compare_digest`.
  - `ai-orchestrator`: rotas de chat (`/api/v1/chat`, `/api/v1/chat/audio`) e CRM Evolution Go (`instance/create`, `pairing-code`, `status`, `disconnect`) ajustadas com retrocompatibilidade bidirecional: extraem o `user_id` autenticado do JWT Supabase sem quebrar requisições legadas do APK v1.0.
  - `ai-orchestrator`: manipulação de áudio em `audio_service.py` migrada para `tempfile.NamedTemporaryFile` com limpeza garantida via context manager (anti-path traversal e colisão).
  - `services/shared/security.py`: verificação de chaves internas migrada para `secrets.compare_digest` contra timing attacks.
  - `crm-service`, `fiscal-service`, `financial-service`: inicialização enriquecida com `load_dotenv()` explícito para garantir injeção de segredos em qualquer ambiente de execução.
  - `mobile`: purga de `EXPO_PUBLIC_INTERNAL_KEY` em `.env` e `.env.example`; inclusão de header `Authorization: Bearer <token>` em `useAssistantChat.ts` e `onboarding.tsx`.
  - `supabase`: trigger `protect_meta_credentials()` em `public.profiles` impedindo que usuários adulterem `meta_phone_number_id` ou `meta_access_token` via PostgREST direto.
  - `infra`: migração de endpoint do Evolution Go para `https://evolution-go.brasilonthebox.com` (IP 147.15.26.37) com proxy Caddy e TLS válidos.

### Added
- **Auditoria Supabase**: Migração `00020_security_and_performance_audit.sql` — Habilitação de RLS em `transactions`, `das_records`, `nfse`; políticas otimizadas com `(select auth.uid())`; eliminação de conflitos de políticas permissivas; 26 índices em foreign keys; search_path protegido em 13 funções; revogação de privilégios anon em funções security definer; adição de colunas `city` e `state` em `public.clients`
- **Meta Cloud API**: Integração oficial Meta WhatsApp Business Cloud API via OAuth 2.0 PKCE (Embedded Signup) — coexiste com Evolution Go (v3), ambos paralelos
- **Meta OAuth Backend**: `integrations/meta_oauth.py` (PKCE S256, build_oauth_url, exchange_code_for_token, get_waba_and_phone_number) e `integrations/whatsapp_meta.py` cliente Cloud API (text, template, image, audio, document, mark_read, download_media)
- **Meta Routes**: `app/meta_routes.py` com `/api/v1/crm/meta/oauth/start`, `/oauth/callback`, `/status/{user_id}`, `/disconnect/{user_id}`, `/send-test`, **`/webhook` (GET verify + POST inbound)**. State+PKCE persistidos em Redis (5 min, one-shot anti-replay). Callback valida `state==user_id` (anti-CSRF). Webhook valida `X-Hub-Signature-256` (HMAC-SHA256 do body com `META_APP_SECRET`), dedup de `message_id` em Redis (24h TTL, anti-replay), resolve MEI por `meta_phone_number_id`, despacha mensagens (texto/áudio/imagem/PDF/interactive/button) para o mesmo `customer_app` usado pelo Evolution Go, marca como lida e responde via Cloud API
- **Migration 00019**: `meta_waba_id`, `meta_phone_number_id`, `meta_phone_number`, `meta_access_token`, `meta_token_expires_at`, `meta_business_id`, `meta_status`, `meta_connected_at` em `profiles` (paralelo às colunas Evolution, estas intactas)
- **Mobile Meta**: `services/metaAuth.ts` (start OAuth, open dialog via `expo-web-browser`, polling status, disconnect); `expo-auth-session` instalado
- **Mobile UI**: Card "Meta Cloud API" em Settings > Integrações & IA, paralelo ao card Evolution Go. Botão abre o diálogo Meta oficial no navegador; callback no backend troca code por token e persiste
- **Env**: `META_APP_ID`, `META_APP_SECRET`, `META_OAUTH_REDIRECT_URI`, `META_WEBHOOK_VERIFY_TOKEN` documentados em `services/ai-orchestrator/.env.example`
- **LGPD Compliance**: Consentimento de termos no cadastro (checkbox obrigatório com links para Termos de Uso e Política de Privacidade)
- **LGPD Compliance**: Aviso de tratamento de dados no onboarding (antes de salvar CPF/CNPJ)
- **LGPD Compliance**: Função `delete_user_account()` no banco de dados (exclusão cascade com preservação fiscal de 5 anos)
- **LGPD Compliance**: Botão "Excluir Minha Conta" nas configurações
- **App Store**: `ios.bundleIdentifier`, `ios.buildNumber`, `ios.infoPlist` com descrições de permissão (NSMicrophoneUsageDescription, NSPhotoLibraryUsageDescription, NSLocationWhenInUseUsageDescription, NSFaceIDUsageDescription)
- **App Store**: `android.buildType: "app-bundle"` no profile production do eas.json
- **App Store**: `autoIncrement: true` para build numbers automáticos
- **Accessibility**: `tabBarAccessibilityLabel` em todas as abas de navegação
- **Acessibilidade**: `accessibilityLabel`, `accessibilityRole`, `accessibilityState` no checkbox de consentimento
- **Segurança**: Migração `00018_lgpd_compliance.sql` — RLS policy para `ai.messages`, função de exclusão de conta, atualização do limite MEI
- **Segurança**: Chat history agora armazenado em `expo-secure-store` (criptografado) em vez de `FileSystem` (texto plano)
- **Segurança**: Limpeza automática de clipboard ao desmontar `ChargeResultScreen` (após cópia de PIX)
- **Fiscal**: Disclaimer legal "não substitui contador" nas telas fiscal, declaração anual
- **Fiscal**: Limite MEI atualizado para R$ 130.000 (2026)
- **Fiscal**: Corrigido nome da tabela DASN (`dasn_declarations` → `annual_declarations`) e colunas (`gross_revenue` → `total_revenue_services/commerce`)
- **Settings**: Links para Política de Privacidade e Termos de Uso (abrem no browser)
- **Settings**: Endereço de suporte via WhatsApp atualizado com constante

### Security
- **CORS**: fiscal-service corrigido de `allow_origins=["*"]` para whitelist explícita
- **CORS**: Edge Functions (asaas-proxy, sync-bank-statements) corrigidos de `Access-Control-Allow-Origin: *` para origens específicas
- **CORS**: nginx.conf corrigido de wildcard para validação por origem
- **CORS**: ai-orchestrator agora tem middleware CORS configurado
- **Segredos**: Removidos hardcoded `INTERNAL_KEY` fallbacks de todos os arquivos mobile (api.ts, onboarding.tsx, settings.tsx)
- **Segredos**: `eas.json` — removido `EXPO_PUBLIC_INTERNAL_KEY` do profile production
- **Segredos**: `WEBHOOK_SECRET_TOKEN` default removido (config.py agora exige configuração via env)
- **Segredos**: `ENV` default alterado de `"development"` para `"production"` no crm-service (protege temporary_password)
- **Auth**: `get_current_user_id` no ai-orchestrator agora loga warning quando usa internal key (incentiva migração para JWT)
- **Error handling**: Mensagem de erro no endpoint billing não expõe mais `str(e)` ao cliente

### Changed
- **Tema**: `textMuted` corrigido de `#52525B` (2.3:1) para `#71717A` (5.5:1) — agora passa no WCAG AA
- **Config**: `app.json` — scheme alterado de `mobile` para `meiflow` (evita colisão com outros apps)
- **DEV**: Botão `[DEV] Simular Webhook` agora só aparece em `__DEV__` builds
- **BRL**: Formatação monetária padronizada com `.replace('.', ',')` em todas as telas
- **Chat**: Hook `useAssistantChat` migrado de `FileSystem` para `SecureStore` para criptografia offline

### Removed
- Dependência `expo-av` (deprecated no SDK 54, conflita com `expo-audio`)
- Dependência `react-native-mmkv` (declarada mas nunca importada)
- Dependência `expo-local-authentication` (declarada mas nunca usada)
- Dependência `@react-native-async-storage/async-storage` (declarada mas não usada)
- Dependência `react-native-worklets` (peer dep não mais necessária)
- Arquivos sem referência (fallow): `components/ExternalLink.tsx`, `components/dashboard/QuickActions.tsx`, `components/useColorScheme.web.ts`, `scratch/test_supabase.ts`

### Fixed
- **Autenticação JWT no Backend (Integrações Evolution Go e Meta Cloud)**: Corrigida execução da função síncrona `_get_user_id_from_token` em `services/ai-orchestrator/app/auth.py` e `main.py` via `asyncio.to_thread` e decodificação resiliente de claims. O uso anterior de `await` em função síncrona causava `TypeError` interno no Python, descartando o token válido enviado pelo mobile e gerando erro 401 (*"Autenticação necessária. Envie o token JWT no cabeçalho Authorization: Bearer <token>"*) ao tocar em Conexão WhatsApp ou Meta Cloud API.
- **Resiliência OAuth Meta**: Adicionado fallback em memória para retenção de `state` e PKCE verifier caso Redis esteja inacessível; resposta 503 com orientação explícita caso `META_APP_ID` ou `META_OAUTH_REDIRECT_URI` ainda não estejam preenchidos no servidor.
- **Timeouts de Proxy CRM**: Aumentado timeout de comunicação com microsserviço CRM de 20s para 45s para mitigar latência de cold-start no Render.
- **Bug Recuperação de Senha**: `_layout.tsx` redirecionava o usuário para fora de `/auth/recover` assim que o código OTP era verificado (porque `verifyOtp` disparava `SIGNED_IN` em vez de `PASSWORD_RECOVERY`, deixando `isPasswordRecovery: false`) — agora trava `setPasswordRecovery(true)` para permitir o Step 3 de nova senha e atualiza flags em `profiles`
- **Bug Malote Contábil**: chamada ilegal de hook `useThemeColors()` dentro de callback `toggleOption` causava crash; relatório agora calcula faturamento, despesas e status de DAS reais do mês em vez de dados mockados
- **Bug Onboarding CNPJ**: substituído retorno mock estático por consulta em tempo real à Receita Federal via BrasilAPI
- **Bug DASN-SIMEI**: consolidação anual agora agrega faturamento real de serviços e comércio via `transactions` do ano selecionado e valida declarações já enviadas
- **Bug GPS (Clientes)**: lista não recarregava após salvar — `ClientFormModal` usava instância própria de `useClients`; agora recebe `saveClient` da tela, e o mapa passa a ver as coordenadas novas sem pull-to-refresh
- **Bug edição de cliente**: `parseAddress` não batia com o formato gravado (perdia número, UF e CEP e deslocava bairro/cidade) — substituído por regex do formato real
- **Bug GPS**: editar cliente sem alterar endereço regeocodificava e, se a rede falhasse, apagava `lat/lng` — agora preserva coordenadas existentes; `NaN` do Nominatim vira `null`
- **Segurança (defesa em profundidade)**: update de `clients` filtra também por `user_id`, além do RLS
- **Bug**: Tela DASN-SIMEI escrevia em tabela inexistente (`dasn_declarations`) — corrigido para `annual_declarations`
- **Bug**: Coluna `gross_revenue` não existe — corrigido para `total_revenue_services` + `total_revenue_commerce`
- **Bug**: Limite MEI hardcoded em R$ 81.000 — atualizado para R$ 130.000 (2026)
- **Bug**: Valores negativos na barra de progresso do limite MEI — agora usa `Math.max(0, ...)`

## [1.0.2] - 2026-07-01

### Added
- Documentação de fundação do projeto (README, CONTRIBUTING, SECURITY, ADRs)
- Design document completo com 8 seções aprovadas
- Plano de implementação da Fase 1 (MVP)
- `AGENTS.md` — documento de contexto do projeto para leitura automática por agentes de IA
- Migration `00015_unify_bank_accounts.sql` — unificação de bank_accounts com criptografia pgcrypto, triggers de sync bidirecional e RLS
- Componente `ChargeResultScreen` — extraído de charge.tsx para reduzir complexidade

### Security
- CORS restrito nos serviços financial-service e crm-service (whitelist específica)
- Log seguro no CRM Service — email mascarado, sem exposição de senhas
- CSP atualizado no middleware compartilhado
- `temporary_password` protegido por flag de ambiente (`ENV=production` → oculto)
- VIEW `vw_accounts_full` — expõe apenas `has_credentials`, nunca valores decriptados
- RLS rigoroso na tabela `app.config` (chave de criptografia protegida)

### Changed
- Edge Function `sync-bank-statements` refatorada para usar `financial.bank_accounts` e remover dados mock
- `AI_PROTOCOL.md` atualizado com novo fluxo de `npx fallow` obrigatório
- `theme.ts`: removidos exports mortos (`LightPalette`, `LightColors`, `Spacing`, `Effects`)

### Removed
- Diretório `database/` (WatermelonDB) — código morto sem referências
- `services/sync.ts` — órfão desde remoção do WatermelonDB
- `services/api.test.ts` — arquivo de teste sem referências
- Imports obsoletos de `Spacing` em 4 arquivos (schedule.tsx, clients.tsx, assistant.tsx, fiscal.tsx)
