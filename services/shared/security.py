import os
from fastapi import Header, HTTPException, status
from shared.logger import get_logger

logger = get_logger("shared-security")

# Carrega a chave interna do ambiente
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY")

async def verify_internal_key(x_internal_key: str = Header(None)):
    """
    Middleware de segurança para validar se a chamada vem de um componente interno
    confiável do MEIFlow. Implementa o princípio de Fail-Closed.
    """
    
    # Auditoria de Segurança: Se a chave do servidor não estiver configurada,
    # bloqueamos tudo para evitar o modo "aberto" acidental.
    if not INTERNAL_API_KEY:
        logger.critical("SEGURANÇA: INTERNAL_API_KEY não configurada no ambiente! Bloqueando acesso por padrão.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro de configuração de segurança no servidor."
        )
        
    # Validação da chave enviada no header
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
