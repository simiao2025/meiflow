import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ========================================================
// Pluggy API Client
// ========================================================
const PLUGGY_BASE_URL = "https://api.pluggy.ai"

function getPluggyHeaders(): Record<string, string> {
  const apiKey = Deno.env.get("PLUGGY_API_KEY")
  if (!apiKey) throw new Error("PLUGGY_API_KEY not configured")
  return {
    "X-API-Key": apiKey,
    "Content-Type": "application/json",
  }
}

async function fetchPluggy(path: string, options: RequestInit = {}): Promise<any> {
  const url = `${PLUGGY_BASE_URL}${path}`
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getPluggyHeaders(),
      ...(options.headers as Record<string, string> || {}),
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Pluggy API error ${response.status}: ${errorText}`)
  }

  return response.json()
}

// ========================================================
// Tipos
// ========================================================
interface SyncResult {
  inserted: number
  updated: number
  total: number
  accounts_synced: number
}

interface AccountInfo {
  id: string
  name: string
  type: string
  number: string
  balance: number
  institution: { name: string; number: string }
}

// ========================================================
// Helpers
// ========================================================

function parseUrl(req: Request): URL {
  return new URL(req.url)
}

function corsHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Webhook-Token",
  }
}

// ========================================================
// Auth: Extrai e valida o usuário do JWT
// ========================================================
async function authenticateUser(req: Request): Promise<{ userId: string; supabase: ReturnType<typeof createClient> }> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    throw new AuthError("Missing Authorization header")
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user }, error: userError } = await supabaseClient.auth.getUser()

  if (userError || !user) {
    throw new AuthError("Unauthorized")
  }

  return { userId: user.id, supabase: supabaseClient }
}

class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AuthError"
  }
}

// ========================================================
// Admin client (service_role)
// ========================================================
function getAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  )
}

// ========================================================
// Rota: POST /sync-bank-statements
// Inicia sincronização para todos os conectores do usuário
// ========================================================
async function handleSync(req: Request): Promise<Response> {
  const { userId } = await authenticateUser(req)
  const supabase = getAdminClient()

  // 1. Buscar conectores Pluggy ativos do usuário (schema financial!)
  const { data: connectors, error: connError } = await supabase
    .from("financial.pluggy_connectors")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "login_succeeded")

  if (connError) {
    throw new Error(`Erro ao buscar conectores: ${connError.message}`)
  }

  if (!connectors || connectors.length === 0) {
    return new Response(
      JSON.stringify({
        success: true,
        count: 0,
        message: "Nenhum banco conectado via Open Finance. Conecte um banco primeiro em Ajustes > Contas Bancárias.",
      }),
      { headers: corsHeaders() }
    )
  }

  // 2. Criar sync_log principal
  const { data: syncLog, error: logError } = await supabase
    .rpc("financial.start_sync_log", {
      p_user_id: userId,
      p_connector_item_id: null,
      p_source: "manual",
    })
    .single()

  if (logError || !syncLog) {
    throw new Error(`Erro ao criar sync log: ${logError?.message}`)
  }

  const syncId = typeof syncLog === "object" ? syncLog.id || syncLog : syncLog

  // 3. Sincronizar cada connector
  let totalInserted = 0
  let totalUpdated = 0
  let totalFetched = 0
  let accountsSynced = 0

  for (const connector of connectors) {
    try {
      const result = await syncConnector(supabase, connector, userId, syncId)
      totalInserted += result.inserted
      totalUpdated += result.updated
      totalFetched += result.total
      accountsSynced += result.accounts_synced

      // Atualizar last_sync_at do connector
      await supabase
        .from("financial.pluggy_connectors")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", connector.id)
    } catch (error: any) {
      console.error(`Erro ao sincronizar connector ${connector.item_id}:`, error.message)
      // Continua com o próximo connector
    }
  }

  // 4. Finalizar sync_log
  const finalStatus = totalFetched > 0 ? "completed" : "partial"
  await supabase
    .rpc("financial.finish_sync_log", {
      p_sync_id: syncId,
      p_status: finalStatus,
      p_statements_fetched: totalFetched,
      p_statements_new: totalInserted,
      p_statements_updated: totalUpdated,
      p_accounts_synced: accountsSynced,
    })

  return new Response(
    JSON.stringify({
      success: true,
      sync_id: syncId,
      accounts_synced: accountsSynced,
      statements_fetched: totalFetched,
      statements_new: totalInserted,
      statements_updated: totalUpdated,
      message: `Sincronização concluída. ${totalInserted} novos, ${totalUpdated} atualizados de ${totalFetched} transações.`,
    }),
    { headers: corsHeaders() }
  )
}

// ========================================================
// Sincroniza um único connector Pluggy
// ========================================================
async function syncConnector(
  supabase: ReturnType<typeof createClient>,
  connector: any,
  userId: string,
  syncId: string
): Promise<SyncResult> {
  // 1. Buscar contas bancárias associadas a este item Pluggy
  const { data: accounts, error: accError } = await supabase
    .from("financial.bank_accounts")
    .select("id, pluggy_item_id")
    .eq("user_id", userId)
    .eq("pluggy_item_id", connector.item_id)

  if (accError || !accounts || accounts.length === 0) {
    return { inserted: 0, updated: 0, total: 0, accounts_synced: 0 }
  }

  // 2. Buscar transações no Pluggy
  // Buscar dos últimos 90 dias para capturar transações recentes
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - 90)
  const toDate = new Date()

  const fromStr = fromDate.toISOString().split("T")[0]
  const toStr = toDate.toISOString().split("T")[0]

  let allTransactions: any[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const response = await fetchPluggy(
      `/transactions?itemId=${connector.item_id}&from=${fromStr}&to=${toStr}&page=${page}&pageSize=200`
    )

    const transactions = response.results || []
    allTransactions = allTransactions.concat(transactions)

    hasMore = response.totalPages && page < response.totalPages
    page++
  }

  // 3. Agrupar transações por conta bancária
  const total = allTransactions.length

  if (total === 0) {
    return { inserted: 0, updated: 0, total: 0, accounts_synced: 1 }
  }

  // 4. Preparar statements para upsert em lote
  const statementsJson: any[] = []

  for (const tx of allTransactions) {
    const bankAccount = accounts.find((a: any) =>
      a.pluggy_item_id === connector.item_id
    )

    if (!bankAccount) continue

    const amount = tx.amount || 0
    const transactionDate = tx.date || tx.createdAt?.split("T")[0]
    if (!transactionDate) continue

    statementsJson.push({
      pluggy_id: tx.id,
      transaction_date: transactionDate,
      amount: amount,
      description: tx.description || tx.rawDescription || "",
      raw_data: tx,
    })
  }    // 5. Upsert em lote usando a função do banco
  const { data: upsertResult, error: upsertError } = await supabase
    .rpc("financial.bulk_upsert_bank_statements", {
      p_user_id: userId,
      p_bank_account_id: accounts[0].id,
      p_sync_id: syncId,
      p_statements: JSON.stringify(statementsJson),
    })

  if (upsertError) {
    console.error("Erro no bulk upsert:", upsertError.message)
    // Fallback: upsert individual (sem contagem precisa de insert vs update)
    let successCount = 0
    for (const stmt of statementsJson) {
      try {
        const { error } = await supabase
          .rpc("financial.upsert_bank_statement", {
            p_user_id: userId,
            p_bank_account_id: accounts[0].id,
            p_pluggy_id: stmt.pluggy_id,
            p_transaction_date: stmt.transaction_date,
            p_amount: stmt.amount,
            p_description: stmt.description,
            p_raw_data: stmt.raw_data,
            p_source: "pluggy",
            p_sync_id: syncId,
          })
        if (!error) successCount++
      } catch (e: any) {
        console.error("Erro no upsert individual:", e.message)
      }
    }
    // No fallback reportamos todos como 'inserted' (não temos como distinguir)
    return { inserted: successCount, updated: 0, total: statementsJson.length, accounts_synced: accounts.length }
  }

  const result = upsertResult as any
  return {
    inserted: result?.inserted || 0,
    updated: result?.updated || 0,
    total: statementsJson.length,
    accounts_synced: accounts.length,
  }
}

// ========================================================
// Rota: POST /sync-bank-statements/connectors/create
// Cria um novo connector Pluggy (inicia OAuth)
// ========================================================
async function handleCreateConnector(req: Request): Promise<Response> {
  const { userId } = await authenticateUser(req)
  const body = await req.json()
  const { connector_id } = body

  if (!connector_id) {
    return new Response(
      JSON.stringify({ error: "connector_id é obrigatório" }),
      { status: 400, headers: corsHeaders() }
    )
  }

  // 1. Criar item no Pluggy
  const pluggyItem = await fetchPluggy("/items", {
    method: "POST",
    body: JSON.stringify({ connectorId: connector_id }),
  })

  const itemId = pluggyItem.id
  const status = pluggyItem.status || "created"
  const redirectUrl = pluggyItem.redirectUrl

  // 2. Salvar connector no banco
  const supabase = getAdminClient()
  const { error: insertError } = await supabase
    .from("financial.pluggy_connectors")
    .insert({
      user_id: userId,
      item_id: itemId,
      connector_id: connector_id,
      connector_name: pluggyItem.connector?.name || connector_id,
      institution_name: pluggyItem.connector?.institutionName || null,
      institution_number: pluggyItem.connector?.institutionNumber || null,
      status: status,
      created_via: "mobile",
    })

  if (insertError) {
    // Se já existe (unique constraint), tenta atualizar
    if (insertError.code === "23505") {
      await supabase
        .from("financial.pluggy_connectors")
        .update({
          status: status,
          updated_at: new Date().toISOString(),
        })
        .eq("item_id", itemId)

      return new Response(
        JSON.stringify({
          success: true,
          item_id: itemId,
          status: status,
          redirect_url: redirectUrl,
          message: "Conector já existente. Atualizado.",
        }),
        { headers: corsHeaders() }
      )
    }

    throw new Error(`Erro ao salvar connector: ${insertError.message}`)
  }

  // 3. Buscar informações do connector no Pluggy para obter nome da instituição
  try {
    const connectorInfo = await fetchPluggy(`/connectors/${connector_id}`)
    if (connectorInfo) {
      await supabase
        .from("financial.pluggy_connectors")
        .update({
          institution_name: connectorInfo.name || connectorInfo.institutionName,
          institution_number: connectorInfo.institutionNumber?.toString() || null,
        })
        .eq("item_id", itemId)
    }
  } catch {
    // Non-critical: apenas enriquecimento de dados
  }

  return new Response(
    JSON.stringify({
      success: true,
      item_id: itemId,
      status: status,
      redirect_url: redirectUrl,
      message: "Conector criado. Complete a autenticação bancária.",
    }),
    { headers: corsHeaders() }
  )
}

// ========================================================
// Rota: POST /sync-bank-statements/connectors/status
// Verifica status de um item Pluggy e cria contas bancárias
// ========================================================
async function handleConnectorStatus(req: Request): Promise<Response> {
  const { userId } = await authenticateUser(req)
  const body = await req.json()
  const { item_id } = body

  if (!item_id) {
    return new Response(
      JSON.stringify({ error: "item_id é obrigatório" }),
      { status: 400, headers: corsHeaders() }
    )
  }

  const supabase = getAdminClient()

  // 1. Verificar no Pluggy
  const pluggyItem = await fetchPluggy(`/items/${item_id}`)

  const newStatus = pluggyItem.status || "login_error"
  const errorDetails = pluggyItem.errorCode
    ? { errorCode: pluggyItem.errorCode, errorMessage: pluggyItem.errorMessage }
    : null

  // 2. Atualizar status no banco
  await supabase
    .from("financial.pluggy_connectors")
    .update({
      status: newStatus,
      error_details: errorDetails ? JSON.stringify(errorDetails) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("item_id", item_id)

  // 3. Se login succeeded, criar/atualizar contas bancárias
  if (newStatus === "login_succeeded") {
    try {
      const accountsData = await fetchPluggy(`/accounts?itemId=${item_id}`)
      const accounts = accountsData.results || []

      for (const acc of accounts) {
        const bankInfo: AccountInfo = {
          id: acc.id,
          name: acc.name || "Conta",
          type: acc.type || "checking",
          number: acc.number || "",
          balance: acc.balance || 0,
          institution: acc.institution || { name: "", number: "" },
        }

        // Upsert em financial.bank_accounts
        const { data: existing } = await supabase
          .from("financial.bank_accounts")
          .select("id")
          .eq("user_id", userId)
          .eq("pluggy_item_id", item_id)
          .maybeSingle()

        const accountData = {
          user_id: userId,
          bank_name: bankInfo.institution.name || bankInfo.name,
          bank_code: bankInfo.institution.number?.toString() || null,
          account_type: normalizeAccountType(bankInfo.type),
          last_digits: bankInfo.number.slice(-4) || null,
          balance: bankInfo.balance || 0,
          provider: "pluggy",
          provider_id: bankInfo.id,
          pluggy_item_id: item_id,
          account_name: bankInfo.name,
          is_connector_managed: true,
          status: "active",
        }

        if (existing) {
          await supabase
            .from("financial.bank_accounts")
            .update({ ...accountData, updated_at: new Date().toISOString() })
            .eq("id", existing.id)
        } else {
          await supabase
            .from("financial.bank_accounts")
            .insert(accountData)
        }
      }
    } catch (error: any) {
      console.error("Erro ao buscar contas do Pluggy:", error.message)
      // Não crítico - contas podem ser criadas no próximo sync
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      item_id: item_id,
      status: newStatus,
      error: errorDetails,
      message: getStatusMessage(newStatus),
    }),
    { headers: corsHeaders() }
  )
}

// ========================================================
// Rota: POST /sync-bank-statements/connectors/list
// Lista todos os conectores do usuário
// ========================================================
async function handleListConnectors(req: Request): Promise<Response> {
  const { userId } = await authenticateUser(req)
  const supabase = getAdminClient()

  const { data: connectors, error } = await supabase
    .from("financial.pluggy_connectors")
    .select("id, item_id, connector_id, connector_name, institution_name, institution_number, status, last_sync_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(`Erro ao listar conectores: ${error.message}`)
  }

  return new Response(
    JSON.stringify({
      success: true,
      connectors: connectors || [],
    }),
    { headers: corsHeaders() }
  )
}

// ========================================================
// Rota: POST /sync-bank-statements/connectors/delete
// Remove connector e contas associadas
// ========================================================
async function handleDeleteConnector(req: Request): Promise<Response> {
  const { userId } = await authenticateUser(req)
  const body = await req.json()
  const { item_id } = body

  if (!item_id) {
    return new Response(
      JSON.stringify({ error: "item_id é obrigatório" }),
      { status: 400, headers: corsHeaders() }
    )
  }

  const supabase = getAdminClient()

  // 1. Deletar contas bancárias associadas
  await supabase
    .from("financial.bank_accounts")
    .delete()
    .eq("user_id", userId)
    .eq("pluggy_item_id", item_id)

  // 2. Deletar connector
  await supabase
    .from("financial.pluggy_connectors")
    .delete()
    .eq("user_id", userId)
    .eq("item_id", item_id)

  // 3. Deletar item no Pluggy (se possível)
  try {
    await fetchPluggy(`/items/${item_id}`, { method: "DELETE" })
  } catch {
    // Non-critical: item pode já ter sido removido
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Conexão bancária removida com sucesso.",
    }),
    { headers: corsHeaders() }
  )
}

// ========================================================
// Rota: GET /sync-bank-statements/health
// Health check
// ========================================================
function handleHealth(): Response {
  return new Response(
    JSON.stringify({
      status: "healthy",
      service: "sync-bank-statements",
      version: "2.0",
      pluggy_configured: !!Deno.env.get("PLUGGY_API_KEY"),
    }),
    { headers: corsHeaders() }
  )
}

// ========================================================
// Helpers
// ========================================================
function normalizeAccountType(type: string): string {
  const mapping: Record<string, string> = {
    checking: "corrente",
    savings: "poupanca",
    payment: "pagamento",
    credit: "credito",
    investment: "investimento",
  }
  return mapping[type.toLowerCase()] || type
}

function getStatusMessage(status: string): string {
  const messages: Record<string, string> = {
    created: "Conexão criada. Aguardando autenticação.",
    waiting_user_input: "Complete a autenticação no seu banco.",
    updating: "Atualizando dados bancários...",
    login_succeeded: "Banco conectado com sucesso!",
    login_error: "Falha na autenticação. Tente novamente.",
  }
  return messages[status] || "Status desconhecido."
}

// ========================================================
// Rota: POST /sync-bank-statements/webhook
// Recebe eventos do webhook Pluggy
// ========================================================
async function handleWebhook(req: Request): Promise<Response> {
  try {
    const supabase = getAdminClient()

    // 1. Validar token do webhook (segurança)
    const webhookToken = req.headers.get("x-webhook-token")
    const expectedToken = Deno.env.get("PLUGGY_WEBHOOK_SECRET")

    if (expectedToken && webhookToken !== expectedToken) {
      console.warn("Webhook rejeitado: token inválido")
      return new Response(
        JSON.stringify({ error: "Invalid webhook token" }),
        { status: 403, headers: corsHeaders() }
      )
    }

    const body = await req.json()

    // 2. Registrar evento (tolerante a falha - não deve quebrar o webhook)
    try {
      await supabase
        .from("financial.pluggy_webhook_events")
        .insert({
          event_id: body.id,
          event_type: body.type,
          item_id: body.itemId || body.data?.itemId,
          connector_id: body.connectorId || body.data?.connectorId,
          payload: body,
          status: "pending",
        })
    } catch (insertError: any) {
      console.error("Erro ao registrar webhook event (não crítico):", insertError.message)
    }

  // 3. Processar evento
  const eventType = body.type || ""
  const itemId = body.itemId || body.data?.itemId

  try {
    if (eventType === "transaction/created" && itemId) {
      // Atualizações de transações são tratadas no próximo sync
      // Mas podemos marcar o connector para sync rápido
      await supabase
        .from("financial.pluggy_connectors")
        .update({ status: "updating" })
        .eq("item_id", itemId)

      // Marcar evento como processado
      await supabase
        .from("financial.pluggy_webhook_events")
        .update({ status: "processed", processed_at: new Date().toISOString() })
        .eq("event_id", body.id)
    } else if (eventType === "item/updated" && itemId) {
      // Atualizar status do connector
      await supabase
        .from("financial.pluggy_connectors")
        .update({
          status: body.data?.status || "login_succeeded",
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("item_id", itemId)

      await supabase
        .from("financial.pluggy_webhook_events")
        .update({ status: "processed", processed_at: new Date().toISOString() })
        .eq("event_id", body.id)
    } else {
      // Evento não processado (apenas armazenado)
      await supabase
        .from("financial.pluggy_webhook_events")
        .update({ status: "ignored" })
        .eq("event_id", body.id)
    }    } catch (error: any) {
      console.error(`Erro ao processar webhook ${body.id}:`, error.message)
      try {
        await supabase
          .from("financial.pluggy_webhook_events")
          .update({
            status: "failed",
            error_message: error.message,
          })
          .eq("event_id", body.id)
      } catch {
        // Silencia erro secundário
      }
    }

    // Sempre retornar 200 para o Pluggy (evita retentativas)
    return new Response(
      JSON.stringify({ success: true }),
      { headers: corsHeaders() }
    )
  } catch (outerError: any) {
    console.error("Erro crítico no webhook handler:", outerError.message)
    // Sempre retornar 200 para o Pluggy
    return new Response(
      JSON.stringify({ success: true, warning: "Processado com erros" }),
      { headers: corsHeaders() }
    )
  }
}

// ========================================================
// Rota: GET /sync-bank-statements/connectors/available
// Lista conectores disponíveis no Pluggy
// ========================================================
async function handleAvailableConnectors(): Promise<Response> {
  try {
    const connectors = await fetchPluggy("/connectors?pageSize=200")
    const brazilianConnectors = (connectors.results || [])
      .filter((c: any) => c.country === "BR" || !c.country)
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        institutionName: c.institutionName,
        institutionNumber: c.institutionNumber,
        imageUrl: c.imageUrl,
        type: c.type,
        hasMFA: c.hasMFA,
      }))

    return new Response(
      JSON.stringify({
        success: true,
        connectors: brazilianConnectors,
      }),
      { headers: corsHeaders() }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Erro ao buscar conectores do Pluggy",
        connectors: getFallbackConnectors(),
      }),
      { headers: corsHeaders() }
    )
  }
}

// Fallback: lista de conectores conhecidos caso a API do Pluggy falhe
function getFallbackConnectors(): any[] {
  return [
    { id: "banco-do-brasil", name: "Banco do Brasil", institutionName: "Banco do Brasil", institutionNumber: "001", type: "PERSONAL_BANK", hasMFA: true },
    { id: "caixa", name: "Caixa Econômica Federal", institutionName: "Caixa Econômica Federal", institutionNumber: "104", type: "PERSONAL_BANK", hasMFA: true },
    { id: "itau", name: "Itaú Unibanco", institutionName: "Itaú Unibanco", institutionNumber: "341", type: "PERSONAL_BANK", hasMFA: true },
    { id: "bradesco", name: "Bradesco", institutionName: "Bradesco", institutionNumber: "237", type: "PERSONAL_BANK", hasMFA: true },
    { id: "santander", name: "Santander", institutionName: "Santander", institutionNumber: "033", type: "PERSONAL_BANK", hasMFA: true },
    { id: "nubank", name: "Nubank", institutionName: "Nubank", institutionNumber: "260", type: "PERSONAL_BANK", hasMFA: false },
    { id: "inter", name: "Banco Inter", institutionName: "Banco Inter", institutionNumber: "077", type: "PERSONAL_BANK", hasMFA: false },
    { id: "c6", name: "C6 Bank", institutionName: "C6 Bank", institutionNumber: "336", type: "PERSONAL_BANK", hasMFA: false },
    { id: "next", name: "Next", institutionName: "Next", institutionNumber: "237", type: "DIGITAL_ACCOUNT", hasMFA: false },
    { id: "picpay", name: "PicPay", institutionName: "PicPay", institutionNumber: "380", type: "DIGITAL_ACCOUNT", hasMFA: false },
    { id: "mercadopago", name: "Mercado Pago", institutionName: "Mercado Pago", institutionNumber: "323", type: "DIGITAL_ACCOUNT", hasMFA: false },
    { id: "pagseguro", name: "PagSeguro", institutionName: "PagSeguro", institutionNumber: "290", type: "DIGITAL_ACCOUNT", hasMFA: false },
  ]
}

// ========================================================
// Main Router
// ========================================================
serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    })
  }

  const url = parseUrl(req)
  const pathname = url.pathname.replace(/^\/sync-bank-statements/, "") || "/"

  try {
    // Rotas públicas
    if (req.method === "GET" && pathname === "/health") {
      return handleHealth()
    }

    if (req.method === "GET" && pathname === "/connectors/available") {
      return await handleAvailableConnectors()
    }

    // Rotas de webhook (sem autenticação JWT - usa token próprio)
    if (req.method === "POST" && pathname === "/webhook") {
      return await handleWebhook(req)
    }

    // Rotas que exigem autenticação JWT
    if (req.method === "POST") {
      switch (pathname) {
        case "/":
        case "/sync":
          return await handleSync(req)

        case "/connectors/create":
          return await handleCreateConnector(req)

        case "/connectors/status":
          return await handleConnectorStatus(req)

        case "/connectors/list":
          return await handleListConnectors(req)

        case "/connectors/delete":
          return await handleDeleteConnector(req)
      }
    }

    // 404
    return new Response(
      JSON.stringify({ error: "Rota não encontrada" }),
      { status: 404, headers: corsHeaders() }
    )
  } catch (error: any) {
    console.error("Erro:", error.message, error.stack)

    if (error instanceof AuthError) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 401, headers: corsHeaders() }
      )
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Erro interno",
      }),
      { status: 500, headers: corsHeaders() }
    )
  }
})
