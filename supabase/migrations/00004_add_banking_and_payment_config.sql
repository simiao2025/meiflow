-- Tabela para Contas Bancárias Conectadas (Open Finance)
CREATE TABLE IF NOT EXISTS financial.bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    bank_code TEXT,
    account_type TEXT CHECK (account_type IN ('corrente', 'poupanca', 'pagamento')),
    last_digits TEXT,
    balance NUMERIC(12,2) DEFAULT 0,
    provider TEXT DEFAULT 'pluggy', -- pluggy, belvo, etc.
    provider_id TEXT, -- ID da conta no provedor de Open Finance
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela para Configurações de Cobrança do MEI (Asaas)
CREATE TABLE IF NOT EXISTS billing.merchant_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    asaas_api_key_encrypted TEXT, -- Chave do próprio MEI se ele quiser usar conta própria
    enable_pix BOOLEAN DEFAULT TRUE,
    enable_boleto BOOLEAN DEFAULT TRUE,
    enable_credit_card BOOLEAN DEFAULT TRUE,
    max_installments INTEGER DEFAULT 12,
    interest_rate_installments NUMERIC(4,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ativar RLS
ALTER TABLE financial.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.merchant_configs ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Users can only access their own bank accounts" ON financial.bank_accounts
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own merchant configs" ON billing.merchant_configs
    FOR ALL USING (auth.uid() = user_id);
