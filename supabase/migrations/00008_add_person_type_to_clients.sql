-- Add person_type column to crm.clients
ALTER TABLE crm.clients ADD COLUMN IF NOT EXISTS person_type TEXT DEFAULT 'pf'; -- 'pf' = Pessoa Física, 'pj' = Pessoa Jurídica
