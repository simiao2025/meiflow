-- Tabela para Notas Fiscais capturadas automaticamente (Entrada e Saída)
CREATE TABLE IF NOT EXISTS fiscal.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')), -- inbound (compra), outbound (venda)
    type TEXT NOT NULL CHECK (type IN ('nfe', 'nfse', 'cte')),
    access_key TEXT UNIQUE, -- Chave de acesso da NF-e
    number TEXT,
    series TEXT,
    issuer_name TEXT,
    issuer_document TEXT,
    receiver_name TEXT,
    receiver_document TEXT,
    total_amount NUMERIC(12,2),
    issue_date TIMESTAMPTZ,
    status TEXT DEFAULT 'autorizada',
    xml_url TEXT,
    pdf_url TEXT,
    json_data JSONB, -- Dados completos da nota para a IA ler
    is_categorized BOOLEAN DEFAULT FALSE,
    transaction_id UUID REFERENCES financial.transactions(id), -- Link com o financeiro
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ativar RLS
ALTER TABLE fiscal.invoices ENABLE ROW LEVEL SECURITY;

-- Política de Segurança
CREATE POLICY "Users can only access their own invoices" ON fiscal.invoices
    FOR ALL USING (auth.uid() = user_id);

-- Index para busca rápida por data e chave
CREATE INDEX idx_invoices_user_date ON fiscal.invoices(user_id, issue_date DESC);
CREATE INDEX idx_invoices_access_key ON fiscal.invoices(access_key);
