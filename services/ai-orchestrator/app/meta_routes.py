"""
Rotas Meta WhatsApp Business Cloud API.

Implementa o fluxo completo de OAuth 2.0 PKCE (Embedded Signup) e operações
pós-conexão (status, disconnect, send). Não substitui nem conflita com o
proxy do Evolution Go — coexistem como provedores paralelos.

Fluxo OAuth (RFC 7636 + Meta Embedded Signup):
1. Mobile -> POST /api/v1/crm/meta/oauth/start
   Retorna { auth_url, state } com state/pkce armazenados em Redis (60s).
2. Mobile abre auth_url em WebBrowser -> Meta dialog -> consentimento.
3. Meta redireciona para REDIRECT_URI (callback backend) com `code`.
4. Backend -> POST /api/v1/crm/meta/oauth/callback com { state, code, user_id }
   (client envia novamente user_id pra amarrar; backend valida state em Redis
   e troca code por token via PKCE). Grava token em profiles.meta_*.
5. Mobile faz polling de status -> GET /api/v1/crm/meta/status/{user_id}
   até receber "connected".
"""
import hashlib
import hmac
import io
import json
import logging
import re
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Response
from langchain_core.messages import HumanMessage
from pydantic import BaseModel
from shared.cache import redis_client
from shared.database import supabase, supabase_admin

from app.config import settings
from integrations.audio_service import AudioService
from integrations.meta_oauth import (
    build_oauth_url,
    exchange_code_for_token,
    generate_pkce,
    generate_state,
    get_waba_and_phone_number,
)
from integrations.whatsapp_meta import WhatsAppMetaClient, WhatsAppMetaError, download_media

logger = logging.getLogger("meta-routes")

router = APIRouter(prefix="/api/v1/crm/meta", tags=["meta"])


# Importação tardia para evitar ciclo com app.main -> meta_routes.
# customer_app é o mesmo grafo LangGraph usado pelo webhook Evolution.
def _get_customer_app():
    from agents.customer.graph import customer_app
    return customer_app


def _get_client_record_by_phone(phone: str) -> Optional[dict]:
    try:
        resp = supabase.table("clients").select(
            "id, user_id, name, ai_agent_enabled, whatsapp_number"
        ).eq("whatsapp_number", phone).maybeSingle().execute()
        return resp.data
    except Exception as e:
        logger.error(f"Falha ao buscar cliente por telefone: {e}")
        return None


async def _get_client_record(phone: str) -> Optional[dict]:
    """Wrapper async-friendly (PostgREST é sync)."""
    return _get_client_record_by_phone(phone)


# --- Schemas ---

class OauthStartRequest(BaseModel):
    user_id: str


class OauthStartResponse(BaseModel):
    auth_url: str
    state: str


class OauthCallbackRequest(BaseModel):
    state: str
    code: str
    user_id: str


class StatusResponse(BaseModel):
    status: str  # pending | connected | disconnected | error
    phone_number: Optional[str] = None
    waba_id: Optional[str] = None


class SendTestRequest(BaseModel):
    user_id: str
    to: str
    text: str


# --- Helpers Redis (validade curta p/ PKCE) ---

async def _store_oauth_state(state: str, user_id: str, verifier: str) -> None:
    """Persiste (user_id, verifier) por 5 min para o callback validar."""
    payload = json.dumps({"user_id": user_id, "verifier": verifier})
    # decode_responses=True no redis_client -> valor retorna como str
    await redis_client.set(f"meta:oauth:{state}", payload, ex=300)


async def _consume_oauth_state(state: str) -> Optional[dict]:
    """Lê e remove imediatamente (one-shot) — anti-replay."""
    raw = await redis_client.get(f"meta:oauth:{state}")
    if not raw:
        return None
    await redis_client.delete(f"meta:oauth:{state}")
    return json.loads(raw)


# --- Rotas ---

