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
import json
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from shared.cache import redis_client
from shared.database import supabase_admin

from app.config import settings
from integrations.meta_oauth import (
    build_oauth_url,
    exchange_code_for_token,
    generate_pkce,
    generate_state,
    get_waba_and_phone_number,
)
from integrations.whatsapp_meta import WhatsAppMetaClient, WhatsAppMetaError

logger = logging.getLogger("meta-routes")

router = APIRouter(prefix="/api/v1/crm/meta", tags=["meta"])


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
