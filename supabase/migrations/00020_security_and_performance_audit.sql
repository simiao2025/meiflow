-- Migration 00020: Auditoria de Segurança e Performance do Supabase
-- Corrige lints do Supabase Advisors (RLS, search_path, foreign keys, permissões)

-- 1. Mover extensões do schema public para schema extensions
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
ALTER EXTENSION vector SET SCHEMA extensions;

-- 2. Corrigir search_path mutável em funções (Segurança)
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.handle_updated_at() SET search_path = public;
ALTER FUNCTION public.pull_watermelon_changes(bigint, integer) SET search_path = public;
ALTER FUNCTION public.push_watermelon_changes(jsonb, bigint) SET search_path = public;

ALTER FUNCTION financial.upsert_bank_statement(uuid, uuid, text, date, numeric, text, text, jsonb, text, uuid) SET search_path = financial, public;
ALTER FUNCTION financial.bulk_upsert_bank_statements(uuid, uuid, uuid, jsonb) SET search_path = financial, public;
ALTER FUNCTION financial.set_updated_at() SET search_path = financial, public;
ALTER FUNCTION financial.validate_pluggy_item() SET search_path = financial, public;
ALTER FUNCTION financial.update_stock_on_sale() SET search_path = financial, public;
ALTER FUNCTION financial.generate_dedup_hash(text, numeric, date) SET search_path = financial, public;
ALTER FUNCTION financial.set_dedup_hash() SET search_path = financial, public;
ALTER FUNCTION financial.start_sync_log(uuid, text, text) SET search_path = financial, public;
ALTER FUNCTION financial.finish_sync_log(uuid, text, integer, integer, integer, integer, text) SET search_path = financial, public;

-- 3. Fechar privilégios excessivos em funções SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.delete_user_account() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.pull_watermelon_changes(bigint, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.push_watermelon_changes(jsonb, bigint) FROM anon, authenticated, public;

-- 4. Suporte a colunas city e state em public.clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS state text;

-- 5. Habilitar RLS e padronizar políticas (RLS InitPlan Optimization com (select auth.uid()))
-- Public: transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can only access their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can manage their own transactions" ON public.transactions;
CREATE POLICY "Users can manage their own transactions" ON public.transactions FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- Public: das_records
ALTER TABLE public.das_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own das_records" ON public.das_records;
CREATE POLICY "Users can manage their own das_records" ON public.das_records FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- Public: nfse
ALTER TABLE public.nfse ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own nfse" ON public.nfse;
CREATE POLICY "Users can manage their own nfse" ON public.nfse FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- AI: conversations & messages
DROP POLICY IF EXISTS "Users can manage their own conversations" ON ai.conversations;
CREATE POLICY "Users can manage their own conversations" ON ai.conversations FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can access messages of their conversations" ON ai.messages;
DROP POLICY IF EXISTS "Users can manage messages of their conversations" ON ai.messages;
CREATE POLICY "Users can manage messages of their conversations" ON ai.messages FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM ai.conversations c WHERE c.id = messages.conversation_id AND c.user_id = (select auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM ai.conversations c WHERE c.id = messages.conversation_id AND c.user_id = (select auth.uid())));

