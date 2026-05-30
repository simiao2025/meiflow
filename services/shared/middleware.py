import uuid
import contextvars
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

# ContextVar para armazenar o Correlation ID na thread/corrotina atual
correlation_id_ctx = contextvars.ContextVar("correlation_id", default=None)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware para injetar cabeçalhos de segurança padrão (Similar ao Helmet do Express).
    """
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        return response

class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """
    Middleware para garantir que toda requisição tenha um X-Correlation-ID.
    Isso permite rastrear uma transação através de múltiplos microserviços.
    """
    async def dispatch(self, request: Request, call_next):
        correlation_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
        token = correlation_id_ctx.set(correlation_id)
        request.state.correlation_id = correlation_id
        try:
            response = await call_next(request)
        finally:
            correlation_id_ctx.reset(token)
        response.headers["X-Correlation-ID"] = correlation_id
        return response
