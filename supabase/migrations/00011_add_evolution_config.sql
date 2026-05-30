-- Migration to add Evolution Go integration fields to the profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS evolution_token TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS evolution_instance TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS evolution_status TEXT DEFAULT 'pending';
