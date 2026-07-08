-- ========================================================
-- MEIFlow Migration 00016: Pluggy Open Finance Integration
-- ========================================================
--
-- Objetivos:
-- 1. Criar financial.pluggy_connectors (OAuth consent management)
-- 2. Adicionar pluggy_item_id em financial.bank_accounts
-- 3. Adicionar dedup_hash em financial.bank_statements
-- 4. Criar financial.sync_logs (rastreio de sincronização)
-- 5. Criar financial.pluggy_webhook_events (webhook inbox)
-- 6. Deprecar public.bank_accounts (remover triggers)
-- 7. Atualizar vw_accounts_full para refletir novo schema
-- 8. Funções seguras para upsert com dedup
--
-- ⚠️ Open Finance é a ÚNICA forma de integração a partir desta migration.
--    public.bank_accounts é mantida como snapshot LEGADO (apenas leitura).
--    Nenhum trigger de sync ou escrita deve existir nela.
-- ========================================================

-- ========================================================
-- PARTE 0: Garantir extensões
-- ========================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ========================================================
-- PARTE 1: financial.pluggy_connectors
--           Gerencia conexões OAuth com Pluggy
-- ========================================================
CREATE TABLE IF NOT EXISTS financial.pluggy_connectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,                         -- Pluggy item ID (único por usuário)
    connector_id TEXT NOT NULL,                    -- Pluggy connector ID (ex: 'banco-do-brasil')
    connector_name TEXT,                           -- Nome legível (ex: 'Banco do Brasil')
    institution_name TEXT,                         -- Nome da instituição financeira
    institution_number TEXT,                       -- Código do banco (ex: '001')
    status TEXT NOT NULL DEFAULT 'created'
        CHECK (status IN ('created', 'waiting_user_input', 'updating', 'login_succeeded', 'login_error')),
    created_via TEXT DEFAULT 'mobile',             -- 'mobile', 'webhook'
    error_details JSONB,                          -- Último erro (se houver)
    last_sync_at TIMESTAMPTZ,                     -- Última sincronização bem-sucedida
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Garante que cada item Pluggy seja único no sistema
    CONSTRAINT uq_pluggy_item_per_user UNIQUE (user_id, item_id),
    CONSTRAINT uq_pluggy_item_id UNIQUE (item_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_pluggy_connectors_user 
    ON financial.pluggy_connectors (user_id);
CREATE INDEX IF NOT EXISTS idx_pluggy_connectors_item 
    ON financial.pluggy_connectors (item_id);
CREATE INDEX IF NOT EXISTS idx_pluggy_connectors_status 
    ON financial.pluggy_connectors (user_id, status);

-- RLS
ALTER TABLE financial.pluggy_connectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own pluggy connectors"
    ON financial.pluggy_connectors
    FOR ALL
    USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION financial.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pluggy_connectors_updated_at ON financial.pluggy_connectors;
CREATE TRIGGER trg_pluggy_connectors_updated_at
    BEFORE UPDATE ON financial.pluggy_connectors
    FOR EACH ROW
    EXECUTE FUNCTION financial.set_updated_at();

-- ========================================================
-- PARTE 2: Atualizar financial.bank_accounts
--           Garantir colunas necessárias + referência Pluggy
-- ========================================================

-- Garantir que todas as colunas usadas pela view vw_accounts_full existem
-- (podem faltar se migrations 00004/00015 não foram executadas)
ALTER TABLE financial.bank_accounts
    ADD COLUMN IF NOT EXISTS account_type TEXT CHECK (account_type IN ('corrente', 'poupanca', 'pagamento', 'credito', 'investimento')),
    ADD COLUMN IF NOT EXISTS last_digits TEXT,
    ADD COLUMN IF NOT EXISTS balance NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'pluggy',
    ADD COLUMN IF NOT EXISTS provider_id TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS client_id_encrypted TEXT,
    ADD COLUMN IF NOT EXISTS client_secret_encrypted TEXT,
    ADD COLUMN IF NOT EXISTS connector_id TEXT,
    ADD COLUMN IF NOT EXISTS account_name TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS pluggy_item_id TEXT,
    ADD COLUMN IF NOT EXISTS is_connector_managed BOOLEAN DEFAULT TRUE;

-- Adicionar FK (via trigger/check pois item_id não é PK da tabela pluggy_connectors)
-- Usamos um CHECK que valida via função (mais flexível que FK direta)
CREATE OR REPLACE FUNCTION financial.validate_pluggy_item()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.pluggy_item_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM financial.pluggy_connectors 
            WHERE item_id = NEW.pluggy_item_id 
              AND user_id = NEW.user_id
        ) THEN
            RAISE EXCEPTION 'pluggy_item_id % does not exist for this user', NEW.pluggy_item_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_pluggy_item ON financial.bank_accounts;
