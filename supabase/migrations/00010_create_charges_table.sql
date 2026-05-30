-- Create billing.charges table
CREATE TABLE IF NOT EXISTS billing.charges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES crm.clients(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'credit_card', 'debit_card', 'cash')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
    external_reference TEXT, -- ID no Asaas ou Mercado Pago
    payment_link TEXT, -- Link de checkout
    qr_code_payload TEXT, -- Pix Copia e Cola
    qr_code_base64 TEXT, -- Imagem do QR Code
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE billing.charges ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own charges"
    ON billing.charges FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own charges"
    ON billing.charges FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own charges"
    ON billing.charges FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own charges"
    ON billing.charges FOR DELETE
    USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER set_billing_charges_updated_at
    BEFORE UPDATE ON billing.charges
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
