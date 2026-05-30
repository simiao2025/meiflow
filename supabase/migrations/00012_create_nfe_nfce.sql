-- ========================================================
-- Create NF-e and NFC-e records
-- ========================================================

CREATE TABLE IF NOT EXISTS fiscal.nfe_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    order_id UUID REFERENCES financial.sales_orders(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('nfe', 'nfce')), -- NF-e (55) or NFC-e (65)
    numero TEXT,
    serie TEXT,
    chave_acesso TEXT,
    status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'autorizada', 'rejeitada', 'cancelada', 'processando')),
    total_amount NUMERIC(12,2),
    xml_url TEXT,
    danfe_url TEXT,
    emitted_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE fiscal.nfe_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own nfe records" ON fiscal.nfe_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own nfe records" ON fiscal.nfe_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own nfe records" ON fiscal.nfe_records FOR UPDATE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER set_nfe_records_updated_at
    BEFORE UPDATE ON fiscal.nfe_records
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
