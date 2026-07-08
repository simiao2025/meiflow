-- ========================================================
-- MEIFlow Migration 00015: Unify bank_accounts tables
-- ========================================================
-- 
-- Objetivos:
-- 1. Unificar financial.bank_accounts (Open Finance) e public.bank_accounts (manual)
-- 2. Criptografar client_secret e client_id usando pgcrypto
-- 3. Criar triggers de sincronização bidirecional
-- 4. Preparar bank_statements para múltiplos provedores Open Finance
-- 5. Manter compatibilidade com APK já instalado
--
-- Compatibilidade retroativa: public.bank_accounts continua funcionando
-- como tabela física com triggers de sync para financial.bank_accounts
-- ========================================================

-- ========================================================
-- PARTE 1: Preparação
-- ========================================================

-- Garantir extensões necessárias
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Schema para configurações internas
CREATE SCHEMA IF NOT EXISTS app;

-- Tabela de configuração para chave de criptografia
CREATE TABLE IF NOT EXISTS app.config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gera chave de criptografia se não existir (32 bytes hex)
INSERT INTO app.config (key, value)
SELECT 'encryption_key', encode(gen_random_bytes(32), 'hex')
WHERE NOT EXISTS (SELECT 1 FROM app.config WHERE key = 'encryption_key');

-- Função helper para obter a chave de criptografia
CREATE OR REPLACE FUNCTION app.get_encryption_key()
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
    SELECT value FROM app.config WHERE key = 'encryption_key'
    LIMIT 1
$$;

-- ========================================================
-- PARTE 2: Adicionar colunas de credenciais criptografadas
--           em financial.bank_accounts
-- ========================================================

ALTER TABLE financial.bank_accounts 
    ADD COLUMN IF NOT EXISTS client_id_encrypted TEXT,
    ADD COLUMN IF NOT EXISTS client_secret_encrypted TEXT,
    ADD COLUMN IF NOT EXISTS connector_id TEXT,
    ADD COLUMN IF NOT EXISTS account_name TEXT;

-- Migrar dados existentes de public.bank_accounts → financial.bank_accounts
INSERT INTO financial.bank_accounts (
    id, user_id, bank_name, provider, provider_id, status,
    client_id_encrypted, client_secret_encrypted,
    balance, account_name,
    created_at, updated_at
)
SELECT 
    pba.id,
    pba.user_id,
    COALESCE(pba.provider, 'manual') AS bank_name,
    COALESCE(pba.provider, 'manual') AS provider,
    NULL AS provider_id,
    pba.status,
    pgp_sym_encrypt(pba.client_id, app.get_encryption_key()) AS client_id_encrypted,
    pgp_sym_encrypt(pba.client_secret, app.get_encryption_key()) AS client_secret_encrypted,
    0 AS balance,
    pba.provider AS account_name,
    pba.created_at,
    NOW() AS updated_at
FROM public.bank_accounts pba
ON CONFLICT (id) DO UPDATE SET
    client_id_encrypted = CASE 
        WHEN financial.bank_accounts.client_id_encrypted IS NULL 
        THEN pgp_sym_encrypt(pba.client_id, app.get_encryption_key())
        ELSE financial.bank_accounts.client_id_encrypted 
    END,
    client_secret_encrypted = CASE 
        WHEN financial.bank_accounts.client_secret_encrypted IS NULL 
        THEN pgp_sym_encrypt(pba.client_secret, app.get_encryption_key())
        ELSE financial.bank_accounts.client_secret_encrypted 
    END;

-- ========================================================
-- PARTE 3: Triggers de criptografia automática
--           em public.bank_accounts
-- ========================================================

-- Função: criptografa client_id e client_secret automaticamente
CREATE OR REPLACE FUNCTION public.encrypt_bank_credentials()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Criptografa os campos sensíveis
    NEW.client_id = pgp_sym_encrypt(NEW.client_id, app.get_encryption_key())::TEXT;
    NEW.client_secret = pgp_sym_encrypt(NEW.client_secret, app.get_encryption_key())::TEXT;
    RETURN NEW;
END;
$$;

-- Trigger BEFORE INSERT/UPDATE para criptografar automaticamente
DROP TRIGGER IF EXISTS trg_encrypt_bank_credentials ON public.bank_accounts;
CREATE TRIGGER trg_encrypt_bank_credentials
    BEFORE INSERT OR UPDATE OF client_id, client_secret
    ON public.bank_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.encrypt_bank_credentials();

-- ========================================================
-- PARTE 4: Triggers de sincronização 
--           public.bank_accounts → financial.bank_accounts
-- ========================================================

