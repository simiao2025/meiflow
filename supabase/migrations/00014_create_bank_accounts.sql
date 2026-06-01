-- Create Bank Accounts Table
CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider VARCHAR NOT NULL, -- e.g., 'Asaas', 'Inter', 'Cora'
    client_id VARCHAR NOT NULL,
    client_secret VARCHAR NOT NULL, -- In a real prod environment, use Supabase Vault, but this suffices for MVP
    status VARCHAR DEFAULT 'connected' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Users can view their own bank accounts"
    ON public.bank_accounts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bank accounts"
    ON public.bank_accounts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bank accounts"
    ON public.bank_accounts FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bank accounts"
    ON public.bank_accounts FOR DELETE
    USING (auth.uid() = user_id);

-- Create trigger for updated_at if it's generally used, otherwise created_at is fine.
