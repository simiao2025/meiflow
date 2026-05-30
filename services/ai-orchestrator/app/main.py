import base64
import csv
import io
import logging
import re

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import PlainTextResponse
from langchain_core.messages import HumanMessage
from pydantic import BaseModel

from agents.assistant.graph import assistant_app
from agents.customer.graph import customer_app
from app.config import settings
from app.whatsapp_service import WhatsAppService
from integrations.audio_service import AudioService
from app.scheduler import start_scheduler
from shared.middleware import SecurityHeadersMiddleware, CorrelationIdMiddleware
import httpx
from tools.crm_tools import _supabase_get, _supabase_patch, _supabase_post

logger = logging.getLogger(__name__)

app = FastAPI(title="MEIFlow AI Service", version="0.1.0")
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CorrelationIdMiddleware)

@app.on_event("startup")
async def startup_event():
    start_scheduler()

class EmitInvoiceRequest(BaseModel):
    user_id: str
    client_id: str
    catalog_item_id: str
    quantity: float

@app.post("/api/fiscal/emit")
async def emit_invoice(data: EmitInvoiceRequest):
    from tools.fiscal_tools import get_headers, FISCAL_SERVICE_URL
    from tools.crm_tools import CRM_SERVICE_URL
    
    try:
        # 1. Fetch client details from CRM Service
        async with httpx.AsyncClient() as client_http:
            # Precisamos de um endpoint específico no CRM ou filtrar o list
            resp_crm = await client_http.get(f"{CRM_SERVICE_URL}/clients/{data.user_id}", headers=get_headers())
            resp_crm.raise_for_status()
            clients = resp_crm.json()
            client = next((c for c in clients if c['id'] == data.client_id), None)
            
        if not client:
            raise HTTPException(status_code=404, detail="Cliente não encontrado no CRM")
            
        # 2. Call Fiscal Service to emit
        payload = {
            "user_id": data.user_id,
            "client_id": data.client_id,
            "amount": 0, # Exemplo simplificado
            "description": "Emissão via API"
        }
        async with httpx.AsyncClient() as fiscal_http:
            resp_fiscal = await fiscal_http.post(f"{FISCAL_SERVICE_URL}/invoices", json=payload, headers=get_headers())
            resp_fiscal.raise_for_status()
            fiscal_res = resp_fiscal.json()
            
        return {"success": True, "invoice": fiscal_res}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao emitir NF: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao processar emissão.")

@app.get("/api/fiscal/report")
async def get_accountant_report(user_id: str, month: int, year: int):
    """
    Gera um relatório CSV mensal das notas emitidas e capturadas para o contador baixar.
    """
    try:
        invoices = await _supabase_get("invoices", {"user_id": f"eq.{user_id}"})
        
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['ID', 'Tipo', 'Direção', 'Emissor/Destinatário', 'Data', 'Valor', 'Status'])
        
        total_faturamento = 0
        for inv in (invoices or []):
            writer.writerow([
                inv.get('id'), inv.get('type'), inv.get('direction'), 
                inv.get('receiver_name') or inv.get('issuer_name', 'Desconhecido'),
                inv.get('issue_date'), inv.get('total_amount'), inv.get('status')
            ])
            if inv.get('direction') == 'outbound' and inv.get('status') == 'autorizada':
                total_faturamento += float(inv.get('total_amount') or 0)
                
        writer.writerow([])
        writer.writerow(['RESUMO DO MÊS'])
        writer.writerow(['Total Faturamento (Saída):', f"R$ {total_faturamento:.2f}"])
        
        return PlainTextResponse(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=relatorio_contador_{month}_{year}.csv"}
        )
    except Exception as e:
        logger.error(f"Erro ao gerar relatório: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao gerar relatório.")

class CreateChargeRequest(BaseModel):
    user_id: str
    client_id: str
    amount: float
    method: str
    description: str = ""

