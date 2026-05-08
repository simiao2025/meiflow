-- ========================================================
-- MEIFlow Initial Schema Migration
-- ========================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. SCHEMAS
CREATE SCHEMA IF NOT EXISTS financial;
CREATE SCHEMA IF NOT EXISTS fiscal;
CREATE SCHEMA IF NOT EXISTS crm;
CREATE SCHEMA IF NOT EXISTS ai;
CREATE SCHEMA IF NOT EXISTS billing;
CREATE SCHEMA IF NOT EXISTS legal;
CREATE SCHEMA IF NOT EXISTS procurement;

-- 3. TABLES - PUBLIC
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    cpf TEXT,
    cnpj TEXT,
    razao_social TEXT,
    nome_fantasia TEXT,
    atividade_cnae TEXT,
    data_abertura_mei DATE,
    telefone TEXT,
    email TEXT,
    endereco JSONB,
    avatar_url TEXT,
    limite_anual_mei NUMERIC(12,2) DEFAULT 81000.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLES - FINANCIAL
CREATE TABLE IF NOT EXISTS financial.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('receita', 'despesa')),
    amount NUMERIC(12,2) NOT NULL,
    category TEXT,
    description TEXT,
    date DATE DEFAULT CURRENT_DATE,
    payment_method TEXT,
    client_id UUID, -- FK to crm.clients later
    nfse_id UUID,   -- FK to fiscal.nfse later
    bank_account_id UUID,
    ai_categorized BOOLEAN DEFAULT FALSE,
    receipt_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financial.bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    bank_code TEXT,
    agency TEXT,
    account_number TEXT,
    open_finance_consent_id TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    balance_cached NUMERIC(12,2),
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABLES - FISCAL
CREATE TABLE IF NOT EXISTS fiscal.das_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reference_month TEXT NOT NULL, -- YYYY-MM
    due_date DATE NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'vencido', 'isento')),
    barcode TEXT,
    pix_code TEXT,
    payment_date DATE,
    receipt_url TEXT,
    auto_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fiscal.nfse (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID,
    numero_nf TEXT,
    valor NUMERIC(12,2),
    descricao_servico TEXT,
    codigo_servico TEXT,
    status TEXT DEFAULT 'pendente',
    prefeitura_code TEXT,
    xml_url TEXT,
    pdf_url TEXT,
    emitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABLES - CRM
CREATE TABLE IF NOT EXISTS crm.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    whatsapp_number TEXT,
    document TEXT, -- CPF/CNPJ
    notes TEXT,
    total_revenue NUMERIC(12,2) DEFAULT 0,
    last_contact_at TIMESTAMPTZ,
    ai_agent_enabled BOOLEAN DEFAULT TRUE,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    formatted_address TEXT,
    place_id TEXT,
    address_components JSONB,
    location_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABLES - AI
CREATE TABLE IF NOT EXISTS ai.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_type TEXT CHECK (agent_type IN ('assistant', 'customer_service')),
    client_id UUID REFERENCES crm.clients(id),
    channel TEXT CHECK (channel IN ('app', 'whatsapp')),
    status TEXT DEFAULT 'active',
    summary TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ai.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES ai.conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    metadata JSONB,
    tokens_used INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABLES - BILLING
CREATE TABLE IF NOT EXISTS billing.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan TEXT DEFAULT 'trial',
    status TEXT DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'past_due', 'cancelled')),
    trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    current_period_start TIMESTAMPTZ DEFAULT NOW(),
    current_period_end TIMESTAMPTZ,
    payment_provider TEXT,
    external_subscription_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    cancelled_at TIMESTAMPTZ
);

-- 9. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal.das_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal.nfse ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.subscriptions ENABLE ROW LEVEL SECURITY;

-- POLICIES (Example for Profiles and Transactions)
CREATE POLICY "Users can only access their own profile" ON public.profiles
    FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users can only access their own transactions" ON financial.transactions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own clients" ON crm.clients
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own subscriptions" ON billing.subscriptions
    FOR ALL USING (auth.uid() = user_id);