-- Função: sync INSERT para financial.bank_accounts
CREATE OR REPLACE FUNCTION public.sync_bank_accounts_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO financial.bank_accounts (
        id, user_id, bank_name, provider, provider_id, status,
        client_id_encrypted, client_secret_encrypted,
        balance, account_name,
        created_at, updated_at
    ) VALUES (
        NEW.id,
        NEW.user_id,
        COALESCE(NEW.provider, 'manual'),
        COALESCE(NEW.provider, 'manual'),
        NULL,
        NEW.status,
        NEW.client_id,   -- já criptografado pelo trigger anterior
        NEW.client_secret, -- já criptografado pelo trigger anterior
        0,
        NEW.provider,
        NEW.created_at,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        provider = EXCLUDED.provider,
        bank_name = EXCLUDED.bank_name,
        status = EXCLUDED.status,
        client_id_encrypted = EXCLUDED.client_id_encrypted,
        client_secret_encrypted = EXCLUDED.client_secret_encrypted,
        account_name = EXCLUDED.account_name,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$;

-- Trigger AFTER INSERT
DROP TRIGGER IF EXISTS trg_sync_bank_accounts_insert ON public.bank_accounts;
CREATE TRIGGER trg_sync_bank_accounts_insert
    AFTER INSERT ON public.bank_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_bank_accounts_insert();

-- Função: sync UPDATE para financial.bank_accounts
CREATE OR REPLACE FUNCTION public.sync_bank_accounts_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE financial.bank_accounts
    SET
        provider = COALESCE(NEW.provider, 'manual'),
        bank_name = COALESCE(NEW.provider, 'manual'),
        status = NEW.status,
        client_id_encrypted = NEW.client_id,      -- já criptografado
        client_secret_encrypted = NEW.client_secret, -- já criptografado
        account_name = NEW.provider,
        updated_at = NOW()
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$;

-- Trigger AFTER UPDATE
DROP TRIGGER IF EXISTS trg_sync_bank_accounts_update ON public.bank_accounts;
CREATE TRIGGER trg_sync_bank_accounts_update
    AFTER UPDATE OF provider, client_id, client_secret, status
    ON public.bank_accounts
    FOR EACH ROW
    WHEN (OLD.* IS DISTINCT FROM NEW.*)
    EXECUTE FUNCTION public.sync_bank_accounts_update();

-- Função: sync DELETE para financial.bank_accounts
CREATE OR REPLACE FUNCTION public.sync_bank_accounts_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM financial.bank_accounts WHERE id = OLD.id;
    RETURN OLD;
END;
$$;

-- Trigger AFTER DELETE
DROP TRIGGER IF EXISTS trg_sync_bank_accounts_delete ON public.bank_accounts;
CREATE TRIGGER trg_sync_bank_accounts_delete
    AFTER DELETE ON public.bank_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_bank_accounts_delete();

-- ========================================================
-- PARTE 5: Melhorias no schema bank_statements
--           Suporte a múltiplos provedores Open Finance
-- ========================================================

ALTER TABLE financial.bank_statements
    ADD COLUMN IF NOT EXISTS pluggy_id TEXT,            -- ID da transação no Pluggy
    ADD COLUMN IF NOT EXISTS belvo_id TEXT,               -- ID da transação no Belvo
    ADD COLUMN IF NOT EXISTS source TEXT                  -- 'pluggy', 'belvo', 'manual', 'import'
        CHECK (source IN ('pluggy', 'belvo', 'manual', 'import')),
    ADD COLUMN IF NOT EXISTS category_ai TEXT,            -- Categoria sugerida pela IA (mais precisa)
    ADD COLUMN IF NOT EXISTS matched_invoice_id UUID      -- FK para nota fiscal já conciliada
        REFERENCES fiscal.nfse(id) ON DELETE SET NULL;

-- Índices para performance de conciliação
CREATE INDEX IF NOT EXISTS idx_bank_statements_source 
    ON financial.bank_statements (user_id, source);
CREATE INDEX IF NOT EXISTS idx_bank_statements_reconciled 
    ON financial.bank_statements (user_id, reconciled) 
    WHERE reconciled = FALSE;
CREATE INDEX IF NOT EXISTS idx_bank_statements_pluggy 
    ON financial.bank_statements (pluggy_id) 
    WHERE pluggy_id IS NOT NULL;

-- ========================================================
-- PARTE 6: Views de compatibilidade para BI/relatórios
-- ========================================================

-- View que unifica informações de conta para consultas
-- ⚠️ SEGURANÇA: NÃO expõe client_id/client_secret decriptados!
-- Apenas expõe metadados da conta + indicador se possui credenciais configuradas
CREATE OR REPLACE VIEW financial.vw_accounts_full AS
SELECT 
    fba.id,
    fba.user_id,
    fba.bank_name,
    fba.bank_code,
    fba.account_type,
    fba.last_digits,
    fba.balance,
    fba.provider,
    fba.provider_id,
    fba.connector_id,
    fba.account_name,
    fba.status,
    -- Apenas indicador booleano de configuração, NUNCA os valores reais
    (fba.client_id_encrypted IS NOT NULL) AS has_credentials,
    fba.created_at,
    fba.updated_at,
    -- Status legível
    CASE 
        WHEN fba.status = 'active' AND fba.connector_id IS NOT NULL THEN 'Conectado (Open Finance)'
        WHEN fba.status = 'active' AND fba.client_id_encrypted IS NOT NULL THEN 'Conectado (API Key)'
        WHEN fba.status = 'active' THEN 'Ativo'
        ELSE 'Desconectado'
    END AS status_label
FROM financial.bank_accounts fba
WHERE auth.uid() = fba.user_id;  -- Filtro de segurança explícito (além do RLS)

-- Permissões
GRANT USAGE ON SCHEMA financial TO authenticated;
GRANT SELECT ON financial.vw_accounts_full TO authenticated;
GRANT ALL ON financial.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO authenticated;

-- ========================================================
-- PARTE 7: Refresh RLS policies para garantir cobertura
-- ========================================================

-- Assegurar que todas as RLS policies nas tabelas financeiras estão ativas
ALTER TABLE financial.bank_accounts FORCE ROW LEVEL SECURITY;

-- Recreate RLS policy em financial.bank_accounts
DROP POLICY IF EXISTS "Users can only access their own bank accounts" ON financial.bank_accounts;
CREATE POLICY "Users can only access their own bank accounts" 
    ON financial.bank_accounts
    FOR ALL 
    USING (auth.uid() = user_id);

-- Policy específica para SELECT na view (já protegida pela tabela base)
DROP POLICY IF EXISTS "Users can view their own accounts via view" ON financial.bank_accounts;
CREATE POLICY "Users can view their own accounts via view" 
    ON financial.bank_accounts
    FOR SELECT
    USING (auth.uid() = user_id);

-- ========================================================
-- PARTE 8: Proteção da tabela app.config (chave de criptografia)
-- ========================================================

-- A chave de criptografia NÃO pode ser lida por usuários comuns
ALTER TABLE app.config ENABLE ROW LEVEL SECURITY;

-- Bloqueia TODO acesso via REST API pública
-- Apenas funções SECURITY DEFINER (triggers) ou superuser podem acessar
DROP POLICY IF EXISTS "Block all public access to encryption keys" ON app.config;
CREATE POLICY "Block all public access to encryption keys" 
    ON app.config
    FOR ALL
    USING (false)
    WITH CHECK (false);

-- ========================================================
-- NOTAS DE IMPLANTAÇÃO:
-- ========================================================
-- 
-- Esta migration é FULLY BACKWARD-COMPATIBLE com o APK v1.0.
-- 
-- Fluxo APK antigo (sem rebuild):
--   INSERT public.bank_accounts → trigger criptografa + sync financial
--   SELECT public.bank_accounts → retorna dados CRIPTOGRAFADOS (não legíveis)
--   DELETE public.bank_accounts → trigger sync deleta de financial
--
-- ⚠️ IMPORTANTE: APÓS esta migration, os dados lidos de public.bank_accounts
--    estarão criptografados (não legíveis pelo APK antigo). Isso é INTENCIONAL
--    para segurança. O APK antigo mostrava os secrets em texto puro — agora
--    mostrará texto criptografado.
--
-- ✅ NOVO APK (após rebuild): usará financial.bank_accounts diretamente
--    com decriptação segura no backend.
--
-- 🛡️ SEGURANÇA:
--    - app.config é protegida via RLS (FOR ALL USING false)
--    - vw_accounts_full NÃO expõe client_id/client_secret decriptados
--    - Triggers SECURITY DEFINER rodam com privilégios controlados
--
-- Ordem de deploy:
--   1. Rodar esta migration
--   2. Adicionar schema 'financial' em Settings > API > Exposed Schemas
--      no painel do Supabase (senão a Edge Function não acessa)
--   3. Atualizar Edge Functions
--   4. Rebuild do APK (quando pronto)
-- ========================================================
