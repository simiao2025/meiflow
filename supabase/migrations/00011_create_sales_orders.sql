-- ========================================================
-- Create Sales Orders (Frente de Caixa / Point of Sale)
-- ========================================================

CREATE TABLE IF NOT EXISTS financial.sales_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID REFERENCES crm.clients(id) ON DELETE SET NULL, -- Optional for over-the-counter sales
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(12,2) DEFAULT 0.00,
    status TEXT DEFAULT 'completed' CHECK (status IN ('draft', 'completed', 'cancelled')),
    payment_method TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financial.sales_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES financial.sales_orders(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.catalog_items(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(10,2) NOT NULL,
    total_price NUMERIC(12,2) NOT NULL
);

-- RLS
ALTER TABLE financial.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial.sales_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sales orders" ON financial.sales_orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sales orders" ON financial.sales_orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sales orders" ON financial.sales_orders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sales orders" ON financial.sales_orders FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own sales order items" ON financial.sales_order_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM financial.sales_orders so WHERE so.id = order_id AND so.user_id = auth.uid())
);
CREATE POLICY "Users can insert own sales order items" ON financial.sales_order_items FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM financial.sales_orders so WHERE so.id = order_id AND so.user_id = auth.uid())
);

-- Trigger to update stock when an item is added to a completed order
CREATE OR REPLACE FUNCTION financial.update_stock_on_sale()
RETURNS TRIGGER AS $$
BEGIN
    -- Only decrease stock if the order is completed (or inserted directly as completed)
    IF (SELECT status FROM financial.sales_orders WHERE id = NEW.order_id) = 'completed' THEN
        UPDATE public.catalog_items 
        SET stock_quantity = stock_quantity - NEW.quantity 
        WHERE id = NEW.item_id AND type = 'product';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_stock_on_sale
    AFTER INSERT ON financial.sales_order_items
    FOR EACH ROW
    EXECUTE FUNCTION financial.update_stock_on_sale();

-- Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
