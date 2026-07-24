import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:3000',
  'https://app.meiflow.com.br',
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

// ========================================================
// SEGURANÇA: Mapeamento estrito de ações permitidas.
// O cliente envia { action: "list_payments" }, e o servidor
// constrói a URL da API do Asaas internamente.
// O cliente NUNCA envia o caminho da URL diretamente.
// ========================================================
interface ActionConfig {
  method: string;
  buildPath: (params: Record<string, string>) => string;
  requiredParams?: string[];
}

const ALLOWED_ACTIONS: Record<string, ActionConfig> = {
  // Cobranças do usuário autenticado
  list_payments: {
    method: 'GET',
    buildPath: (p) => `/payments?customer=${p.customer_id}`,
    requiredParams: ['customer_id'],
  },
  get_payment: {
    method: 'GET',
    buildPath: (p) => `/payments/${p.payment_id}`,
    requiredParams: ['payment_id'],
  },
  create_payment: {
    method: 'POST',
    buildPath: () => '/payments',
  },
  // QR Code Pix
  get_pix_qrcode: {
    method: 'GET',
    buildPath: (p) => `/payments/${p.payment_id}/pixQrCode`,
    requiredParams: ['payment_id'],
  },
  // Notificações / Webhooks
  list_notifications: {
    method: 'GET',
    buildPath: (p) => `/payments/${p.payment_id}/notifications`,
    requiredParams: ['payment_id'],
  },
};

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Verificar autenticação JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Parsear a requisição — agora aceita "action" em vez de "endpoint"
    const body = await req.json();
    const { action, params = {}, payload } = body;

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Campo "action" é obrigatório. Ações válidas: ' + Object.keys(ALLOWED_ACTIONS).join(', ') }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Validar que a ação existe no mapeamento
    const actionConfig = ALLOWED_ACTIONS[action];
    if (!actionConfig) {
      return new Response(
        JSON.stringify({ error: `Ação "${action}" não permitida. Ações válidas: ${Object.keys(ALLOWED_ACTIONS).join(', ')}` }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Validar parâmetros obrigatórios
    if (actionConfig.requiredParams) {
      for (const param of actionConfig.requiredParams) {
        if (!params[param]) {
          return new Response(
            JSON.stringify({ error: `Parâmetro obrigatório ausente: "${param}" para a ação "${action}"` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // 5. Construir a URL do Asaas no servidor (NUNCA vinda do cliente)
    const asaasApiKey = Deno.env.get('ASAAS_API_KEY');
    if (!asaasApiKey) {
      throw new Error('Asaas API Key is not configured on the server');
    }

    const asaasUrl = Deno.env.get('ASAAS_API_URL') || 'https://sandbox.asaas.com/api/v3';
    const asaasPath = actionConfig.buildPath(params);

    // 6. Executar a chamada ao Asaas
    const asaasResponse = await fetch(`${asaasUrl}${asaasPath}`, {
      method: actionConfig.method,
      headers: {
        'Content-Type': 'application/json',
        'access_token': asaasApiKey,
      },
      body: payload && actionConfig.method === 'POST' ? JSON.stringify(payload) : undefined,
    });

    const data = await asaasResponse.json();

    // 7. Retornar a resposta do Asaas ao cliente
    return new Response(JSON.stringify(data), {
      status: asaasResponse.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