CREATE TRIGGER trg_validate_pluggy_item
    BEFORE INSERT OR UPDATE OF pluggy_item_id
    ON financial.bank_accounts
    FOR EACH ROW
    WHEN (NEW.pluggy_item_id IS NOT NULL)
    EXECUTE FUNCTION financial.validate_pluggy_item();

-- Índice para busca por pluggy_item_id
CREATE INDEX IF NOT EXISTS idx_bank_accounts_pluggy_item 
    ON financial.bank_accounts (pluggy_item_id) 
    WHERE pluggy_item_id IS NOT NULL;

-- ========================================================
-- PARTE 3: financial.bank_statements
--           Criação (se não existir) + dedup hash
-- ========================================================

-- A tabela financial.bank_statements é criada originalmente na migration 00013.
-- Caso ela não exista no banco (ex: migrações aplicadas fora de ordem),
-- criamos aqui com a estrutura completa + as melhorias da migration 00016.
CREATE TABLE IF NOT EXISTS financial.bank_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_account_id UUID REFERENCES financial.bank_accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    description TEXT,
    category_auto TEXT,
    reconciled BOOLEAN DEFAULT FALSE,
    transaction_id TEXT,                           -- ID no provedor externo (ex: Pluggy)
    raw_data JSONB,
    -- Colunas adicionadas na migration 00015
    pluggy_id TEXT,                                -- ID da transação no Pluggy
    belvo_id TEXT,                                 -- ID da transação no Belvo
    source TEXT DEFAULT 'pluggy'
        CHECK (source IN ('pluggy', 'belvo', 'manual', 'import')),
    category_ai TEXT,                              -- Categoria sugerida pela IA
    matched_invoice_id UUID,                       -- FK opcional para fiscal.nfse (se existir)
    -- Colunas adicionadas na migration 00016
    dedup_hash TEXT,                               -- Hash único (pluggy_id + amount + date)
    sync_id UUID,                                  -- FK para sync_logs
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (garantir que está ativo)
ALTER TABLE financial.bank_statements ENABLE ROW LEVEL SECURITY;

-- FK condicional para fiscal.nfse (se a tabela existir)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'fiscal' AND c.relname = 'nfse'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint con
            JOIN pg_namespace n ON n.oid = con.connamespace
            WHERE con.conname = 'fk_bank_statements_matched_invoice'
            AND n.nspname = 'financial'
        ) THEN
            EXECUTE 'ALTER TABLE financial.bank_statements
                ADD CONSTRAINT fk_bank_statements_matched_invoice
                FOREIGN KEY (matched_invoice_id)
                REFERENCES fiscal.nfse(id)
                ON DELETE SET NULL
                NOT VALID';
        END IF;
    END IF;
END;
$$;

-- Policy (IF NOT EXISTS para ser idempotente)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'bank_statements' 
        AND schemaname = 'financial'
        AND policyname = 'Users can access their own bank statements'
    ) THEN
        CREATE POLICY "Users can access their own bank statements"
            ON financial.bank_statements
            FOR ALL
            USING (auth.uid() = user_id);
    END IF;
