import os
from fastapi import Header, HTTPException, status, Request
from shared.logger import get_logger
from shared.database import supabase

logger = get_logger("shared-security")

# Carrega a chave interna do ambiente (Server-to-Server only)
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY")

async def verify_internal_key(x_internal_key: str = Header(None)):
    """
    Middleware de segurança para validar chamadas entre microsserviços internos.
    NÃO deve ser usado em rotas acessíveis pelo app mobile.
    """
    
    if not INTERNAL_API_KEY:
        logger.critical("SEGURANÇA: INTERNAL_API_KEY não configurada no ambiente! Bloqueando acesso por padrão.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro de configuração de segurança no servidor."
        )
        
    if not x_internal_key:
        logger.warning("ACESSO NEGADO: Tentativa de acesso sem chave interna.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Acesso negado: Chave interna ausente."
        )

    if x_internal_key != INTERNAL_API_KEY:
        logger.warning(f"ACESSO NEGADO: Tentativa de acesso com chave inválida. Header: {x_internal_key[:4]}...")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Acesso negado: Chave interna inválida."
        )
    
    return True


async def verify_jwt(request: Request) -> str:
    """
    Valida o token JWT enviado pelo app mobile via header Authorization.
    Retorna o user_id extraído do token — o backend NUNCA confia em user_id
    enviado no corpo da requisição.
    
    Usado em rotas públicas (acessíveis pelo app): /transactions, /balance, etc.
    """
    auth_header = request.headers.get("Authorization")
    
    if not auth_header or not auth_header.startswith("Bearer "):
        logger.warning("ACESSO NEGADO: Token JWT ausente ou malformado.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autenticação ausente ou inválido."
        )
    
    token = auth_header.replace("Bearer ", "")
    
    try:
        # Valida o token contra o Supabase Auth — retorna o usuário ou erro
        user_response = supabase.auth.get_user(token)
        
        if not user_response or not user_response.user:
            raise ValueError("Token inválido ou expirado")
        
        user_id = user_response.user.id
        logger.info(f"Usuário autenticado via JWT: {user_id[:8]}...")
        return str(user_id)
        
    except Exception as e:
        logger.warning(f"ACESSO NEGADO: Falha na validação JWT — {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado ou inválido. Faça login novamente."
        )

