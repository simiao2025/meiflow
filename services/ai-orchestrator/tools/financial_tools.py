import os
import sys

from langchain_core.tools import tool
from pydantic import BaseModel, Field

# Adiciona o diretório shared ao path para importar os modelos
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
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

from shared.database import supabase


@tool("consultar_transacoes", args_schema=ConsultarTransacoesInput)
async def consultar_transacoes(user_id: str, tipo: str = "todos", limite: int = 20) -> str:
    """Consulta as transações financeiras do MEI via Banco de Dados."""
    try:
        query = supabase.table("transactions").select("*").eq("user_id", user_id)
        if tipo.lower() == "receita":
            query = query.eq("type", "receita")
        elif tipo.lower() == "despesa":
            query = query.eq("type", "despesa")

        resp = query.order("created_at", desc=True).limit(limite).execute()
        items = resp.data

        if not items:
            return "Nenhuma transação encontrada."

        lines = [f"Últimas {len(items)} transações:"]
        for t in items:
            sinal = "+" if t['amount'] > 0 and t['type'] == 'receita' else "-"
            lines.append(
                f"{sinal} R$ {abs(t['amount']):.2f} | {t.get('category', '-')} | {t.get('description', '-')[:40]}"
            )
        return "\n".join(lines)
    except Exception as e:
        return f"Erro ao consultar transações: {str(e)}"

@tool("resumo_financeiro", args_schema=UserIdInput)
async def resumo_financeiro(user_id: str) -> str:
    """Gera um resumo financeiro lendo do banco de dados diretamente."""
    try:
        # Puxa todas as transacoes do mes atual, simplificado para MVP
        resp = supabase.table("transactions").select("*").eq("user_id", user_id).execute()
        items = resp.data

        if not items:
            return "💰 Resumo Consolidado:\n📊 Saldo líquido atual: R$ 0.00"

        saldo = sum([t['amount'] if t['type'] == 'receita' else -t['amount'] for t in items])
        receitas = sum([t['amount'] for t in items if t['type'] == 'receita'])
        despesas = sum([t['amount'] for t in items if t['type'] == 'despesa'])

        return (
            f"💰 Resumo Consolidado:\n"
            f"📈 Total Receitas: R$ {receitas:.2f}\n"
            f"📉 Total Despesas: R$ {despesas:.2f}\n"
            f"📊 Saldo líquido atual: R$ {saldo:.2f}"
        )
    except Exception as e:
        return f"Erro ao gerar resumo financeiro: {str(e)}"

FINANCIAL_TOOLS = [consultar_transacoes, resumo_financeiro]
