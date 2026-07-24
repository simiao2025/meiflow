# Changelog

Todas as mudanças notáveis do MEIFlow serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Added
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

### Fixed
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