@app.post("/api/billing/charge")
async def create_billing_charge(data: CreateChargeRequest):
    from tools.financial_tools import get_headers, FINANCIAL_SERVICE_URL
    from tools.crm_tools import CRM_SERVICE_URL
    
    try:
        # 1. Fetch Client Name from CRM Service
        async with httpx.AsyncClient() as client_http:
            resp_crm = await client_http.get(f"{CRM_SERVICE_URL}/clients/{data.user_id}", headers=get_headers())
            resp_crm.raise_for_status()
            clients = resp_crm.json()
            client = next((c for c in clients if c['id'] == data.client_id), None)
            client_name = client['name'] if client else "Cliente Avulso"
        
        # 2. Se for Dinheiro, chama o Financial Service
        if data.method == 'cash':
            payload_trans = {
                "user_id": data.user_id,
                "amount": data.amount,
                "description": data.description or "Pagamento em dinheiro",
                "category": "Receita"
            }
            async with httpx.AsyncClient() as fin_http:
                resp_fin = await fin_http.post(f"{FINANCIAL_SERVICE_URL}/transactions", json=payload_trans, headers=get_headers())
                resp_fin.raise_for_status()
                res = resp_fin.json()
                
            return {"success": True, "transaction": res, "message": "Pagamento registrado no domínio financeiro."}

        # 3. Se for PIX/Cartão, chamaria o Gateway externo (mantido mock por enquanto)
        return {"success": True, "message": "Gateway de pagamento não implementado nesta fase."}
        
    except Exception as e:
        logger.error(f"Erro ao criar cobrança: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")

@app.post("/api/webhooks/asaas")
async def webhook_asaas(request: Request, event_data: dict):
    """
    Recebe evento de pagamento confirmado do Asaas.
    Protegido por token de webhook.
    """
    # Validação do token de webhook
    token = request.headers.get("asaas-access-token", "")
    if settings.ASAAS_WEBHOOK_TOKEN and token != settings.ASAAS_WEBHOOK_TOKEN:
        logger.warning(f"Webhook Asaas rejeitado: token inválido")
        raise HTTPException(status_code=403, detail="Token inválido")
    
    try:
        event_type = event_data.get('event', '')
        if event_type == 'PAYMENT_RECEIVED':
            payment_info = event_data.get('payment')
            if not payment_info or not payment_info.get('id'):
                return {"message": "Payload inválido."}
            
            ext_ref = payment_info['id']
            charges = await _supabase_get("charges", {"external_reference": f"eq.{ext_ref}"})
            if not charges:
                return {"message": "Charge não encontrada."}
                
            charge = charges[0]
            if charge.get('status') == 'paid':
                return {"message": "Charge já estava paga."}
            
            # Atualiza charge para pago usando _supabase_patch
            await _supabase_patch("charges", "external_reference", ext_ref, {"status": "paid"})
            
            # Insere no caixa (transactions)
            payload_trans = {
                "user_id": charge.get("user_id", ""),
                "type": "receita",
                "amount": charge.get("amount", 0),
                "category": f"Pagamento via {charge.get('payment_method') or 'gateway'}",
                "description": charge.get("description") or "Pagamento recebido",
                "payment_method": charge.get('payment_method') or 'gateway',
                "client_id": charge.get("client_id", ""),
            }
            await _supabase_post("transactions", payload_trans)
                
            logger.info(f"Pagamento confirmado: {ext_ref}")
            return {"success": True, "message": "Pagamento liquidado."}
            
        return {"message": "Evento ignorado."}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro no webhook Asaas: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")

class ChatRequest(BaseModel):
    message: str
    user_id: str
    thread_id: str = "default"
    provider: str | None = None  # openai, anthropic, google, groq

class ChatResponse(BaseModel):
    response: str
    thread_id: str

@app.post("/api/v1/chat")
async def api_chat(data: ChatRequest):
    try:
        initial_state = {
            "messages": [HumanMessage(content=data.message)],
            "user_id": data.user_id,
        }
        config = {"configurable": {"thread_id": data.thread_id}}
        
        logger.info(f"Chat user={data.user_id} provider={data.provider or 'default'}")
        result = await assistant_app.ainvoke(initial_state, config=config)
        ai_response_text = result["messages"][-1].content or ""
        
        return {"response": ai_response_text, "thread_id": data.thread_id}
    except Exception as e:
        logger.error(f"Erro no chat: {e}")
        raise HTTPException(status_code=500, detail="Erro interno no assistente.")

