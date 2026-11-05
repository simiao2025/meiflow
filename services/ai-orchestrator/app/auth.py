import logging
import secrets
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.config import settings
from tools.crm_tools import _get_user_id_from_token

logger = logging.getLogger("ai-orchestrator-auth")

security_scheme = HTTPBearer(auto_error=False)

async def get_current_user_id(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
) -> str:
    """
    Extrai e valida o user_id do token JWT (Supabase Auth).
    Suporta fallback interno Server-to-Server apenas quando ambas as chaves
    estiverem configuradas e forem comparadas de forma segura com tempo constante.
    """
    if credentials and credentials.credentials:
        try:
            user_id = await _get_user_id_from_token(credentials.credentials)
            if user_id:
                return user_id
        except Exception as e:
            logger.warning(f"Falha ao validar JWT: {e}")

    # Fallback estrito Server-to-Server
    internal_key = request.headers.get("X-Internal-Key", "")
    user_id_header = request.headers.get("X-User-Id", "")
    expected_key = getattr(settings, "INTERNAL_API_KEY", "") or ""

    if internal_key and expected_key and secrets.compare_digest(internal_key, expected_key):
        if user_id_header:
            return user_id_header

    raise HTTPException(
        status_code=401,
        detail="Autenticação necessária. Envie o token JWT no cabeçalho Authorization: Bearer <token>.",
    )