@router.post("/oauth/start", response_model=OauthStartResponse)
async def meta_oauth_start(req: OauthStartRequest):
    """
    Inicia o fluxo OAuth 2.0 PKCE para Embedded Signup da Meta.
    O mobile abre `auth_url` em um WebBrowser (expo-auth-session ou Linking).
    """
    redirect_uri = settings.META_OAUTH_REDIRECT_URI
    if not redirect_uri:
        raise HTTPException(status_code=500, detail="META_OAUTH_REDIRECT_URI não configurado.")

    state = generate_state()
    pkce = generate_pkce()
    auth_url = build_oauth_url(redirect_uri=redirect_uri, state=state, pkce=pkce)

    await _store_oauth_state(state, req.user_id, pkce.verifier)
    return OauthStartResponse(auth_url=auth_url, state=state)


@router.post("/oauth/callback")
async def meta_oauth_callback(req: OauthCallbackRequest):
    """
    Recebe o `code` do redirect da Meta. Valida state (anti-CSRF) e troca
    code por token usando o PKCE verifier persistido.
    """
    stored = await _consume_oauth_state(req.state)
    if not stored:
        raise HTTPException(status_code=400, detail="State inválido ou expirado.")
    if stored.get("user_id") != req.user_id:
        # State não pertence a este user_id (tentativa de captura)
        raise HTTPException(status_code=403, detail="State não corresponde ao usuário.")

    redirect_uri = settings.META_OAUTH_REDIRECT_URI
    try:
        token_data = await exchange_code_for_token(
            code=req.code,
            redirect_uri=redirect_uri,
            code_verifier=stored["verifier"],
        )
    except Exception as e:
        logger.error(f"Token exchange falhou: {e}")
        raise HTTPException(status_code=502, detail="Falha ao trocar code por token na Meta.")

    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=502, detail="Meta não retornou access_token.")

    # Resolve WABA + phone_number ativos do token
    try:
        meta_info = await get_waba_and_phone_number(access_token)
    except Exception as e:
        logger.error(f"WABA lookup falhou: {e}")
        meta_info = {"waba_id": "", "phone_number_id": "", "phone_number": "", "business_id": ""}

    # Persiste em profiles (apenas colunas meta_* — Evolution intacto)
    try:
        supabase_admin.table("profiles").update({
            "meta_access_token": access_token,
            "meta_waba_id": meta_info.get("waba_id"),
            "meta_phone_number_id": meta_info.get("phone_number_id"),
            "meta_phone_number": meta_info.get("phone_number"),
            "meta_business_id": meta_info.get("business_id"),
            "meta_status": "connected",
            "meta_connected_at": "now()",
        }).eq("id", req.user_id).execute()
    except Exception as e:
        logger.error(f"Erro ao persistir token Meta em profiles: {e}")
        raise HTTPException(status_code=500, detail="Falha ao salvar credenciais no banco.")

    return {"status": "connected", "phone_number": meta_info.get("phone_number")}


@router.get("/status/{user_id}", response_model=StatusResponse)
async def meta_status(user_id: str):
    """Consulta o status de conexão Meta Cloud API do MEI."""
    resp = supabase_admin.table("profiles").select(
        "meta_status, meta_phone_number, meta_waba_id"
    ).eq("id", user_id).single().execute()

    if not resp.data:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    return StatusResponse(
        status=resp.data.get("meta_status", "pending"),
        phone_number=resp.data.get("meta_phone_number"),
        waba_id=resp.data.get("meta_waba_id"),
    )


@router.delete("/disconnect/{user_id}")
async def meta_disconnect(user_id: str):
    """Desconecta o WhatsApp Cloud API deste MEI limpando os campos meta_*."""
    supabase_admin.table("profiles").update({
        "meta_status": "disconnected",
        "meta_access_token": None,
        "meta_waba_id": None,
        "meta_phone_number_id": None,
        "meta_phone_number": None,
        "meta_business_id": None,
        "meta_token_expires_at": None,
        "meta_connected_at": None,
    }).eq("id", user_id).execute()
    return {"status": "disconnected"}


