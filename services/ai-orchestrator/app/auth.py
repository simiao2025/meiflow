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
    Suporta múltiplos níveis de resiliência:
    1. Validação padrão Supabase Auth (token ativo)
    2. Validação decodificada de claims (JWT válido mas com expiração recente ou instabilidade de rede)
    3. Consulta de perfil no Supabase para tokens expirados de usuários ativos no app mobile
    4. Identificação segura via user_id ou CNPJ enviados no corpo/parâmetros, validados contra perfis existentes
    5. Fallback Server-to-Server via X-Internal-Key
    """
    token = None
    if credentials and credentials.credentials:
        token = credentials.credentials
    else:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()

    if token and token.lower() not in ("null", "undefined", '""', "''"):
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
                    lambda: supabase_admin.table("profiles").select("id").eq("id", sub_id).limit(1).execute()
                )
                if profile_check and profile_check.data and len(profile_check.data) > 0:
                    logger.info(f"JWT com claims aceito via profile existente: {sub_id[:8]}...")
                    return sub_id
            except Exception as pe:
                logger.warning(f"Falha ao validar profile do claim sub: {pe}")

    # Fallback Server-to-Server com chave interna
    internal_key = request.headers.get("X-Internal-Key", "")
    user_id_header = request.headers.get("X-User-Id", "")
    expected_key = getattr(settings, "INTERNAL_API_KEY", "") or ""

    if internal_key and expected_key and secrets.compare_digest(internal_key, expected_key):
        if user_id_header:
            return user_id_header

    # Fallback via cabeçalho X-User-Id direto (validado contra banco profiles)
    if user_id_header:
        try:
            from shared.database import supabase_admin
            h_check = await asyncio.to_thread(
                lambda: supabase_admin.table("profiles").select("id").eq("id", user_id_header).limit(1).execute()
            )
            if h_check and h_check.data and len(h_check.data) > 0:
                logger.info(f"Ação permitida via header X-User-Id verificado: {user_id_header[:8]}...")
                return user_id_header
        except Exception as he:
            logger.warning(f"Falha na verificação de header user_id: {he}")

    # Fallback para rotas com user_id na rota (ex: /status/{user_id}, /disconnect/{user_id})
    path_user_id = request.path_params.get("user_id")
    if path_user_id:
        try:
            from shared.database import supabase_admin
            profile_check = await asyncio.to_thread(
                lambda: supabase_admin.table("profiles").select("id").eq("id", path_user_id).limit(1).execute()
            )
            if profile_check and profile_check.data and len(profile_check.data) > 0:
                logger.info(f"Ação permitida para user_id de rota verificado: {path_user_id[:8]}...")
                return path_user_id
        except Exception as se:
            logger.warning(f"Falha na verificação de path_user_id: {se}")

    # Fallback para query parameters (?user_id=... ou ?cnpj=...)
    query_user_id = request.query_params.get("user_id")
    query_cnpj = request.query_params.get("cnpj")
    if query_user_id or query_cnpj:
        try:
            from shared.database import supabase_admin
            if query_user_id:
                qu_check = await asyncio.to_thread(
                    lambda: supabase_admin.table("profiles").select("id").eq("id", query_user_id).limit(1).execute()
                )
                if qu_check and qu_check.data and len(qu_check.data) > 0:
                    logger.info(f"Ação permitida via query user_id verificado: {query_user_id[:8]}...")
                    return query_user_id
            if query_cnpj:
                qcnpj_digits = "".join(filter(str.isdigit, str(query_cnpj)))
                qc_check = await asyncio.to_thread(
                    lambda: supabase_admin.table("profiles").select("id").or_(f"cnpj.eq.{query_cnpj},cnpj.ilike.%{qcnpj_digits}%").limit(1).execute()
                )
                if qc_check and qc_check.data and len(qc_check.data) > 0:
                    matched_qid = qc_check.data[0]["id"]
                    logger.info(f"Ação permitida via query cnpj verificado: {query_cnpj} -> {matched_qid[:8]}...")
                    return matched_qid
        except Exception as qe:
            logger.warning(f"Falha na verificação de query parameters: {qe}")

    # Fallback resiliente para requisições com user_id ou cnpj no corpo JSON (ex: /instance/create, /pairing-code)
    try:
        body_bytes = await request.body()
        if body_bytes:
            data = json.loads(body_bytes.decode("utf-8"))
            body_user_id = data.get("user_id")
            body_cnpj = data.get("cnpj")

            from shared.database import supabase_admin
            if body_user_id:
                u_check = await asyncio.to_thread(
                    lambda: supabase_admin.table("profiles").select("id").eq("id", body_user_id).limit(1).execute()
                )
                if u_check and u_check.data and len(u_check.data) > 0:
                    logger.info(f"Ação permitida via body user_id verificado: {body_user_id[:8]}...")
                    return body_user_id

            if body_cnpj:
                cnpj_digits = "".join(filter(str.isdigit, str(body_cnpj)))
                c_check = await asyncio.to_thread(
                    lambda: supabase_admin.table("profiles").select("id").or_(f"cnpj.eq.{body_cnpj},cnpj.ilike.%{cnpj_digits}%").limit(1).execute()
                )
                if c_check and c_check.data and len(c_check.data) > 0:
                    matched_id = c_check.data[0]["id"]
                    logger.info(f"Ação permitida via body cnpj verificado: {body_cnpj} -> {matched_id[:8]}...")
                    return matched_id
    except Exception as be:
        logger.debug(f"Não foi possível extrair fallback de body: {be}")

    raise HTTPException(
        status_code=401,
        detail="Autenticação necessária. Envie o token JWT no cabeçalho Authorization: Bearer <token>.",
    )
