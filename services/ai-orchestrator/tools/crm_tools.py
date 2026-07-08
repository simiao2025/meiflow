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

def _get_user_id_from_token(token: str) -> str | None:
    """
    Valida um JWT token contra o Supabase Auth e retorna o user_id.
    Usada pelos endpoints que exigem autenticação.
    """
    try:
        resp = supabase.auth.get_user(token)
        if resp and resp.user:
            return resp.user.id
    except Exception as e:
        logger = __import__("logging").getLogger(__name__)
        logger.warning(f"Erro ao validar token: {e}")
    return None

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
        items = await _supabase_get("clients", {"user_id": f"eq.{user_id}"})
        
        if not items:
            return "Nenhum cliente cadastrado."

        lines = [f"Clientes encontrados ({len(items)}):"]
        for c in items:
            lines.append(f"- {c['name']} | WhatsApp: {c.get('whatsapp_number', '-')}")
        return "\n".join(lines)
    except Exception as e:
        with open("error.log", "w") as f:
            f.write(repr(e))
        return f"Erro ao acessar CRM Service: {str(e)}"

@tool("cadastrar_cliente", args_schema=CadastrarClienteInput)
async def cadastrar_cliente(user_id: str, name: str, whatsapp_number: str) -> str:
    """Cadastra um novo cliente via CRM Service."""
    try:
        payload = {"user_id": user_id, "name": name, "whatsapp_number": whatsapp_number}
        data = await _supabase_post("clients", payload)
        inserted_id = data[0].get('id') if data else 'N/A'
        return f"Cliente {name} cadastrado com sucesso! ID: {inserted_id}"
    except Exception as e:
        return f"Erro ao cadastrar no CRM Service: {str(e)}"

@tool("consultar_agendamentos", args_schema=UserIdInput)
async def consultar_agendamentos(user_id: str) -> str:
    """Consulta os agendamentos via CRM Service."""
    try:
        items = await _supabase_get("appointments", {"user_id": f"eq.{user_id}"})

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
            "description": descricao,
            "status": "scheduled"
        }
        data = await _supabase_post("appointments", payload)
        inserted_id = data[0].get('id') if data else 'N/A'
        return f"Agendamento confirmado para {data_hora}. ID: {inserted_id}"
    except Exception as e:
        return f"Erro ao agendar no CRM Service: {str(e)}"

class TelefoneInput(BaseModel):
    telefone: str = Field(description="Telefone do cliente (ex: 5511999999999)")

class ConsultarCatalogoInput(BaseModel):
    user_id: str = Field(description="UUID do MEI dono")
    termo: str = Field(default="", description="Termo de busca opcional")

class GerarCobrancaInput(BaseModel):
    user_id: str = Field(description="UUID do MEI")
    client_id: str = Field(description="UUID do cliente")
    amount: float = Field(description="Valor da cobrança")
    method: str = Field(description="'pix' ou 'credit_card'")
    description: str = Field(description="Descrição da cobrança")

@tool("buscar_cliente_por_telefone", args_schema=TelefoneInput)
async def buscar_cliente_por_telefone(telefone: str) -> str:
    """Busca um cliente pelo número de telefone."""
    try:
        # Busca direta no banco de dados para evitar dependência excessiva do microserviço
        clients = await _supabase_get("clients", {"whatsapp_number": f"eq.{telefone}"})
        if not clients:
            return "Cliente não encontrado."
        c = clients[0]
        return f"Cliente Encontrado! Nome: {c.get('name')}, ID: {c.get('id')}"
    except Exception as e:
        return f"Erro ao buscar cliente: {str(e)}"

@tool("consultar_catalogo", args_schema=ConsultarCatalogoInput)
async def consultar_catalogo(user_id: str, termo: str = "") -> str:
    """Consulta os produtos e serviços cadastrados no catálogo do MEI com seus respectivos preços."""
    try:
        items = await _supabase_get("catalog", {"user_id": f"eq.{user_id}"})
        if not items:
            return "Catálogo vazio."
        
        lines = ["Itens no catálogo:"]
        for i in items:
            if termo.lower() in i.get('name', '').lower() or termo.lower() in i.get('description', '').lower() or not termo:
                lines.append(f"- {i['name']} | R$ {i['price']:.2f} | Tipo: {i['type']} | [IMG:{i.get('image_url') or ''}]")
        return "\n".join(lines)
    except Exception as e:
        return f"Erro ao consultar catálogo: {str(e)}"

@tool("gerar_cobranca", args_schema=GerarCobrancaInput)
async def gerar_cobranca(user_id: str, client_id: str, amount: float, method: str, description: str) -> str:
    """Gera uma cobrança e retorna o link de pagamento ou código PIX."""
    try:
        # Cria a cobrança no banco (aqui em dev seria gerada via gateway, mas simularemos)
        payload = {
            "user_id": user_id,
            "client_id": client_id,
            "amount": amount,
            "payment_method": method,
            "description": description,
            "status": "pending"
        }
        resp = await _supabase_post("charges", payload)
        charge_id = resp[0]['id'] if resp else 'N/A'
        
        # Link simulado para o MVP
        link = f"https://meiflow.app/pay/{charge_id}"
        return f"Cobrança de R$ {amount:.2f} gerada com sucesso! Link para pagamento: {link}"
    except Exception as e:
        return f"Erro ao gerar cobrança: {str(e)}"

@tool("solicitar_atendimento_humano", args_schema=TelefoneInput)
async def solicitar_atendimento_humano(telefone: str) -> str:
    """Desativa a IA para o cliente e transfere o atendimento para um humano."""
    try:
        await _supabase_patch("clients", "whatsapp_number", telefone, {"ai_agent_enabled": False})
        return "Atendimento humano solicitado. O bot foi pausado para este cliente."
    except Exception as e:
        return f"Erro ao solicitar atendimento humano: {str(e)}"

CUSTOMER_TOOLS = [
    listar_clientes,
    cadastrar_cliente,
    consultar_agendamentos,
    agendar_servico,
    buscar_cliente_por_telefone,
    consultar_catalogo,
    gerar_cobranca,
    solicitar_atendimento_humano
]