-- Public: unificar políticas com (select auth.uid())
DROP POLICY IF EXISTS "Users can only access their own declarations" ON public.annual_declarations;
DROP POLICY IF EXISTS "Users can view their own annual declarations" ON public.annual_declarations;
DROP POLICY IF EXISTS "Users can manage their own annual declarations" ON public.annual_declarations;
CREATE POLICY "Users can manage their own annual declarations" ON public.annual_declarations FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can insert their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can update their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can delete their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can manage their own appointments" ON public.appointments;
CREATE POLICY "Users can manage their own appointments" ON public.appointments FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own catalog items" ON public.catalog_items;
DROP POLICY IF EXISTS "Users can insert their own catalog items" ON public.catalog_items;
DROP POLICY IF EXISTS "Users can update their own catalog items" ON public.catalog_items;
DROP POLICY IF EXISTS "Users can delete their own catalog items" ON public.catalog_items;
DROP POLICY IF EXISTS "Users can manage their own catalog items" ON public.catalog_items;
CREATE POLICY "Users can manage their own catalog items" ON public.catalog_items FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can insert their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can update their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can delete their own clients" ON public.clients;
DROP POLICY IF EXISTS "Users can manage their own clients" ON public.clients;
CREATE POLICY "Users can manage their own clients" ON public.clients FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view their own charges" ON public.charges;
DROP POLICY IF EXISTS "Users can insert their own charges" ON public.charges;
DROP POLICY IF EXISTS "Users can update their own charges" ON public.charges;
DROP POLICY IF EXISTS "Users can delete their own charges" ON public.charges;
DROP POLICY IF EXISTS "Users can manage their own charges" ON public.charges;
CREATE POLICY "Users can manage their own charges" ON public.charges FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can only access their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage their own profile" ON public.profiles;
CREATE POLICY "Users can manage their own profile" ON public.profiles FOR ALL TO authenticated USING ((select auth.uid()) = id) WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can view their own bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Users can insert their own bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Users can update their own bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Users can delete their own bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Users can manage their own bank accounts" ON public.bank_accounts;
CREATE POLICY "Users can manage their own bank accounts" ON public.bank_accounts FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- Schemas billing, crm, fiscal, financial
DROP POLICY IF EXISTS "Users can only access their own merchant configs" ON billing.merchant_configs;
DROP POLICY IF EXISTS "Users can manage their own merchant configs" ON billing.merchant_configs;
CREATE POLICY "Users can manage their own merchant configs" ON billing.merchant_configs FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can only access their own subscriptions" ON billing.subscriptions;
DROP POLICY IF EXISTS "Users can manage their own subscriptions" ON billing.subscriptions;
CREATE POLICY "Users can manage their own subscriptions" ON billing.subscriptions FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can only access their own clients" ON crm.clients;
DROP POLICY IF EXISTS "Users can manage their own clients" ON crm.clients;
CREATE POLICY "Users can manage their own clients" ON crm.clients FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can only access their own bank accounts" ON financial.bank_accounts;
DROP POLICY IF EXISTS "Users can manage their own bank accounts" ON financial.bank_accounts;
CREATE POLICY "Users can manage their own bank accounts" ON financial.bank_accounts FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can access their own bank statements" ON financial.bank_statements;
DROP POLICY IF EXISTS "Users can manage their own bank statements" ON financial.bank_statements;
CREATE POLICY "Users can manage their own bank statements" ON financial.bank_statements FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage their own pluggy connectors" ON financial.pluggy_connectors;
CREATE POLICY "Users can manage their own pluggy connectors" ON financial.pluggy_connectors FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own sales orders" ON financial.sales_orders;
DROP POLICY IF EXISTS "Users can update own sales orders" ON financial.sales_orders;
DROP POLICY IF EXISTS "Users can insert own sales orders" ON financial.sales_orders;
DROP POLICY IF EXISTS "Users can delete own sales orders" ON financial.sales_orders;
DROP POLICY IF EXISTS "Users can manage their own sales orders" ON financial.sales_orders;
CREATE POLICY "Users can manage their own sales orders" ON financial.sales_orders FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own sales order items" ON financial.sales_order_items;
DROP POLICY IF EXISTS "Users can insert own sales order items" ON financial.sales_order_items;
DROP POLICY IF EXISTS "Users can manage their own sales order items" ON financial.sales_order_items;
CREATE POLICY "Users can manage their own sales order items" ON financial.sales_order_items FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM financial.sales_orders so WHERE so.id = sales_order_items.order_id AND so.user_id = (select auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM financial.sales_orders so WHERE so.id = sales_order_items.order_id AND so.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users can access their own sync logs" ON financial.sync_logs;
DROP POLICY IF EXISTS "Users can manage their own sync logs" ON financial.sync_logs;
CREATE POLICY "Users can manage their own sync logs" ON financial.sync_logs FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can only access their own invoices" ON fiscal.invoices;
DROP POLICY IF EXISTS "Users can manage their own invoices" ON fiscal.invoices;
CREATE POLICY "Users can manage their own invoices" ON fiscal.invoices FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own nfe records" ON fiscal.nfe_records;
DROP POLICY IF EXISTS "Users can update own nfe records" ON fiscal.nfe_records;
DROP POLICY IF EXISTS "Users can insert own nfe records" ON fiscal.nfe_records;
DROP POLICY IF EXISTS "Users can manage their own nfe records" ON fiscal.nfe_records;
CREATE POLICY "Users can manage their own nfe records" ON fiscal.nfe_records FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- 6. Índices de cobertura para Foreign Keys não indexadas
CREATE INDEX IF NOT EXISTS idx_ai_conversations_client_id ON ai.conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON ai.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_billing_merchant_configs_user_id ON billing.merchant_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_user_id ON billing.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_clients_user_id ON crm.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_bank_accounts_user_id ON financial.bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_bank_statements_account_id ON financial.bank_statements(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_financial_bank_statements_sync_id ON financial.bank_statements(sync_id);
CREATE INDEX IF NOT EXISTS idx_financial_sales_order_items_item_id ON financial.sales_order_items(item_id);
CREATE INDEX IF NOT EXISTS idx_financial_sales_order_items_order_id ON financial.sales_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_financial_sales_orders_client_id ON financial.sales_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_financial_sales_orders_user_id ON financial.sales_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_invoices_transaction_id ON fiscal.invoices(transaction_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_nfe_records_order_id ON fiscal.nfe_records(order_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_nfe_records_user_id ON fiscal.nfe_records(user_id);
CREATE INDEX IF NOT EXISTS idx_public_appointments_client_id ON public.appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_public_appointments_user_id ON public.appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_public_bank_accounts_user_id ON public.bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_public_catalog_items_user_id ON public.catalog_items(user_id);
CREATE INDEX IF NOT EXISTS idx_public_charges_client_id ON public.charges(client_id);
CREATE INDEX IF NOT EXISTS idx_public_charges_user_id ON public.charges(user_id);
CREATE INDEX IF NOT EXISTS idx_public_clients_user_id ON public.clients(user_id);
CREATE INDEX IF NOT EXISTS idx_public_das_records_user_id ON public.das_records(user_id);
CREATE INDEX IF NOT EXISTS idx_public_nfse_user_id ON public.nfse(user_id);
CREATE INDEX IF NOT EXISTS idx_public_transactions_user_id ON public.transactions(user_id);