class AudioChatRequest(BaseModel):
    audio_base64: str
    user_id: str
    thread_id: str = "default"
    return_audio: bool = True  # Se True, retorna TTS da resposta

@app.post("/api/v1/chat/audio")
async def api_chat_audio(data: AudioChatRequest):
    """Recebe áudio base64 do app, transcreve, processa com IA e retorna texto + áudio."""
    try:
        # 1. Decodifica e transcreve o áudio
        audio_bytes = base64.b64decode(data.audio_base64)
        transcribed_text = await AudioService.transcribe_audio(audio_bytes, f"app_{data.user_id[:8]}.m4a")
        
        if not transcribed_text:
            return {"response": "Não consegui entender o áudio. Tente novamente.", "transcription": "", "audio_base64": None}
        
        logger.info(f"Áudio transcrito: '{transcribed_text[:50]}...'")
        
        # 2. Processa com a IA (mesmo fluxo do chat texto)
        initial_state = {
            "messages": [HumanMessage(content=transcribed_text)],
            "user_id": data.user_id,
        }
        config = {"configurable": {"thread_id": data.thread_id}}
        
        result = await assistant_app.ainvoke(initial_state, config=config)
        ai_response_text = result["messages"][-1].content or ""
        
        # 3. Gera áudio da resposta (TTS) se solicitado
        response_audio_b64 = None
        if data.return_audio and ai_response_text:
            tts_bytes = await AudioService.generate_speech(ai_response_text)
            if tts_bytes:
                response_audio_b64 = base64.b64encode(tts_bytes).decode('utf-8')
        
        return {
            "response": ai_response_text,
            "transcription": transcribed_text,
            "audio_base64": response_audio_b64,
            "thread_id": data.thread_id,
        }
    except Exception as e:
        logger.error(f"Erro no chat de áudio: {e}")
        raise HTTPException(status_code=500, detail="Erro interno no processamento de áudio.")

@app.get("/health")
async def health():
    return {"status": "healthy"}

# --- CRM Service Proxies (WhatsApp Integration) ---

class EvolutionPairingRequest(BaseModel):
    user_id: str
    phone_number: str

class EvolutionInstanceRequest(BaseModel):
    user_id: str
    cnpj: str

@app.post("/api/v1/crm/evolution/instance/create")
async def proxy_instance_create(req: EvolutionInstanceRequest, request: Request):
    from tools.crm_tools import CRM_SERVICE_URL
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{CRM_SERVICE_URL}/evolution/instance/create",
                json=req.dict(),
                headers={"X-Internal-Key": request.headers.get("X-Internal-Key", "")},
                timeout=20.0
            )
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
        except Exception as e:
            logger.error(f"Erro no proxy instance create: {e}")
            raise HTTPException(status_code=502, detail="Erro de comunicação com CRM Service")

@app.post("/api/v1/crm/evolution/instance/pairing-code")
async def proxy_pairing_code(req: EvolutionPairingRequest, request: Request):
    from tools.crm_tools import CRM_SERVICE_URL
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                f"{CRM_SERVICE_URL}/evolution/instance/pairing-code",
                json=req.dict(),
                headers={"X-Internal-Key": request.headers.get("X-Internal-Key", "")},
                timeout=20.0
            )
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
        except Exception as e:
            logger.error(f"Erro no proxy pairing-code: {e}")
            raise HTTPException(status_code=502, detail="Erro de comunicação com CRM Service")

@app.get("/api/v1/crm/evolution/instance/status/{user_id}")
async def proxy_instance_status(user_id: str, request: Request):
    from tools.crm_tools import CRM_SERVICE_URL
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"{CRM_SERVICE_URL}/evolution/instance/status/{user_id}",
                headers={"X-Internal-Key": request.headers.get("X-Internal-Key", "")},
                timeout=10.0
            )
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
        except Exception as e:
            logger.error(f"Erro no proxy instance status: {e}")
            raise HTTPException(status_code=502, detail="Erro de comunicação com CRM Service")

