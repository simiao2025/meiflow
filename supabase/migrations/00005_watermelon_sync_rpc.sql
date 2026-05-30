-- Função para Puxar Mudanças (PULL)
CREATE OR REPLACE FUNCTION public.pull_watermelon_changes(
    last_pulled_at BIGINT,
    schema_version INT
) RETURNS JSONB AS $$
DECLARE
    result JSONB;
    current_timestamp_ms BIGINT;
BEGIN
    current_timestamp_ms := (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;
    
    -- Construindo o objeto de mudanças para as tabelas principais
    result := jsonb_build_object(
        'changes', jsonb_build_object(
            'transactions', jsonb_build_object(
                'created', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM financial.transactions t WHERE user_id = auth.uid() AND (EXTRACT(EPOCH FROM created_at) * 1000)::BIGINT > last_pulled_at),
                'updated', (SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM financial.transactions t WHERE user_id = auth.uid() AND (EXTRACT(EPOCH FROM updated_at) * 1000)::BIGINT > last_pulled_at AND (EXTRACT(EPOCH FROM created_at) * 1000)::BIGINT <= last_pulled_at),
                'deleted', '[]'::jsonb -- TODO: Implementar soft delete para rastrear deletados
            ),
            'invoices', jsonb_build_object(
                'created', (SELECT COALESCE(jsonb_agg(i), '[]'::jsonb) FROM fiscal.invoices i WHERE user_id = auth.uid() AND (EXTRACT(EPOCH FROM created_at) * 1000)::BIGINT > last_pulled_at),
                'updated', (SELECT COALESCE(jsonb_agg(i), '[]'::jsonb) FROM fiscal.invoices i WHERE user_id = auth.uid() AND (EXTRACT(EPOCH FROM updated_at) * 1000)::BIGINT > last_pulled_at AND (EXTRACT(EPOCH FROM created_at) * 1000)::BIGINT <= last_pulled_at),
                'deleted', '[]'::jsonb
            )
        ),
        'timestamp', current_timestamp_ms
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para Enviar Mudanças (PUSH)
CREATE OR REPLACE FUNCTION public.push_watermelon_changes(
    changes JSONB,
    last_pulled_at BIGINT
) RETURNS VOID AS $$
DECLARE
    table_name TEXT;
    table_changes JSONB;
    row_data JSONB;
BEGIN
    -- Processar Transações
    table_changes := changes->'transactions';
    IF table_changes IS NOT NULL THEN
        -- Created & Updated
        FOR row_data IN SELECT * FROM jsonb_array_elements(table_changes->'created' || table_changes->'updated')
        LOOP
            INSERT INTO financial.transactions (id, user_id, type, amount, category, description, date, payment_method)
            VALUES (
                (row_data->>'id')::UUID,
                auth.uid(),
                row_data->>'type',
                (row_data->>'amount')::NUMERIC,
                row_data->>'category',
                row_data->>'description',
                (row_data->>'date')::TIMESTAMPTZ,
                row_data->>'payment_method'
            )
            ON CONFLICT (id) DO UPDATE SET
                type = EXCLUDED.type,
                amount = EXCLUDED.amount,
                category = EXCLUDED.category,
                description = EXCLUDED.description,
                date = EXCLUDED.date,
                payment_method = EXCLUDED.payment_method,
                updated_at = NOW();
        END LOOP;
    END IF;

    -- O mesmo padrão se aplica para invoices e outras tabelas
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
