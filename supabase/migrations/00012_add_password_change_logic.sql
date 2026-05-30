-- Migration: Add password change control to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_temporary_password BOOLEAN DEFAULT FALSE;

-- Update the handle_new_user function to support metadata-driven flags if needed
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    cpf,
    must_change_password,
    is_temporary_password
  )
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'cpf',
    COALESCE((new.raw_user_meta_data->>'must_change_password')::boolean, false),
    COALESCE((new.raw_user_meta_data->>'is_temporary_password')::boolean, false)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