@app.delete("/api/v1/crm/evolution/instance/disconnect/{user_id}")
async def proxy_instance_disconnect(user_id: str, request: Request):
    from tools.crm_tools import CRM_SERVICE_URL
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.delete(
                f"{CRM_SERVICE_URL}/evolution/instance/disconnect/{user_id}",
                headers={"X-Internal-Key": request.headers.get("X-Internal-Key", "")},
                timeout=15.0
            )
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
        except Exception as e:
            logger.error(f"Erro no proxy instance disconnect: {e}")
            raise HTTPException(status_code=502, detail="Erro de comunicação com CRM Service")

@app.post("/webhook/whatsapp")
async def whatsapp_webhook(request: Request, data: dict):
    # Validação do token de webhook (Evolution API envia no header)
    webhook_token = request.headers.get("x-webhook-token", "")
    if settings.WEBHOOK_SECRET_TOKEN and webhook_token != settings.WEBHOOK_SECRET_TOKEN:
        logger.warning("Webhook WhatsApp rejeitado: token inválido")
        raise HTTPException(status_code=403, detail="Token inválido")

    event = data.get('event', '').lower()
    
    if event in ['messages.upsert', 'messages_upsert']:
        message_data = data.get('data', {})
        message = message_data.get('message', {})
        key = message_data.get('key', {})
        remote_jid = key.get('remoteJid')
        instance_name = data.get('instance')
        message_id = key.get('id')

        if key.get('fromMe', False) or not remote_jid:
            return {"status": "ignored_self"}

        client_phone = remote_jid.split('@')[0]
        
        # 1. VERIFICAR SE O ATENDIMENTO HUMANO ESTÁ ATIVADO
        client_record = await _supabase_get("clients", {"whatsapp_number": f"eq.{client_phone}"})
        if client_record:
            if not client_record[0].get("ai_agent_enabled", True):
                logger.info(f"IA desligada para o cliente {client_phone}. Ignorando.")
                return {"status": "human_handoff_active"}
            mei_user_id = client_record[0].get("user_id", "default_mei")
        else:
            mei_user_id = "default_mei"

        # 2. EXTRAIR TEXTO OU ÁUDIO
        text = ""
        is_audio = False
        
        if 'conversation' in message:
            text = message['conversation']
        elif 'extendedTextMessage' in message:
            text = message['extendedTextMessage'].get('text', "")
        elif 'audioMessage' in message:
            is_audio = True
            logger.info("Recebido áudio. Fazendo download via Evolution API...")
            media_response = await WhatsAppService.download_media(instance_name, message_id)
            if media_response and 'base64' in media_response:
                audio_bytes = base64.b64decode(media_response['base64'])
                text = await AudioService.transcribe_audio(audio_bytes, f"{message_id}.ogg")
                logger.info(f"Áudio transcrito ({len(text)} chars)")

        if text:
            # 3. CHAMAR A IA (Agente do Cliente)
            initial_state = {
                "messages": [HumanMessage(content=text)],
                "mei_id": mei_user_id,
                "client_phone": client_phone
            }
            
            config = {"configurable": {"thread_id": client_phone}}
            
            logger.info(f"Invocando IA para cliente {client_phone}...")
            result = await customer_app.ainvoke(initial_state, config=config)
            ai_response_text = result["messages"][-1].content or ""
            
            # Checa se a IA quer enviar uma imagem
            img_match = re.search(r'\[IMG:(.*?)\]', ai_response_text)
            media_url = None
            if img_match:
                media_url = img_match.group(1).strip()
                ai_response_text = ai_response_text.replace(img_match.group(0), '').strip()

            # 4. ENVIAR RESPOSTA
            if media_url:
                logger.info(f"Enviando mídia: {media_url}")
                await WhatsAppService.send_media(instance_name, client_phone, media_url, ai_response_text)
                
            elif is_audio:
                logger.info("Gerando resposta em áudio...")
                audio_bytes = await AudioService.generate_speech(ai_response_text)
                if audio_bytes:
                    b64_audio = base64.b64encode(audio_bytes).decode('utf-8')
                    await WhatsAppService.send_audio(instance_name, client_phone, b64_audio)
                else:
                    await WhatsAppService.send_message(instance_name, client_phone, ai_response_text)
            elif ai_response_text:
                await WhatsAppService.send_message(instance_name, client_phone, ai_response_text)

    return {"status": "processed"}

