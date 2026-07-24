"""
Meta OAuth 2.0 + Embedded Signup PKCE helper.

Implementa o fluxo Embedded Signup da Meta para WhatsApp Business Cloud API:
1. Cliente (mobile) abre o OAuth dialog via auth session (PKCE) no navegador.
2. Após consentimento, Meta redireciona de volta ao app com `code`.
3. Backend troca `code` por System User Access Token (long-lived).
4. Token é armazenado em profiles.meta_*.

Segurança:
- `state` valida origem (anti-CSRF).
- `code_verifier` + `code_challenge` (PKCE S256) impede interceptação do code.
- Token nunca é exposto ao mobile; somente o `connected=true` é retornado.
"""
import base64
import hashlib
import secrets
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlencode

import httpx

from app.config import settings

META_AUTH_BASE = "https://www.facebook.com/v19.0/dialog/oauth"
META_TOKEN_URL = "https://graph.facebook.com/v19.0/oauth/access_token"
META_GRAPH_BASE = "https://graph.facebook.com/v19.0"

# Escopos obrigatórios para WhatsApp Business Cloud API
REQUIRED_SCOPES = [
    "whatsapp_business_messaging",
    "whatsapp_business_management",
    "business_management",
]


@dataclass
class PKCEChallenge:
    verifier: str
    challenge: str


def generate_pkce() -> PKCEChallenge:
    """Gera par code_verifier + code_challenge S256 conforme RFC 7636."""
    verifier_bytes = secrets.token_bytes(64)
    verifier = base64.urlsafe_b64encode(verifier_bytes).rstrip(b"=").decode("ascii")
    challenge_bytes = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(challenge_bytes).rstrip(b"=").decode("ascii")
    return PKCEChallenge(verifier=verifier, challenge=challenge)


def generate_state() -> str:
    """Token anti-CSRF de 32 chars."""
    return secrets.token_urlsafe(24)


def build_oauth_url(
    redirect_uri: str,
    state: str,
    pkce: PKCEChallenge,
) -> str:
    """
    Monta a URL de autorização da Meta (Embedded Signup).
    O `client_id` é o App ID da Meta (EXPO_PUBLIC_META_APP_ID no mobile;
    META_APP_ID no backend). Configurado para login dialog com escopos WA.
    """
    app_id = settings.META_APP_ID
    if not app_id:
        raise RuntimeError("META_APP_ID não configurado no ambiente.")

    params = {
        "client_id": app_id,
        "redirect_uri": redirect_uri,
        "state": state,
        "scope": ",".join(REQUIRED_SCOPES),
        "response_type": "code",
        "code_challenge": pkce.challenge,
        "code_challenge_method": "S256",
        # Facebook Embedded Signup: abre popup de negócios
        "display": "popup",
    }
    return f"{META_AUTH_BASE}?{urlencode(params)}"


async def exchange_code_for_token(
    code: str,
    redirect_uri: str,
    code_verifier: str,
) -> dict:
    """
    Troca o `code` de autorização por um System User Access Token long-lived.
    Retorna dict com access_token, token_type, expires_in (e possível refresh).
    """
    app_id = settings.META_APP_ID
    app_secret = settings.META_APP_SECRET
    if not app_id or not app_secret:
        raise RuntimeError("META_APP_ID / META_APP_SECRET não configurados.")

    params = {
        "client_id": app_id,
        "client_secret": app_secret,
        "code": code,
        "redirect_uri": redirect_uri,
        "code_verifier": code_verifier,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(META_TOKEN_URL, data=params)
        if resp.status_code != 200:
            raise RuntimeError(
                f"Meta token exchange failed: {resp.status_code} {resp.text}"
            )
        return resp.json()


async def get_waba_and_phone_number(access_token: str) -> dict:
    """
    Após obter o token, busca os WhatsApp Business Accounts (WABA) e o
    phone_number_id ativo para enviar mensagens. Retorna:
      { waba_id, phone_number_id, phone_number, business_id }
    """
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=15.0) as client:
        # 1. /me para obter o business user id (e nome se precisar)
        me_resp = await client.get(f"{META_GRAPH_BASE}/me", headers=headers)
        me_resp.raise_for_status()
        me = me_resp.json()

        # 2. Lista os WABAs acessíveis a este usuário
        waba_resp = await client.get(
            f"{META_GRAPH_BASE}/me/whatsapp_business_accounts",
            headers=headers,
            params={"fields": "id,name"},
        )
        waba_resp.raise_for_status()
        waba_data = waba_resp.json()

        wabas = waba_data.get("data", [])
        if not wabas:
            raise RuntimeError(
                "Nenhum WhatsApp Business Account encontrado. Verifique se o número "
                "Business Manager habilitou a Cloud API."
            )

        waba_id = wabas[0]["id"]

        # 3. Lista os phone_numbers atrelados ao WABA
        phone_resp = await client.get(
            f"{META_GRAPH_BASE}/{waba_id}/phone_numbers",
            headers=headers,
            params={"fields": "id,display_phone_number,verified_name,status"},
        )
        phone_resp.raise_for_status()
        phone_data = phone_resp.json()

        phones = phone_data.get("data", [])
        # Seleciona o primeiro phone ativo (status CONNECTED)
        active_phone = next(
            (p for p in phones if p.get("status", "").upper() == "CONNECTED"),
            phones[0] if phones else None,
        )
        if not active_phone:
            raise RuntimeError(
                "Nenhum phone number conectado no WABA. Vincule no Meta Business Manager."
            )

        return {
            "waba_id": waba_id,
            "phone_number_id": active_phone["id"],
            "phone_number": active_phone.get("display_phone_number", ""),
            "business_id": me.get("id", ""),
        }


async def refresh_token(access_token: str) -> Optional[dict]:
    """
    Tenta renovar o System User Access Token (long-lived).
    System User tokens normalmente não expiram, mas mantemos a hook caso
    seja um token de usuário (60 dias).
    """
    app_id = settings.META_APP_ID
    app_secret = settings.META_APP_SECRET
    params = {
        "grant_type": "fb_exchange_token",
        "client_id": app_id,
        "client_secret": app_secret,
        "fb_exchange_token": access_token,
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(META_TOKEN_URL, params=params)
            resp.raise_for_status()
            return resp.json()
    except Exception:
        return None
