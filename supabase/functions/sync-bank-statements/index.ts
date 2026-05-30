import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
       return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401 });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    
    const userId = user.id;

    // 2. Fetch contas conectadas do usuário
    const { data: accounts, error: accountError } = await supabaseClient
      .from('bank_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active');
      
    if (accountError) {
        throw new Error("Erro ao buscar contas bancárias");
    }

    let activeAccounts = accounts;

    // Se o usuário não tiver conta bancária, vamos criar uma conta mock para o POC funcionar
    if (!activeAccounts || activeAccounts.length === 0) {
        const { data: newAccount, error: createError } = await supabaseClient
            .from('bank_accounts')
            .insert([{
                user_id: userId,
                provider_id: 'pluggy_mock',
                account_name: 'Conta Mock Open Finance',
                balance: 1500.00,
                status: 'active'
            }])
            .select();
            
        if (createError) throw createError;
        activeAccounts = newAccount;
    }

    // 3. Geramos transações de teste baseadas na conta do usuário
    // Para a conciliação funcionar, vamos gerar um valor negativo de 71.60 (DAS) e uma nota fiscal de entrada
    
    const mockStatements = activeAccounts.flatMap(acc => [
        {
            bank_account_id: acc.id,
            user_id: userId,
            transaction_date: new Date().toISOString().split('T')[0],
            amount: -71.60,
            description: "Pagamento de Boleto - Simples Nacional",
            category_auto: null,
            reconciled: false,
            transaction_id: `mock-${Date.now()}-das`
        },
        {
            bank_account_id: acc.id,
            user_id: userId,
            transaction_date: new Date().toISOString().split('T')[0],
            amount: 150.00,
            description: "Pix Recebido - Serviços Prestados",
            category_auto: null,
            reconciled: false,
            transaction_id: `mock-${Date.now()}-pix`
        },
        {
            bank_account_id: acc.id,
            user_id: userId,
            transaction_date: new Date().toISOString().split('T')[0],
            amount: -25.00,
            description: "Tarifa Manutenção Conta",
            category_auto: null,
            reconciled: false,
            transaction_id: `mock-${Date.now()}-fee`
        }
    ]);

    // 4. Inserir no Supabase (bank_statements)
    if (mockStatements.length > 0) {
        const { error: insertError } = await supabaseClient
            .from('bank_statements')
            .upsert(mockStatements, { onConflict: 'transaction_id' });
            
        if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({ success: true, count: mockStatements.length }),
      { headers: { "Content-Type": "application/json" } },
    )
  } catch (err: any) {
    return new Response(String(err?.message ?? err), { status: 500 })
  }
})