# ============================================================
# Webhook Inbound da Meta Cloud API
# Specs: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
#
# Fluxo:
# GET  /webhook         -> verificação de posse do endpoint (hub.challenge).
# POST /webhook         -> entrega de eventos (messages, status).
#
# Segurança obrigatória:
# - GET: hub.verify_token == META_WEBHOOK_VERIFY_TOKEN.
# - POST: X-Hub-Signature-256 == HMAC-SHA256(raw_body, META_APP_SECRET).
# ============================================================


def _verify_meta_signature(signature_header: str, raw_body: bytes) -> bool:
    """
    Verifica o X-Hub-Signature-256 enviado pela Meta. Formato:
        sha256=<hex>
    Calcula HMAC-SHA256 do body raw usando META_APP_SECRET.
    """
    if not signature_header or "=" not in signature_header:
        return False
    algo, _, hex_sig = signature_header.partition("=")
    if algo.lower() != "sha256":
        return False
    app_secret = settings.META_APP_SECRET
    if not app_secret:
        return False
    expected = hmac.new(
        app_secret.encode("utf-8"), raw_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, hex_sig)


def _normalize_phone(phone: str) -> str:
    return "".join(ch for ch in phone if ch.isdigit())


async def _resolve_mei_by_phone_number_id(phone_number_id: str) -> Optional[dict]:
    """
    A Meta identifica o destino (WABA phone_number_id) em cada evento. Usamos
    ele para encontrar o MEI dono (profiles) e devolver com seu access_token.
    """
    resp = supabase_admin.table("profiles").select(
        "id, meta_access_token, meta_phone_number, meta_status"
    ).eq("meta_phone_number_id", phone_number_id).maybeSingle().execute()
    if not resp.data:
        return None
    if resp.data.get("meta_status") != "connected":
        return None
    return resp.data


async def _dedup_message(message_id: str) -> bool:
    """
    Anti-replay: a Meta pode re-enviar o mesmo evento. Retorna True se a
    mensagem ainda não tinha sido vista (e marca, TTL 24h).
    """
    if not message_id:
        return True
    key = f"meta:msg_seen:{message_id}"
    # SET NX: set só se não existe. Retorna "OK" se criou, None se já existe.
    created = await redis_client.set(key, "1", ex=86400, nx=True)
    return bool(created)


async def _extract_inbound_text(message: dict, access_token: str) -> tuple[str, bool]:
    """
    Extrai texto de uma mensagem inbound da Meta Cloud API.
    Retorna (text, is_audio). A resposta em áudio segue apenas para mensagens
    inbound em áudio (mirror do comportamento Evolution).
    """
    msg_type = message.get("type")
    is_audio = False

    if msg_type == "text":
        return message.get("text", {}).get("body", ""), False

    if msg_type == "audio":
        is_audio = True
        audio_id = message.get("audio", {}).get("id")
        if not audio_id:
            return "", is_audio
        audio_bytes = await download_media(audio_id, access_token)
        if not audio_bytes:
            return "", is_audio
        text = await AudioService.transcribe_audio(audio_bytes, f"{audio_id}.ogg")
        return text, is_audio

    if msg_type == "document":
        doc = message.get("document", {})
        mime = doc.get("mime_type", "")
        if mime != "application/pdf":
            return f"[Cliente enviou um documento: {doc.get('filename', 'documento')}]", False
        doc_id = doc.get("id")
        if not doc_id:
            return "", False
        pdf_bytes = await download_media(doc_id, access_token)
        if not pdf_bytes:
            return "[O cliente enviou um PDF, mas não foi possível baixá-lo.]", False
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
            extracted = "".join(page.extract_text() + "\n" for page in reader.pages)
            return f"[O cliente enviou um documento PDF:\n{extracted[:4000]}]", False
        except Exception as e:
            logger.error(f"Erro ao ler PDF inbound Meta: {e}")
            return "[O cliente enviou um PDF, mas não foi possível extrair o texto.]", False

    if msg_type == "image":
        # Cloud API entrega o caption em image.caption
        caption = message.get("image", {}).get("caption", "")
        return caption or "[Cliente enviou uma imagem]", False

    if msg_type == "interactive":
        interactive = message.get("interactive", {})
        itype = interactive.get("type")
        if itype == "button_reply":
            return interactive.get("button_reply", {}).get("title", ""), False
        if itype == "list_reply":
            return interactive.get("list_reply", {}).get("title", ""), False
        return "", False

    if msg_type == "button":
        return message.get("button", {}).get("text", ""), False

    return "", False


