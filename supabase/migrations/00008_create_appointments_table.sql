-- Create appointments table
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMPTZ NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, reminded, completed, canceled
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Create policies so users can only access their own appointments
CREATE POLICY "Users can view their own appointments"
    ON public.appointments FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own appointments"
    ON public.appointments FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own appointments"
    ON public.appointments FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own appointments"
    ON public.appointments FOR DELETE
    USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER set_appointments_updated_at
    BEFORE UPDATE ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