@app.get("/api/finance/reconciliations")
async def get_reconciliations(user_id: str):
    try:
        from agents.accounting.reconciler import reconciler_agent
        
        # 1. Fetch un-reconciled bank statements
        statements = await _supabase_get("bank_statements", {
            "user_id": f"eq.{user_id}",
            "reconciled": "is.false"
        }) or []
        
        # 2. Fetch pending invoices and DAS
        invoices = await _supabase_get("invoices", {
            "user_id": f"eq.{user_id}",
            "status": "eq.autorizada"
        }) or []
        
        das_records = await _supabase_get("das_records", {
            "user_id": f"eq.{user_id}",
            "status": "eq.pending"
        }) or []
        
        # 3. Use the AI Reconciler
        suggestions = reconciler_agent.suggest_matches(statements, invoices, das_records)
        
        return {"success": True, "suggestions": suggestions}
    except Exception as e:
        logger.error(f"Error getting reconciliations: {e}")
        raise HTTPException(status_code=500, detail="Erro ao processar conciliação.")

class ApproveReconciliationRequest(BaseModel):
    statement_id: str
    match_type: str
    match_id: str
    amount: float
    description: str

@app.post("/api/finance/reconciliations/approve")
async def approve_reconciliation(data: ApproveReconciliationRequest):
    try:
        # 3. Se for das_payment, altera status do DAS para pago
        if data.match_type == "das_payment":
            await _supabase_patch("das_records", "id", data.match_id, {"status": "paid"})
            
        # 4. Criar transaction (Fluxo de caixa real)
        transaction_payload = {
            "user_id": "extract_from_auth_or_pass_it", # Na verdade, precisamos pegar o user_id. Vamos buscar o statement.
        }
        
        # Fetch the statement to get user_id and other info
        statements = await _supabase_get("bank_statements", {"id": f"eq.{data.statement_id}"})
        if not statements:
            raise HTTPException(status_code=404, detail="Statement não encontrado")
            
        statement = statements[0]
        
        transaction_payload = {
            "user_id": statement["user_id"],
            "type": "receita" if statement["amount"] > 0 else "despesa",
            "amount": abs(statement["amount"]),
            "category": "Conciliação",
            "description": data.description,
            "bank_statement_id": statement["id"]
        }
        await _supabase_post("transactions", transaction_payload)
        
        return {"success": True, "message": "Conciliação aprovada com sucesso."}
    except Exception as e:
        logger.error(f"Error approving reconciliation: {e}")
        raise HTTPException(status_code=500, detail="Erro ao aprovar conciliação.")

@app.get("/api/legal/alerts")
async def get_legal_alerts():
    # In a real implementation, this would query the Legal Agent for recent updates
    # For MVP, we return a mocked structure of recent important MEI changes
    alerts = [
        {
            "id": "leg-1",
            "title": "Aumento do limite de faturamento do MEI aprovado na comissão",
            "impact": "Alta",
            "date": "Hoje",
            "source": "Diário Oficial"
        },
        {
            "id": "leg-2",
            "title": "Novo valor da contribuição DAS INSS ajustado pelo salário mínimo",
            "impact": "Crítica",
            "date": "Ontem",
            "source": "Receita Federal"
        },
        {
            "id": "leg-3",
            "title": "Obrigatoriedade de emissão de NFS-e no padrão nacional",
            "impact": "Moderada",
            "date": "15/05/2026",
            "source": "Governo Federal"
        }
    ]
    return {"alerts": alerts}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