@router.get("/webhook")
async def meta_webhook_verify(
    request: Request,
    hub_mode: Optional[str] = None,
    hub_verify_token: Optional[str] = None,
    hub_challenge: Optional[str] = None,
):
    """Verificação de posse do webhook — Meta envia GET no cadastro."""
    expected = settings.META_WEBHOOK_VERIFY_TOKEN
    if not expected:
        logger.error("META_WEBHOOK_VERIFY_TOKEN não configurado — webhook verify falhou.")
        raise HTTPException(status_code=500, detail="Webhook não configurado.")
    if hub_mode == "subscribe" and hub_verify_token == expected:
        return Response(content=hub_challenge or "", media_type="text/plain")
    raise HTTPException(status_code=403, detail="Verificação do webhook falhou.")


@router.post("/webhook")
async def meta_webhook_inbound(request: Request):
    """
    Recebe eventos da Meta Cloud API. Valida assinatura, despacha mensagens
    para o customer_app (IA) e responde de volta via Cloud API.
    """
    raw_body = await request.body()

    # 1. Validar assinatura HMAC (obrigatório Meta)
    signature = request.headers.get("X-Hub-Signature-256", "")
    if not _verify_meta_signature(signature, raw_body):
        logger.warning("Webhook Meta rejeitado: assinatura inválida.")
        # Meta espera 200 mesmo em falha para não retentar infinitamente.
        return Response(content='{"status":"invalid_signature"}',
                        status_code=403, media_type="application/json")

    try:
        data = json.loads(raw_body)
    except Exception as e:
        logger.error(f"Webhook Meta: JSON inválido: {e}")
        return {"status": "invalid_json"}

    # 2. Estrutura do payload Meta:
    #    { "object": "whatsapp_business_account",
    #      "entry": [ { "changes": [ { "field": "messages", "value": {...} } ] } ] }
    if data.get("object") != "whatsapp_business_account":
        return {"status": "ignored_object"}

    entries = data.get("entry", []) or []
    for entry in entries:
        for change in entry.get("changes", []) or []:
            if change.get("field") != "messages":
                continue
            value = change.get("value", {}) or {}

            # 2.a Phone_number_id identifica o MEI dono da linha.
            phone_number_id = value.get("metadata", {}).get("phone_number_id")
            if not phone_number_id:
                continue

            mei = await _resolve_mei_by_phone_number_id(phone_number_id)
            if not mei:
                logger.info(f"Meta webhook: nenhum MEI ativo para phone_id {phone_number_id}.")
                continue

            access_token = mei["meta_access_token"]
            mei_user_id = mei["id"]

            # 2.b Status de mensagem entregue/lida (não despacha para IA).
            statuses = value.get("statuses", []) or []
            if statuses:
                continue

            # 2.c Mensagens inbound
            messages = value.get("messages", []) or []
            contacts = (value.get("contacts", []) or [])

            for msg in messages:
                message_id = msg.get("id")
                if not await _dedup_message(message_id):
                    logger.info(f"Meta webhook: message_id {message_id} já visto (dedup).")
                    continue

                # Remetente (cliente)
                from_phone_raw = msg.get("from") or ""
                # Meta entrega contatos com wa_id; usamos para nome amigável.
                client_name = ""
                for contact in contacts:
                    if str(contact.get("wa_id")) == str(from_phone_raw):
                        client_name = contact.get("profile", {}).get("name", "")
                        break

                client_phone = _normalize_phone(from_phone_raw)
                if not client_phone:
                    continue

                # 3. Verifica handoff humano para este cliente (mesmo padrão Evolution).
                client_record = await _get_client_record(client_phone)
                if client_record and not client_record.get("ai_agent_enabled", True):
                    logger.info(f"IA desligada para cliente {client_phone}. Ignorando Meta.")
                    continue

                # 4. Extrair conteúdo (texto/áudio/PDF/imagem/interactive).
                text, is_audio = await _extract_inbound_text(msg, access_token)
                if not text:
                    continue

                # Prefixo amigável com nome do cliente quando disponível.
                if client_name and not text.startswith("["):
                    text_input = f"[Nome do cliente: {client_name}]\n{text}"
                else:
                    text_input = text

                # 5. Invocar o mesmo customer_app usado pelo Evolution.
                initial_state = {
                    "messages": [HumanMessage(content=text_input)],
                    "mei_id": mei_user_id,
                    "client_phone": client_phone,
                }
                config = {"configurable": {"thread_id": client_phone}}

                try:
                    customer_app = _get_customer_app()
                    result = await customer_app.ainvoke(initial_state, config=config)
                    ai_response_text = result["messages"][-1].content or ""
                except Exception as e:
                    logger.error(f"customer_app falhou para Meta {client_phone}: {e}")
                    continue

                # Pós-processamento da resposta (extrai [IMG:url]).
                img_match = re.search(r'\[IMG:(.*?)\]', ai_response_text)
                media_url = img_match.group(1).strip() if img_match else None
                if img_match:
                    ai_response_text = ai_response_text.replace(img_match.group(0), '').strip()

                # 6. Marcar mensagem como lida (SLA).
                try:
                    client = WhatsAppMetaClient.client_for(phone_number_id, access_token)
                    await client.mark_message_read(message_id)
                except Exception:
                    # Non-critical — não bloqueia resposta.
                    pass

                # 7. Enviar resposta.
                client = WhatsAppMetaClient.client_for(phone_number_id, access_token)
                try:
                    if media_url:
                        await client.send_image(client_phone, media_url, caption=ai_response_text)
                    elif is_audio:
                        audio_bytes = await AudioService.generate_speech(ai_response_text)
                        if audio_bytes:
                            # Cloud API exige URL pública para áudio. Sem CDN configurado,
                            # fallback para texto.
                            logger.warning("Meta Cloud API: áudio inbound recebido, mas TTS "
                                           "exige CDN pública. Respondendo via texto.")
                            await client.send_text(client_phone, ai_response_text)
                        else:
                            await client.send_text(client_phone, ai_response_text)
                    elif ai_response_text:
                        await client.send_text(client_phone, ai_response_text)
                except WhatsAppMetaError as e:
                    logger.error(f"Erro ao responder via Cloud API {client_phone}: {e}")

    return {"status": "processed"}


@router.post("/send-test")
async def meta_send_test(req: SendTestRequest):
    """
    Envia uma mensagem de teste (texto) para validar a integração.
    Útil diagnóstico pós-conexão; em produção, o webhook inbound substitui.
    """
    resp = supabase_admin.table("profiles").select(
        "meta_phone_number_id, meta_access_token"
    ).eq("id", req.user_id).single().execute()

    if not resp.data:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    phone_id = resp.data.get("meta_phone_number_id")
    token = resp.data.get("meta_access_token")
    if not phone_id or not token:
        raise HTTPException(
            status_code=400,
            detail="Meta Cloud API não conectada para este usuário.",
        )

    client = WhatsAppMetaClient.client_for(phone_id, token)
    try:
        result = await client.send_text(req.to, req.text, preview_url=False)
        return {"status": "sent", "meta_response": result}
    except WhatsAppMetaError as e:
        logger.warning(f"Falha envio teste Meta: {e}")
        return {"status": "error", "code": e.code, "message": str(e)}
