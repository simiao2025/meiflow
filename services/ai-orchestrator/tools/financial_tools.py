from langchain_core.tools import tool
from pydantic import BaseModel, Field
import sys
import os
import httpx

# Adiciona o diretório shared ao path para importar os modelos
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
from shared.cache import get_cached, set_cache
from shared.middleware import correlation_id_ctx

# URL do microserviço financeiro (pode ser configurado via env)
FINANCIAL_SERVICE_URL = os.getenv("FINANCIAL_SERVICE_URL", "http://localhost:8001")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY")

def get_headers():
    headers = {"X-Internal-Key": INTERNAL_API_KEY} if INTERNAL_API_KEY else {}
    cid = correlation_id_ctx.get()
    if cid:
        headers["X-Correlation-ID"] = cid
    return headers

class UserIdInput(BaseModel):
    user_id: str = Field(description="UUID do MEI (recuperado do contexto)")

class ConsultarTransacoesInput(BaseModel):
    user_id: str = Field(description="UUID do MEI")
    tipo: str = Field(default="todos", description="Filtro: 'receita', 'despesa' ou 'todos'")
    limite: int = Field(default=20, description="Número máximo de registros a retornar")

@tool("consultar_transacoes", args_schema=ConsultarTransacoesInput)
async def consultar_transacoes(user_id: str, tipo: str = "todos", limite: int = 20) -> str:
    """Consulta as transações financeiras do MEI via Financial Service."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{FINANCIAL_SERVICE_URL}/transactions/{user_id}", headers=get_headers())
            resp.raise_for_status()
            items = resp.json()

        if not items:
            return "Nenhuma transação encontrada."

        lines = [f"Últimas {len(items)} transações (via Financial Service):"]
        for t in items[:limite]:
            sinal = "+" if t['amount'] > 0 else "-"
            lines.append(
                f"{sinal} R$ {abs(t['amount']):.2f} | {t.get('category', '-')} | {t.get('description', '-')[:40]}"
            )
        return "\n".join(lines)
    except Exception as e:
        return f"Erro ao consultar transações no Financial Service: {str(e)}"

@tool("resumo_financeiro", args_schema=UserIdInput)
async def resumo_financeiro(user_id: str) -> str:
    """Gera um resumo financeiro rápido chamando o Financial Service com cache."""
    cache_key = f"fin_summary_{user_id}"
    try:
        # Tenta pegar do cache primeiro
        cached_data = await get_cached(cache_key)
        if cached_data:
            return f"💰 Resumo Consolidado (do Cache):\n📊 Saldo líquido: R$ {cached_data['balance']:.2f}"

        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{FINANCIAL_SERVICE_URL}/balance/{user_id}", headers=get_headers())
            resp.raise_for_status()
            data = resp.json()
            
        # Salva no cache por 2 minutos
        await set_cache(cache_key, data, expire=120)
        
        balance = data.get('balance', 0)
        return (
            f"💰 Resumo Consolidado (via Financial Service):\n"
            f"📊 Saldo líquido atual: R$ {balance:.2f}"
        )
    except Exception as e:
        return f"Erro ao gerar resumo no Financial Service: {str(e)}"

FINANCIAL_TOOLS = [consultar_transacoes, resumo_financeiro]
