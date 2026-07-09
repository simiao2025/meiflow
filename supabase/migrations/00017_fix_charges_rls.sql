-- ========================================================
-- MEIFlow: Fix charges permission for mobile app
-- Cria view pública + trigger para billing.charges
-- ========================================================

-- 1. Grant schema usage
GRANT USAGE ON SCHEMA billing TO anon, authenticated;
GRANT ALL ON billing.charges TO anon, authenticated;

-- 2. Public view que espelha billing.charges
CREATE OR REPLACE VIEW public.charges AS
SELECT
    id,
    user_id,
    client_id,
    amount,
    payment_method,
    status,
    external_reference,
    payment_link,
    qr_code_payload,
    qr_code_base64,
    description,
    created_at,
    paid_at,
    updated_at
FROM billing.charges;

-- 3. RLS na view (mesma política da tabela original)
ALTER VIEW public.charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own charges"
    ON public.charges FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own charges"
    ON public.charges FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own charges"
    ON public.charges FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own charges"
    ON public.charges FOR DELETE
    USING (auth.uid() = user_id);

-- 4. Trigger INSTEAD OF INSERT para escrever em billing.charges
CREATE OR REPLACE FUNCTION public.insert_charge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    INSERT INTO billing.charges (
        user_id, client_id, amount, payment_method, status,
        external_reference, payment_link, qr_code_payload,
        qr_code_base64, description
    ) VALUES (
        NEW.user_id, NEW.client_id, NEW.amount, NEW.payment_method,
        COALESCE(NEW.status, 'pending'), NEW.external_reference,
        NEW.payment_link, NEW.qr_code_payload, NEW.qr_code_base64,
        NEW.description
    )
    RETURNING id, user_id, client_id, amount, payment_method, status,
              external_reference, payment_link, qr_code_payload,
              qr_code_base64, description, created_at, paid_at, updated_at
    INTO NEW;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER insert_charge_trigger
    INSTEAD OF INSERT ON public.charges
    FOR EACH ROW
    EXECUTE FUNCTION public.insert_charge();

-- 5. Trigger INSTEAD OF UPDATE
CREATE OR REPLACE FUNCTION public.update_charge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    UPDATE billing.charges
    SET
        client_id = NEW.client_id,
        amount = NEW.amount,
        payment_method = NEW.payment_method,
        status = NEW.status,
        external_reference = NEW.external_reference,
        payment_link = NEW.payment_link,
        qr_code_payload = NEW.qr_code_payload,
        qr_code_base64 = NEW.qr_code_base64,
        description = NEW.description,
        paid_at = NEW.paid_at,
        updated_at = NOW()
    WHERE id = OLD.id
    RETURNING id, user_id, client_id, amount, payment_method, status,
              external_reference, payment_link, qr_code_payload,
              qr_code_base64, description, created_at, paid_at, updated_at
    INTO NEW;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER update_charge_trigger
    INSTEAD OF UPDATE ON public.charges
    FOR EACH ROW
    EXECUTE FUNCTION public.update_charge();

-- 6. Trigger INSTEAD OF DELETE
CREATE OR REPLACE FUNCTION public.delete_charge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    DELETE FROM billing.charges WHERE id = OLD.id;
    RETURN OLD;
END;
$$;

CREATE OR REPLACE TRIGGER delete_charge_trigger
    INSTEAD OF DELETE ON public.charges
    FOR EACH ROW
    EXECUTE FUNCTION public.delete_charge();

-- 7. Grant perms na view
GRANT ALL ON public.charges TO anon, authenticated;

-- 8. Notify PostgREST
NOTIFY pgrst, 'reload schema';
