-- Create catalog_items table
CREATE TABLE IF NOT EXISTS public.catalog_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('service', 'product')),
    name TEXT NOT NULL,
    description TEXT,
    billing_unit TEXT NOT NULL CHECK (billing_unit IN ('m2', 'hora', 'diaria', 'empreitada', 'unidade', 'kg', 'litro', 'metro')),
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;

-- Create policies so users can only access their own catalog items
CREATE POLICY "Users can view their own catalog items"
    ON public.catalog_items FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own catalog items"
    ON public.catalog_items FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own catalog items"
    ON public.catalog_items FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own catalog items"
    ON public.catalog_items FOR DELETE
    USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER set_catalog_items_updated_at
    BEFORE UPDATE ON public.catalog_items
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
