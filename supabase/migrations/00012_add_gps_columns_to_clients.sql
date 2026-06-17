-- Add GPS coordinate columns to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS formatted_address TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS document TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS person_type TEXT DEFAULT 'pf';

-- Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