END;
$$;

-- Função para gerar hash de deduplicação
CREATE OR REPLACE FUNCTION financial.generate_dedup_hash(
    p_pluggy_id TEXT,
    p_amount NUMERIC,
    p_date DATE
)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
    SELECT encode(
        digest(
            COALESCE(p_pluggy_id, '') || '|' || 
            COALESCE(p_amount::TEXT, '0') || '|' || 
            COALESCE(p_date::TEXT, ''),
            'sha256'
        ),
        'hex'
    );
$$;

-- Trigger: gerar dedup_hash automaticamente em INSERT/UPDATE
CREATE OR REPLACE FUNCTION financial.set_dedup_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.dedup_hash = financial.generate_dedup_hash(
        NEW.pluggy_id,
        NEW.amount,
        NEW.transaction_date
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bank_statements_dedup_hash ON financial.bank_statements;
CREATE TRIGGER trg_bank_statements_dedup_hash
    BEFORE INSERT OR UPDATE OF pluggy_id, amount, transaction_date
    ON financial.bank_statements
    FOR EACH ROW
    WHEN (NEW.pluggy_id IS NOT NULL)
    EXECUTE FUNCTION financial.set_dedup_hash();

-- Índice único para dedup_hash (quando não for NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_statements_dedup_hash 
    ON financial.bank_statements (dedup_hash) 
    WHERE dedup_hash IS NOT NULL;

-- Índices de performance (se não existirem)
CREATE INDEX IF NOT EXISTS idx_bank_statements_source 
    ON financial.bank_statements (user_id, source);
CREATE INDEX IF NOT EXISTS idx_bank_statements_reconciled 
    ON financial.bank_statements (user_id, reconciled) 
    WHERE reconciled = FALSE;
CREATE INDEX IF NOT EXISTS idx_bank_statements_pluggy 
    ON financial.bank_statements (pluggy_id) 
    WHERE pluggy_id IS NOT NULL;

-- ========================================================
-- PARTE 4: financial.sync_logs
--           Rastreio de cada sincronização
-- ========================================================
CREATE TABLE IF NOT EXISTS financial.sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    connector_item_id TEXT,                        -- item_id do Pluggy (opcional, NULL = sync geral)
    status TEXT NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'completed', 'failed', 'partial')),
    statements_fetched INTEGER DEFAULT 0,          -- Total de statements retornados pelo Pluggy
    statements_new INTEGER DEFAULT 0,              -- Novos (inseridos)
    statements_updated INTEGER DEFAULT 0,           -- Atualizados (dedup match)
    accounts_synced INTEGER DEFAULT 0,
    error_message TEXT,                             -- Mensagem de erro se failed
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    -- Metadados
    source TEXT DEFAULT 'manual'
        CHECK (source IN ('manual', 'scheduled', 'webhook'))
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_sync_logs_user 
    ON financial.sync_logs (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status 
    ON financial.sync_logs (status) 
    WHERE status = 'running';

-- RLS
ALTER TABLE financial.sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their own sync logs"
    ON financial.sync_logs
    FOR ALL
    USING (auth.uid() = user_id);

-- Adicionar FK de bank_statements → sync_logs (se a constraint não existir)
-- (precisa ser depois da criação da tabela sync_logs)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_bank_statements_sync'
        AND connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'financial')
    ) THEN
        EXECUTE 'ALTER TABLE financial.bank_statements
            ADD CONSTRAINT fk_bank_statements_sync
            FOREIGN KEY (sync_id)
            REFERENCES financial.sync_logs(id)
            ON DELETE SET NULL
            NOT VALID';
    END IF;
END;
$$;

