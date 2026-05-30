-- ========================================================
-- Add product-specific fields to catalog_items
-- ========================================================

ALTER TABLE public.catalog_items 
ADD COLUMN IF NOT EXISTS ncm TEXT, -- Nomenclatura Comum do Mercosul (8 digits)
ADD COLUMN IF NOT EXISTS cest TEXT, -- Código Especificador da Substituição Tributária
ADD COLUMN IF NOT EXISTS cfop_default TEXT, -- Default CFOP for sales (e.g. 5102)
ADD COLUMN IF NOT EXISTS barcode TEXT, -- EAN / GTIN
ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_stock_alert INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10, 2) DEFAULT 0.00;

-- Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
