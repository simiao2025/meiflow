import os
import sys

from langchain_core.tools import tool
from pydantic import BaseModel, Field

# Adiciona o diretório shared ao path
sys.path.append(os.path.abspath(os.path.join(os.path.join(os.path.dirname(__file__), '../../'))))
from shared.middleware import correlation_id_ctx

# URL do microserviço fiscal
FISCAL_SERVICE_URL = os.getenv("FISCAL_SERVICE_URL", "http://localhost:8002")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY")

from shared.database import supabase


def get_headers():
    headers = {"X-Internal-Key": INTERNAL_API_KEY} if INTERNAL_API_KEY else {}
    cid = correlation_id_ctx.get()
    if cid:
        headers["X-Correlation-ID"] = cid
    return headers

class UserIdInput(BaseModel):
    user_id: str = Field(description="UUID do MEI")

@tool("consultar_das", args_schema=UserIdInput)
async def consultar_das(user_id: str) -> str:
    """Consulta as guias DAS do MEI via Fiscal Service."""
    try:
        resp = supabase.table("das_records").select("*").eq("user_id", user_id).execute()
        records = resp.data

        if not records:
            return "Nenhuma guia DAS encontrada."

        lines = ["Guias DAS (via Fiscal Service):"]
        for r in records:
            emoji = {"pago": "✅", "pendente": "⏳", "vencido": "🔴"}.get(r.get('status', ''), "❓")
            lines.append(
                f"{emoji} {r.get('reference_month', '-')} | R$ {float(r.get('amount', 0)):.2f} | Venc: {r.get('due_date', '-')} | {r.get('status', '-')}"
            )
        return "\n".join(lines)
    except Exception as e:
        return f"Erro ao consultar DAS no Fiscal Service: {str(e)}"

@tool("consultar_notas_fiscais", args_schema=UserIdInput)
async def consultar_notas_fiscais(user_id: str) -> str:
    """Consulta as notas fiscais via Fiscal Service."""
    try:
        resp = supabase.table("invoices").select("*").eq("user_id", user_id).execute()
        items = resp.data

        if not items:
            return "Nenhuma nota fiscal encontrada."

        lines = ["Notas Fiscais (via Fiscal Service):"]
        for i in items:
            direcao = "📤 Emitida" if i.get('direction') == 'outbound' else "📥 Recebida"
            lines.append(
                f"{direcao} | {i.get('type', '-').upper()} | R$ {float(i.get('total_amount', 0)):.2f} | {i.get('issue_date', '-')[:10]}"
            )
        return "\n".join(lines)
    except Exception as e:
        return f"Erro ao consultar notas no Fiscal Service: {str(e)}"

FISCAL_TOOLS = [consultar_das, consultar_notas_fiscais]