-- ========================================================
-- PARTE 5: financial.pluggy_webhook_events
--           Inbox de eventos recebidos do Pluggy
-- ========================================================
CREATE TABLE IF NOT EXISTS financial.pluggy_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT,                                 -- ID do evento no Pluggy
    event_type TEXT NOT NULL,                      -- 'transaction/created', 'item/updated', etc.
    item_id TEXT,                                  -- item_id afetado
    connector_id TEXT,                             -- connector_id afetado
    payload JSONB NOT NULL,                        -- Payload completo recebido
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'ignored')),
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    received_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_webhook_events_status 
    ON financial.pluggy_webhook_events (status, received_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_item 
    ON financial.pluggy_webhook_events (item_id, event_type);

-- RLS: webhook events são internos (acesso via service_role apenas)
ALTER TABLE financial.pluggy_webhook_events ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy para usuários comuns — apenas service_role via Edge Function
-- Bloqueia todo acesso público
CREATE POLICY "Block all public access to webhook events"
    ON financial.pluggy_webhook_events
    FOR ALL
    USING (false)
    WITH CHECK (false);

-- ========================================================
-- PARTE 6: Deprecação de public.bank_accounts
--           Remover triggers de sync e criptografia
-- ========================================================

-- Remover triggers de criptografia (não precisamos mais criptografar em public)
DROP TRIGGER IF EXISTS trg_encrypt_bank_credentials ON public.bank_accounts;

-- Remover triggers de sync bidirecional
DROP TRIGGER IF EXISTS trg_sync_bank_accounts_insert ON public.bank_accounts;
DROP TRIGGER IF EXISTS trg_sync_bank_accounts_update ON public.bank_accounts;
DROP TRIGGER IF EXISTS trg_sync_bank_accounts_delete ON public.bank_accounts;

-- Remover funções de sync (já que não serão mais chamadas por triggers)
-- Mantemos as funções para não quebrar referências, mas renomeamos como deprecated
-- (DROP OR REPLACE FUNCTION não seria seguro, então deixamos as funções existentes)

-- public.bank_accounts vira uma tabela LEGADO — apenas consulta, sem escrita via app
-- As policies existentes continuam funcionando para SELECT, mas INSERT/UPDATE/DELETE
-- serão tratados pelo novo fluxo (directamente em financial.bank_accounts)

-- Remover funções órfãs de sync (não são mais chamadas por triggers)
DROP FUNCTION IF EXISTS public.sync_bank_accounts_insert();
DROP FUNCTION IF EXISTS public.sync_bank_accounts_update();
DROP FUNCTION IF EXISTS public.sync_bank_accounts_delete();
DROP FUNCTION IF EXISTS public.encrypt_bank_credentials();

-- ========================================================
-- PARTE 7: Atualizar vw_accounts_full
-- ========================================================

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
    fba.pluggy_item_id,
    -- Metadados do connector Pluggy (se disponível)
    pc.institution_name,
    pc.institution_number,
    pc.last_sync_at AS connector_last_sync,
    pc.status AS connector_status,
    -- Apenas indicador booleano de configuração, NUNCA os valores reais
    (fba.client_id_encrypted IS NOT NULL) AS has_legacy_credentials,
    (fba.pluggy_item_id IS NOT NULL) AS has_open_finance,
    fba.created_at,
    fba.updated_at,
    -- Status legível (prioriza Open Finance)
    CASE 
        WHEN fba.pluggy_item_id IS NOT NULL AND pc.status = 'login_succeeded' THEN 'Conectado (Open Finance)'
        WHEN fba.pluggy_item_id IS NOT NULL AND pc.status = 'updating' THEN 'Atualizando...'
        WHEN fba.pluggy_item_id IS NOT NULL AND pc.status IN ('waiting_user_input', 'created') THEN 'Aguardando autenticação'
        WHEN fba.status = 'active' AND fba.client_id_encrypted IS NOT NULL THEN 'Conectado (API Key - Legado)'
        WHEN fba.status = 'active' THEN 'Ativo'
        ELSE 'Desconectado'
    END AS status_label
FROM financial.bank_accounts fba
LEFT JOIN financial.pluggy_connectors pc ON pc.item_id = fba.pluggy_item_id AND pc.user_id = fba.user_id
WHERE auth.uid() = fba.user_id;

-- Reaplicar permissões
GRANT SELECT ON financial.vw_accounts_full TO authenticated;

-- ========================================================
-- PARTE 8: Funções auxiliares para Edge Function
-- ========================================================

-- Função: upsert seguro de bank statement com dedup
-- Usada pela Edge Function para evitar duplicatas
CREATE OR REPLACE FUNCTION financial.upsert_bank_statement(
    p_user_id UUID,
    p_bank_account_id UUID,
    p_pluggy_id TEXT,
    p_transaction_date DATE,
    p_amount NUMERIC,
    p_description TEXT,
    p_category_auto TEXT DEFAULT NULL,
    p_raw_data JSONB DEFAULT NULL,
    p_source TEXT DEFAULT 'pluggy',
    p_sync_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_existing_id UUID;
    v_dedup_hash TEXT;
    v_result_id UUID;
BEGIN
    -- Gerar hash
    v_dedup_hash := financial.generate_dedup_hash(p_pluggy_id, p_amount, p_transaction_date);
    
    -- Tentar encontrar por dedup_hash primeiro (mais rápido)
    SELECT id INTO v_existing_id 
    FROM financial.bank_statements 
    WHERE dedup_hash = v_dedup_hash
    LIMIT 1;
    
    IF v_existing_id IS NOT NULL THEN
        -- Atualizar existente (pode ter mudado descrição ou categoria)
        UPDATE financial.bank_statements
        SET
            description = COALESCE(p_description, description),
            category_auto = COALESCE(p_category_auto, category_auto),
            raw_data = COALESCE(p_raw_data, raw_data),
            updated_at = NOW()
        WHERE id = v_existing_id;
        
        RETURN v_existing_id;
    ELSE
        -- Inserir novo
        INSERT INTO financial.bank_statements (
            bank_account_id, user_id, pluggy_id,
            transaction_date, amount, description,
            category_auto, raw_data, source, sync_id,
            reconciled
        ) VALUES (
            p_bank_account_id, p_user_id, p_pluggy_id,
            p_transaction_date, p_amount, p_description,
            p_category_auto, p_raw_data, p_source, p_sync_id,
            FALSE
        )
        RETURNING id INTO v_result_id;
        
        RETURN v_result_id;
    END IF;
END;
$$;

-- Função: upsert em lote de bank statements
-- Recebe um array de registros e insere/atualiza em massa
CREATE OR REPLACE FUNCTION financial.bulk_upsert_bank_statements(
    p_user_id UUID,
    p_bank_account_id UUID,
    p_sync_id UUID,
    p_statements JSONB  -- Array de objetos com pluggy_id, transaction_date, amount, description, raw_data
)
RETURNS TABLE(
    inserted INTEGER,
    updated INTEGER,
    total INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stmt JSONB;
    v_pluggy_id TEXT;
    v_date DATE;
    v_amount NUMERIC;
    v_desc TEXT;
    v_raw JSONB;
    v_dedup TEXT;
    v_existing UUID;
    v_inserted INTEGER := 0;
    v_updated INTEGER := 0;
    v_total INTEGER := 0;
BEGIN
    FOR v_stmt IN SELECT * FROM jsonb_array_elements(p_statements)
    LOOP
        v_total := v_total + 1;
        v_pluggy_id := v_stmt->>'pluggy_id';
        v_date := (v_stmt->>'transaction_date')::DATE;
        v_amount := (v_stmt->>'amount')::NUMERIC;
        v_desc := v_stmt->>'description';
        v_raw := v_stmt->'raw_data';
        v_dedup := financial.generate_dedup_hash(v_pluggy_id, v_amount, v_date);
        
        SELECT bs.id INTO v_existing
        FROM financial.bank_statements bs
        WHERE bs.dedup_hash = v_dedup
        LIMIT 1;
        
        IF v_existing IS NOT NULL THEN
            UPDATE financial.bank_statements
            SET
                description = COALESCE(v_desc, description),
                raw_data = COALESCE(v_raw, raw_data),
                updated_at = NOW()
            WHERE id = v_existing;
            v_updated := v_updated + 1;
        ELSE
            INSERT INTO financial.bank_statements (
                bank_account_id, user_id, pluggy_id,
                transaction_date, amount, description,
                raw_data, source, sync_id, reconciled
            ) VALUES (
                p_bank_account_id, p_user_id, v_pluggy_id,
                v_date, v_amount, v_desc,
                v_raw, 'pluggy', p_sync_id, FALSE
            );
            v_inserted := v_inserted + 1;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT v_inserted, v_updated, v_total;
END;
$$;

-- ========================================================
-- PARTE 9: Função para iniciar sync log
-- ========================================================
CREATE OR REPLACE FUNCTION financial.start_sync_log(
    p_user_id UUID,
    p_connector_item_id TEXT DEFAULT NULL,
    p_source TEXT DEFAULT 'manual'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO financial.sync_logs (user_id, connector_item_id, source, status)
    VALUES (p_user_id, p_connector_item_id, p_source, 'running')
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

-- Função: finalizar sync log
CREATE OR REPLACE FUNCTION financial.finish_sync_log(
    p_sync_id UUID,
    p_status TEXT,
    p_statements_fetched INTEGER DEFAULT 0,
    p_statements_new INTEGER DEFAULT 0,
    p_statements_updated INTEGER DEFAULT 0,
    p_accounts_synced INTEGER DEFAULT 0,
    p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE financial.sync_logs
    SET
        status = p_status,
        statements_fetched = p_statements_fetched,
        statements_new = p_statements_new,
        statements_updated = p_statements_updated,
        accounts_synced = p_accounts_synced,
        error_message = p_error_message,
        completed_at = NOW()
    WHERE id = p_sync_id;
END;
$$;

-- ========================================================
-- PARTE 10: Permissões finais
-- ========================================================

-- Garantir que o schema financial está acessível
GRANT USAGE ON SCHEMA financial TO authenticated, service_role;

-- Tabelas: permissões para authenticated
GRANT ALL ON financial.pluggy_connectors TO authenticated;
GRANT ALL ON financial.sync_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON financial.bank_statements TO authenticated;
GRANT ALL ON financial.bank_accounts TO authenticated;

-- Tabelas internas: apenas service_role
GRANT ALL ON financial.pluggy_webhook_events TO service_role;

-- Funções: executar como authenticated ou service_role
GRANT EXECUTE ON FUNCTION financial.upsert_bank_statement TO service_role;
GRANT EXECUTE ON FUNCTION financial.bulk_upsert_bank_statements TO service_role;
GRANT EXECUTE ON FUNCTION financial.start_sync_log TO service_role;
GRANT EXECUTE ON FUNCTION financial.finish_sync_log TO service_role;

-- ========================================================
-- NOTAS DE IMPLANTAÇÃO:
-- ========================================================
--
-- Ordem de deploy:
--   1. Rodar esta migration
--   2. Garantir que schema 'financial' está em:
--      Supabase Dashboard > Settings > API > Exposed Schemas
--   3. Configurar Pluggy API Key nas variáveis de ambiente:
--      PLUGGY_API_KEY (Edge Function)
--   4. Atualizar Edge Function sync-bank-statements (Fase 2)
--   5. Atualizar Mobile App (Fase 4)
--
-- ⚠️ NOTA: public.sync_bank_accounts_*() e public.encrypt_bank_credentials()
-- foram removidos nesta migration.
--
-- ⚠️ BACKWARD COMPATIBILITY:
--   - public.bank_accounts ainda existe (dados preservados)
--   - Triggers de sync foram removidos (não haverá mais sync automático)
--   - APK v1.0 que tentar INSERT em public.bank_accounts conseguirá,
--     mas não será sincronizado para financial.bank_accounts
--   - Novo fluxo: financial.bank_accounts diretamente via Pluggy
-- ========================================================
