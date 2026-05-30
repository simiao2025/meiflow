-- Tabela de Extratos Bancários (Bank Statements)
CREATE TABLE IF NOT EXISTS financial.bank_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_account_id UUID NOT NULL REFERENCES financial.bank_accounts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    description TEXT,
    category_auto TEXT,
    reconciled BOOLEAN DEFAULT FALSE,
    transaction_id TEXT, -- ID no provedor externo (ex: Pluggy)
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE financial.bank_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their own bank statements" ON financial.bank_statements
    FOR ALL USING (auth.uid() = user_id);

-- Atualiza a tabela transactions (se necessário adicionar link de conciliação)
ALTER TABLE financial.transactions
ADD COLUMN IF NOT EXISTS bank_statement_id UUID REFERENCES financial.bank_statements(id) ON DELETE SET NULL;
