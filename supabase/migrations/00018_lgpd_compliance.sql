-- Migration 00018: LGPD Compliance + Security Fixes
-- Fixes: ai.messages RLS policy, account deletion function, updated MEI limit

-- ============================================================
-- 1. FIX: ai.messages RLS policy (was enabled but had no policies)
-- ============================================================
CREATE POLICY "Users can access messages of their conversations"
    ON ai.messages
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM ai.conversations c
            WHERE c.id = ai.messages.conversation_id
            AND c.user_id = auth.uid()
        )
    );

-- ============================================================
-- 2. LGPD: Account deletion function (Art. 18, VI)
-- Cascades through all user data while preserving fiscal records
-- for legal retention (5 years minimum per CTN Art. 174)
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid uuid := auth.uid();
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- AI data
    DELETE FROM ai.messages WHERE conversation_id IN (
        SELECT id FROM ai.conversations WHERE user_id = uid
    );
    DELETE FROM ai.conversations WHERE user_id = uid;

    -- CRM data
    DELETE FROM crm.clients WHERE user_id = uid;

    -- Financial data
    DELETE FROM financial.transactions WHERE user_id = uid;
    DELETE FROM financial.bank_statements WHERE user_id = uid;
    DELETE FROM financial.sync_logs WHERE user_id = uid;
    DELETE FROM financial.pluggy_connectors WHERE user_id = uid;
    DELETE FROM financial.bank_accounts WHERE user_id = uid;

    -- Billing data
    DELETE FROM billing.charges WHERE user_id = uid;
    DELETE FROM billing.subscriptions WHERE user_id = uid;
    DELETE FROM billing.merchant_configs WHERE user_id = uid;

    -- Catalog and sales
    DELETE FROM financial.sales_order_items WHERE sales_order_id IN (
        SELECT id FROM financial.sales_orders WHERE user_id = uid
    );
    DELETE FROM financial.sales_orders WHERE user_id = uid;
    DELETE FROM public.catalog_items WHERE user_id = uid;

    -- Appointments and schedules
    DELETE FROM public.appointments WHERE user_id = uid;

    -- Opportunities
    DELETE FROM public.user_matches WHERE user_id = uid;
    DELETE FROM public.user_preferences WHERE user_id = uid;

    -- Fiscal data (soft-delete for legal retention)
    UPDATE fiscal.das_records SET user_id = NULL WHERE user_id = uid;
    UPDATE fiscal.nfse SET user_id = NULL WHERE user_id = uid;
    UPDATE fiscal.invoices SET user_id = NULL WHERE user_id = uid;
    UPDATE fiscal.annual_declarations SET user_id = NULL WHERE user_id = uid;

    -- Legacy tables
    DELETE FROM public.charges WHERE user_id = uid;
    DELETE FROM public.bank_accounts WHERE user_id = uid;
    DELETE FROM public.transactions WHERE user_id = uid;
    DELETE FROM public.clients WHERE user_id = uid;

    -- Legislation reads
    DELETE FROM public.user_legislation_reads WHERE user_id = uid;

    -- Profile (last, after all FK references)
    DELETE FROM public.profiles WHERE id = uid;

    -- Auth user (via service_role)
    DELETE FROM auth.users WHERE id = uid;
END;
$$;

-- ============================================================
-- 3. Update MEI annual limit default to 2026 value
-- ============================================================
ALTER TABLE public.profiles
    ALTER COLUMN limite_anual_mei SET DEFAULT 130000.00;

UPDATE public.profiles
    SET limite_anual_mei = 130000.00
    WHERE limite_anual_mei = 81000.00;
