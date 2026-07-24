-- ============================================================
-- Migration 00019: Meta WhatsApp Business Cloud API
-- Adiciona colunas para integração OFICIAL com a Meta Cloud API,
-- paralelamente às colunas do Evolution Go (mantidas intactas).
-- A Meta API usa OAuth 2.0 PKCE + System User Access Token.
-- ============================================================

-- Garante que as colunas Evolution não sejam tocadas (paridade + segurança)
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS meta_waba_id TEXT,                -- WhatsApp Business Account ID
    ADD COLUMN IF NOT EXISTS meta_phone_number_id TEXT,       -- ID do número de telefone (sender)
    ADD COLUMN IF NOT EXISTS meta_phone_number TEXT,          -- Número E.164 (ex: 5511999999999)
    ADD COLUMN IF NOT EXISTS meta_access_token TEXT,          -- System User Access Token (long-lived)
    ADD COLUMN IF NOT EXISTS meta_token_expires_at TIMESTAMPTZ,  -- Data de expiração do token
    ADD COLUMN IF NOT EXISTS meta_business_id TEXT,           -- Meta Business Manager ID
    ADD COLUMN IF NOT EXISTS meta_status TEXT DEFAULT 'pending',  -- pending | connected | disconnected | error
    ADD COLUMN IF NOT EXISTS meta_connected_at TIMESTAMPTZ;   -- Timestamp de última conexão ativa

-- Notificar PostgREST para recarregar o cache de schema
NOTIFY pgrst, 'reload schema';
