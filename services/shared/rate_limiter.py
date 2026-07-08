"""
Rate Limiter Module — MEIFlow Shared

Implementa um rate limiter sliding window em memória para endpoints FastAPI.
Para produção, substituir por Redis (já disponível no projeto).

Estratégia: Sliding Window Log
- Mantém timestamps de cada requisição por chave (user_id ou IP)
- Limpa janelas expiradas a cada requisição (auto-cleanup)
- Thread-safe via threading.Lock
"""

import time
import logging
from collections import defaultdict
from threading import Lock
from typing import Dict, List, Tuple

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Rate limiter sliding window.
    
    Uso:
        limiter = RateLimiter(max_requests=100, window_seconds=60)
        
        @app.get("/api/endpoint")
        async def endpoint(user_id: str = Depends(get_current_user_id)):
            is_allowed, retry_after = limiter.check(user_id)
            if not is_allowed:
                raise HTTPException(status_code=429, detail=...)
    """

    def __init__(self, max_requests: int = 60, window_seconds: int = 60):
        """
        Args:
            max_requests: Número máximo de requisições permitidas na janela.
            window_seconds: Tamanho da janela em segundos.
        """
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: Dict[str, List[float]] = defaultdict(list)
        self._lock = Lock()

    def cleanup_expired(self, max_age_seconds: int = 3600) -> int:
        """
        Remove chaves que não tiveram requisições em max_age_seconds.
        Pode ser chamado periodicamente por um job scheduler.
        
        Returns: número de chaves removidas.
        """
        now = time.time()
        cutoff = now - max_age_seconds
        removed = 0
        
        with self._lock:
            expired_keys = [
                k for k, timestamps in self._requests.items()
                if not timestamps or timestamps[-1] < cutoff
            ]
            for k in expired_keys:
                del self._requests[k]
                removed += 1
        
        if removed:
            logger.debug(f"Rate limiter cleanup: removed {removed} expired keys")
        return removed

    def check(self, key: str) -> Tuple[bool, int]:
        """
        Verifica se a requisição pode passar.
        
        Args:
            key: Identificador único (user_id ou IP).
            
        Returns:
            Tuple[bool, int]: (allow, retry_after_seconds)
        """
        now = time.time()
        window_start = now - self.window_seconds

        with self._lock:
            # Pega a lista de timestamps para esta chave
            timestamps = self._requests.get(key, [])
            
            # Remove timestamps expirados (fora da janela)
            valid_timestamps = [t for t in timestamps if t > window_start]
            
            # Verifica se excedeu o limite
            if len(valid_timestamps) >= self.max_requests:
                # Calcula quando a janela será liberada
                oldest = valid_timestamps[0]
                retry_after = int(self.window_seconds - (now - oldest)) + 1
                # Atualiza a lista mesmo bloqueado (mantém timestamps recentes)
                self._requests[key] = valid_timestamps
                return False, retry_after
            
            # Registra a requisição atual
            valid_timestamps.append(now)
            self._requests[key] = valid_timestamps
            return True, 0

    def get_usage(self, key: str) -> Tuple[int, int]:
        """
        Retorna o uso atual do rate limit.
        
        Returns:
            Tuple[int, int]: (requests_in_window, max_requests)
        """
        now = time.time()
        window_start = now - self.window_seconds
        
        with self._lock:
            timestamps = self._requests.get(key, [])
            valid = [t for t in timestamps if t > window_start]
            self._requests[key] = valid
            return len(valid), self.max_requests

    def reset(self, key: str | None = None):
        """Reseta o rate limit para uma chave específica ou todas."""
        with self._lock:
            if key:
                self._requests.pop(key, None)
            else:
                self._requests.clear()


# Singleton compartilhado para a API pública
# Limites por endpoint:
#   - /api/finance/reconciliations: 30 req/min (custa LLM caro)
#   - /api/finance/reconciliations/approve: 60 req/min
#   - Demais endpoints: 120 req/min
public_api_limiter = RateLimiter(max_requests=120, window_seconds=60)
reconciliation_limiter = RateLimiter(max_requests=30, window_seconds=60)
approve_limiter = RateLimiter(max_requests=60, window_seconds=60)
llm_limiter = RateLimiter(max_requests=15, window_seconds=60)  # LLM calls são caras

# Limite mais restritivo para operações não autenticadas (por IP)
anonymous_limiter = RateLimiter(max_requests=20, window_seconds=60)
