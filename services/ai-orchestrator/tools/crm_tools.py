import httpx
import os
import sys
from langchain_core.tools import tool
from pydantic import BaseModel, Field

# Adiciona o diretório shared ao path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
from shared.middleware import correlation_id_ctx

# URL do microserviço de CRM
CRM_SERVICE_URL = os.getenv("CRM_SERVICE_URL", "http://localhost:8003")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY")

def get_headers():
    headers = {"X-Internal-Key": INTERNAL_API_KEY} if INTERNAL_API_KEY else {}
    cid = correlation_id_ctx.get()
    if cid:
        headers["X-Correlation-ID"] = cid
    return headers

from shared.database import supabase

async def _supabase_get(table: str, filters: dict = None):
    query = supabase.table(table).select("*")
    if filters:
        for k, v in filters.items():
            if str(v).startswith("eq."):
                query = query.eq(k, str(v)[3:])
    resp = query.execute()
    return resp.data

async def _supabase_patch(table: str, match_col: str, match_val: str, payload: dict):
    resp = supabase.table(table).update(payload).eq(match_col, match_val).execute()
    return resp.data

async def _supabase_post(table: str, payload: dict):
    resp = supabase.table(table).insert(payload).execute()
    return resp.data

# --- Schemas ---

class UserIdInput(BaseModel):
    user_id: str = Field(description="UUID do MEI")

class CadastrarClienteInput(BaseModel):
    user_id: str = Field(description="UUID do MEI dono")
    name: str = Field(description="Nome do cliente")
    whatsapp_number: str = Field(description="Número de WhatsApp")

class AgendarServicoInput(BaseModel):
    user_id: str = Field(description="UUID do MEI")
    client_id: str = Field(description="UUID do cliente")
    data_hora: str = Field(description="Data/Hora ISO")
    descricao: str = Field(description="Descrição do serviço")

# --- Tools ---

@tool("listar_clientes", args_schema=UserIdInput)
async def listar_clientes(user_id: str) -> str:
    """Lista todos os clientes cadastrados via CRM Service."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{CRM_SERVICE_URL}/clients/{user_id}", headers=get_headers())
            resp.raise_for_status()
            items = resp.json()

        if not items:
            return "Nenhum cliente cadastrado."

        lines = [f"Clientes encontrados ({len(items)}):"]
        for c in items:
            lines.append(f"- {c['name']} | WhatsApp: {c.get('whatsapp_number', '-')}")
        return "\n".join(lines)
    except Exception as e:
        return f"Erro ao acessar CRM Service: {str(e)}"

@tool("cadastrar_cliente", args_schema=CadastrarClienteInput)
async def cadastrar_cliente(user_id: str, name: str, whatsapp_number: str) -> str:
    """Cadastra um novo cliente via CRM Service."""
    try:
        payload = {"user_id": user_id, "name": name, "whatsapp_number": whatsapp_number}
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{CRM_SERVICE_URL}/clients", json=payload, headers=get_headers())
            resp.raise_for_status()
            data = resp.json()
        return f"Cliente {name} cadastrado com sucesso! ID: {data.get('id')}"
    except Exception as e:
        return f"Erro ao cadastrar no CRM Service: {str(e)}"

@tool("consultar_agendamentos", args_schema=UserIdInput)
async def consultar_agendamentos(user_id: str) -> str:
    """Consulta os agendamentos via CRM Service."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{CRM_SERVICE_URL}/appointments/{user_id}", headers=get_headers())
            resp.raise_for_status()
            items = resp.json()

        if not items:
            return "Nenhum agendamento encontrado."

        lines = ["Agenda do MEI (via CRM Service):"]
        for a in items:
            lines.append(f"- {a['scheduled_at'][:16]} | {a['description']} | Status: {a['status']}")
        return "\n".join(lines)
    except Exception as e:
        return f"Erro ao consultar agenda no CRM Service: {str(e)}"

@tool("agendar_servico", args_schema=AgendarServicoInput)
async def agendar_servico(user_id: str, client_id: str, data_hora: str, descricao: str) -> str:
    """Agenda um serviço via CRM Service."""
    try:
        payload = {
            "user_id": user_id,
            "client_id": client_id,
            "scheduled_at": data_hora,
            "description": descricao
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{CRM_SERVICE_URL}/appointments", json=payload, headers=get_headers())
            resp.raise_for_status()
            data = resp.json()
        return f"Agendamento confirmado para {data_hora}. ID: {data.get('id')}"
    except Exception as e:
        return f"Erro ao agendar no CRM Service: {str(e)}"

CUSTOMER_TOOLS = [
    listar_clientes,
    cadastrar_cliente,
    consultar_agendamentos,
    agendar_servico
]
