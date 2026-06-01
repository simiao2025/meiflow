import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Get the Authorization JWT from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    // 2. Initialize Supabase Client to verify the user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // 3. Verify user authentication
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Parse the incoming proxy request (path, method, body)
    const body = await req.json();
    const { endpoint, method = 'GET', payload } = body;

    if (!endpoint) {
      throw new Error('Missing Asaas endpoint in request body');
    }

    // 5. Get the global ASAAS_API_KEY from environment variables (securely stored)
    const asaasApiKey = Deno.env.get('ASAAS_API_KEY');
    if (!asaasApiKey) {
      throw new Error('Asaas API Key is not configured on the server');
    }

    const asaasUrl = Deno.env.get('ASAAS_API_URL') || 'https://sandbox.asaas.com/api/v3';

    // 6. Forward the request to Asaas
    const asaasResponse = await fetch(`${asaasUrl}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'access_token': asaasApiKey, // Asaas uses access_token header
      },
      body: payload ? JSON.stringify(payload) : undefined,
    });

    const data = await asaasResponse.json();

    // 7. Return the Asaas response back to the client
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
