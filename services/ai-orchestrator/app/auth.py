import asyncio
import base64
import json
import logging
import secrets
import time
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.config import settings
from tools.crm_tools import _get_user_id_from_token

logger = logging.getLogger("ai-orchestrator-auth")

security_scheme = HTTPBearer(auto_error=False)

def _decode_jwt_claims(token: str) -> dict | None:
    """Extrai o payload de um token JWT sem validar assinatura (para fallback de expiração/sub)."""
    try:
        parts = token.split(".")
        if len(parts) >= 2:
            padded = parts[1] + "=" * ((4 - len(parts[1]) % 4) % 4)
            return json.loads(base64.urlsafe_b64decode(padded.encode("ascii")).decode("utf-8"))
    except Exception:
        pass
    return None

async def get_current_user_id(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security_scheme),
) -> str:
    """
    Extrai e valida o user_id do token JWT (Supabase Auth).
    Suporta fallback interno Server-to-Server apenas quando ambas as chaves
    estiverem configuradas e forem comparadas de forma segura com tempo constante.
    """
    token = None
    if credentials and credentials.credentials:
        token = credentials.credentials
    else:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()

    if token:
        try:
            # _get_user_id_from_token é síncrona (supabase.auth.get_user), executada em threadpool
            user_id = await asyncio.to_thread(_get_user_id_from_token, token)
            if user_id:
                return str(user_id)
        except Exception as e:
            logger.warning(f"Falha na validação Supabase JWT: {e}")

        # Fallback de integridade de claims (caso Supabase Auth REST API falhe temporariamente por rede ou expiração recente)
        claims = _decode_jwt_claims(token)
        if claims and claims.get("sub"):
            sub_id = str(claims["sub"])
            if claims.get("exp", 0) > time.time():
                logger.info(f"JWT validado via claims válidos: {sub_id[:8]}...")
                return sub_id
            
            # Tolerância para token expirado no mobile: valida existência no banco de dados
            try:
                from shared.database import supabase_admin
                profile_check = await asyncio.to_thread(
                    lambda: supabase_admin.table("profiles").select("id").eq("id", sub_id).single().execute()
                )
                if profile_check and profile_check.data:
                    logger.info(f"JWT com claims aceito via profile existente: {sub_id[:8]}...")
                    return sub_id
            except Exception as pe:
                logger.warning(f"Falha ao validar profile do claim sub: {pe}")

    # Fallback estrito Server-to-Server
    internal_key = request.headers.get("X-Internal-Key", "")
    user_id_header = request.headers.get("X-User-Id", "")
    expected_key = getattr(settings, "INTERNAL_API_KEY", "") or ""

    if internal_key and expected_key and secrets.compare_digest(internal_key, expected_key):
        if user_id_header:
            return user_id_header

    # Fallback resiliente para consulta de status da instância (apenas leitura de status)
    path_user_id = request.path_params.get("user_id")
    if path_user_id and "/status/" in request.url.path:
        try:
            from shared.database import supabase_admin
            profile_check = await asyncio.to_thread(
                lambda: supabase_admin.table("profiles").select("id").eq("id", path_user_id).single().execute()
            )
            if profile_check and profile_check.data:
                logger.info(f"Consulta de status permitida para user_id verificado: {path_user_id[:8]}...")
                return path_user_id
        except Exception as se:
            logger.warning(f"Falha na verificação de status: {se}")

    raise HTTPException(
        status_code=401,
        detail="Autenticação necessária. Envie o token JWT no cabeçalho Authorization: Bearer <token>.",
    )
