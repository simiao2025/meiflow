-- Tabela para Declarações Anuais (DASN-SIMEI)
CREATE TABLE IF NOT EXISTS fiscal.annual_declarations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    total_revenue_services NUMERIC(12,2) DEFAULT 0,
    total_revenue_commerce NUMERIC(12,2) DEFAULT 0,
    has_employee BOOLEAN DEFAULT FALSE,
    status TEXT CHECK (status IN ('draft', 'ready', 'sent', 'error')) DEFAULT 'draft',
    receipt_url TEXT, -- Link para o recibo de entrega (PDF)
    transmission_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, year)
);

-- Ativar RLS
ALTER TABLE fiscal.annual_declarations ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Users can only access their own declarations" ON fiscal.annual_declarations
    FOR ALL USING (auth.uid() = user_id);
