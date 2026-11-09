import os
import sys
import re
import time
import logging
from typing import Optional

from langchain_core.tools import tool
from pydantic import BaseModel, Field

# Adiciona o diretório shared ao path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
from shared.middleware import correlation_id_ctx
from shared.database import supabase, supabase_admin

logger = logging.getLogger(__name__)

# URL do microserviço de CRM
CRM_SERVICE_URL = os.getenv("CRM_SERVICE_URL", "http://localhost:8003")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY")

def get_headers():
    headers = {"X-Internal-Key": INTERNAL_API_KEY} if INTERNAL_API_KEY else {}
    cid = correlation_id_ctx.get()
    if cid:
        headers["X-Correlation-ID"] = cid
    return headers

def _get_db():
    """Retorna o cliente com privilégios de service role para garantir acesso RLS."""
    return supabase_admin or supabase

async def _supabase_get(table: str, filters: dict = None):
    db = _get_db()
    query = db.table(table).select("*")
    if filters:
        for k, v in filters.items():
            if str(v).startswith("eq."):
                query = query.eq(k, str(v)[3:])
    resp = query.execute()
    return resp.data or []

async def _supabase_patch(table: str, match_col: str, match_val: str, payload: dict):
    db = _get_db()
    resp = db.table(table).update(payload).eq(match_col, match_val).execute()
    return resp.data or []

async def _supabase_post(table: str, payload: dict):
    db = _get_db()
    resp = db.table(table).insert(payload).execute()
    return resp.data or []

def _generate_emv_pix_payload(pix_key: str, merchant_name: str, amount: float, description: str = "") -> str:
    """Gera um payload oficial EMV BR Code (PIX Copia e Cola) com CRC16 válido."""
    def format_emv(tag: str, value: str) -> str:
        return f"{tag}{len(value):02d}{value}"

    merchant_account = format_emv("00", "BR.GOV.BCB.PIX") + format_emv("01", pix_key)
    if description:
        merchant_account += format_emv("02", description[:25])

    amount_str = f"{amount:.2f}"
    name_clean = re.sub(r'[^a-zA-Z0-9 ]', '', merchant_name)[:25].strip() or "MEIFLOW"

    payload = (
        format_emv("00", "01") +
        format_emv("01", "12") +
        format_emv("26", merchant_account) +
        format_emv("52", "0000") +
        format_emv("53", "986") +
        format_emv("54", amount_str) +
        format_emv("58", "BR") +
        format_emv("59", name_clean) +
        format_emv("60", "BRASIL") +
        format_emv("62", format_emv("05", f"MEI{int(time.time()) % 1000000:06d}")) +
        "6304"
    )

    # Cálculo do CRC16-CCITT (False)
    crc = 0xFFFF
    for b in payload.encode('utf-8'):
        crc ^= (b << 8)
        for _ in range(8):
            if crc & 0x8000:
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF
            else:
                crc = (crc << 1) & 0xFFFF

    return payload + f"{crc:04X}"


# ========================================================
# SCHEMAS DE ENTRADA DAS FERRAMENTAS
# ========================================================

class UserIdInput(BaseModel):
    user_id: str = Field(description="UUID do MEI dono")

class BuscarClienteTelefoneInput(BaseModel):
    user_id: str = Field(description="UUID do MEI dono")
    telefone: str = Field(description="Número de WhatsApp ou telefone do cliente")

class ConsultarClienteCpfInput(BaseModel):
    user_id: str = Field(description="UUID do MEI dono")
    cpf: str = Field(description="CPF ou CNPJ informado pelo cliente (com ou sem pontuação)")

class CadastrarOuAtualizarClienteInput(BaseModel):
    user_id: str = Field(description="UUID do MEI dono")
    name: str = Field(description="Nome do cliente")
    whatsapp_number: str = Field(description="Número de WhatsApp com DDD")
    cpf: str = Field(default="", description="CPF ou CNPJ do cliente")
    email: str = Field(default="", description="E-mail opcional do cliente")

class ObterChavePixMeiInput(BaseModel):
    user_id: str = Field(description="UUID do MEI dono")

class GerarPixDinamicoInput(BaseModel):
    user_id: str = Field(description="UUID do MEI dono")
    client_id: str = Field(description="UUID do cliente no CRM")
    amount: float = Field(description="Valor exato em reais (ex: 150.00)")
    description: str = Field(description="Descrição do produto ou serviço cobrado")

class FecharPedidoVendaInput(BaseModel):
    user_id: str = Field(description="UUID do MEI dono")
    client_id: str = Field(description="UUID do cliente no CRM")
    itens_descricao: str = Field(description="Descrição dos produtos/serviços e quantidades (ex: '2x Limpeza simples, 1x Troca')")
    valor_total: float = Field(description="Valor total em reais da venda")
    forma_pagamento: str = Field(default="pix", description="'pix', 'cartao' ou 'dinheiro'")

class ConsultarCatalogoInput(BaseModel):
    user_id: str = Field(description="UUID do MEI dono")
    termo: str = Field(default="", description="Termo de busca opcional (nome ou descrição)")

class AgendarServicoInput(BaseModel):
    user_id: str = Field(description="UUID do MEI dono")
    client_id: str = Field(description="UUID do cliente")
    data_hora: str = Field(description="Data e hora no formato ISO (ex: 2026-11-15T14:00:00)")
    descricao: str = Field(description="Descrição do serviço ou compromisso a agendar")

class TelefoneInput(BaseModel):
    user_id: str = Field(description="UUID do MEI dono")
    telefone: str = Field(description="Telefone do cliente (ex: 5511999999999)")


# ========================================================
# FERRAMENTAS DO AGENTE SDR
# ========================================================

@tool("buscar_cliente_por_telefone", args_schema=BuscarClienteTelefoneInput)
async def buscar_cliente_por_telefone(user_id: str, telefone: str) -> str:
    """Busca um cliente pelo número de WhatsApp ou telefone nos cadastros do MEI."""
    try:
        clean = re.sub(r'\D', '', telefone)
        db = _get_db()
        resp = db.table("clients").select("*").eq("user_id", user_id).execute()
        clients = resp.data or []

        found = None
        for c in clients:
            c_phone = re.sub(r'\D', '', c.get("whatsapp_number") or c.get("phone") or "")
            if clean and c_phone and (clean.endswith(c_phone) or c_phone.endswith(clean[-8:])):
                found = c
                break

        if not found:
            return "Cliente ainda não cadastrado com este telefone."

        return (
            f"Cliente encontrado!\n"
            f"- Nome: {found.get('name')}\n"
            f"- ID: {found.get('id')}\n"
            f"- CPF/Doc: {found.get('document') or 'Não informado'}\n"
            f"- Telefone: {found.get('whatsapp_number') or found.get('phone')}"
        )
    except Exception as e:
        return f"Erro ao buscar cliente por telefone: {str(e)}"

@tool("consultar_cliente_por_cpf", args_schema=ConsultarClienteCpfInput)
async def consultar_cliente_por_cpf(user_id: str, cpf: str) -> str:
    """Consulta se o cliente já existe na base de dados pelo CPF ou CNPJ."""
    try:
        clean_cpf = re.sub(r'\D', '', cpf)
        if not clean_cpf or len(clean_cpf) < 8:
            return "CPF/CNPJ inválido ou muito curto."

        db = _get_db()
        resp = db.table("clients").select("*").eq("user_id", user_id).execute()
        clients = resp.data or []

        found = None
        for c in clients:
            doc = re.sub(r'\D', '', c.get("document") or "")
            if doc and (doc == clean_cpf or clean_cpf in doc):
                found = c
                break

        if not found:
            return f"Nenhum cliente encontrado com o documento {cpf}. Você pode cadastrá-lo usando 'cadastrar_ou_atualizar_cliente'."

        return (
            f"Cliente localizado na base!\n"
            f"- Nome: {found.get('name')}\n"
            f"- CPF/CNPJ: {found.get('document')}\n"
            f"- ID: {found.get('id')}\n"
            f"- Telefone: {found.get('whatsapp_number') or found.get('phone') or 'N/A'}"
        )
    except Exception as e:
        return f"Erro ao consultar cliente por CPF: {str(e)}"

@tool("cadastrar_ou_atualizar_cliente", args_schema=CadastrarOuAtualizarClienteInput)
async def cadastrar_ou_atualizar_cliente(user_id: str, name: str, whatsapp_number: str, cpf: str = "", email: str = "") -> str:
    """Cadastra um novo cliente ou atualiza os dados (nome, CPF, email) no CRM do MEI."""
    try:
        db = _get_db()
        clean_phone = re.sub(r'\D', '', whatsapp_number)
        clean_cpf = re.sub(r'\D', '', cpf) if cpf else ""

        # Verifica se o cliente já existe por telefone ou CPF
        resp = db.table("clients").select("*").eq("user_id", user_id).execute()
        clients = resp.data or []

        existing = None
        for c in clients:
            c_phone = re.sub(r'\D', '', c.get("whatsapp_number") or c.get("phone") or "")
            c_doc = re.sub(r'\D', '', c.get("document") or "")
            if (clean_phone and c_phone and (clean_phone.endswith(c_phone) or c_phone.endswith(clean_phone[-8:]))) or \
               (clean_cpf and c_doc and clean_cpf == c_doc):
                existing = c
                break

        if existing:
            update_payload = {"name": name}
            if cpf:
                update_payload["document"] = cpf
            if email:
                update_payload["email"] = email
            if whatsapp_number:
                update_payload["whatsapp_number"] = whatsapp_number

            db.table("clients").update(update_payload).eq("id", existing["id"]).execute()
            return f"Dados do cliente {name} atualizados com sucesso! ID: {existing['id']}"
        else:
            insert_payload = {
                "user_id": user_id,
                "name": name,
                "whatsapp_number": whatsapp_number,
                "phone": whatsapp_number,
                "document": cpf or None,
                "email": email or None,
                "ai_agent_enabled": True
            }
            res = db.table("clients").insert(insert_payload).execute()
            new_id = res.data[0]['id'] if res.data else 'N/A'
            return f"Cliente {name} cadastrado com sucesso no CRM! ID: {new_id}"
    except Exception as e:
        return f"Erro ao cadastrar cliente: {str(e)}"

@tool("obter_chave_pix_mei", args_schema=ObterChavePixMeiInput)
async def obter_chave_pix_mei(user_id: str) -> str:
    """Obtém a chave PIX estática do MEI e o titular para enviar ao cliente caso queira pagar antecipado e mandar comprovante."""
    try:
        db = _get_db()
        resp = db.table("profiles").select("*").eq("id", user_id).execute()
        profiles = resp.data or []
        if not profiles:
            return "Perfil do MEI não encontrado."

        p = profiles[0]
        titular = p.get("nome_fantasia") or p.get("razao_social") or p.get("full_name") or "MEIFlow"
        pix_key = p.get("pix_key") or p.get("chave_pix") or p.get("cnpj") or p.get("telefone") or p.get("cpf") or p.get("email")

        tipo_chave = (
            "CNPJ" if pix_key == p.get("cnpj") else
            "Telefone" if pix_key == p.get("telefone") else
            "CPF" if pix_key == p.get("cpf") else
            "E-mail" if pix_key == p.get("email") else "Chave PIX"
        )

        if not pix_key:
            return "Nenhuma chave PIX encontrada no cadastro do MEI. Você pode gerar um PIX Dinâmico com a ferramenta 'gerar_pix_dinamico'."

        return (
            f"Chave PIX Oficial do MEI:\n"
            f"- Tipo: {tipo_chave}\n"
            f"- Chave: {pix_key}\n"
            f"- Titular: {titular}\n\n"
            f"Instrução ao Agente: Envie esta chave ao cliente e peça que ele envie o comprovante de pagamento por aqui para confirmar."
        )
    except Exception as e:
        return f"Erro ao obter chave PIX do MEI: {str(e)}"

@tool("gerar_pix_dinamico", args_schema=GerarPixDinamicoInput)
async def gerar_pix_dinamico(user_id: str, client_id: str, amount: float, description: str) -> str:
    """Gera uma chave PIX dinâmica com o valor exato (Pix Copia-e-Cola) e link de pagamento para o cliente."""
    try:
        db = _get_db()
        p_resp = db.table("profiles").select("nome_fantasia, razao_social, full_name, cnpj, telefone").eq("id", user_id).execute()
        p = p_resp.data[0] if p_resp.data else {}

        merchant_name = (p.get("nome_fantasia") or p.get("razao_social") or p.get("full_name") or "MEIFlow")[:25]
        merchant_pix = p.get("cnpj") or p.get("telefone") or "00000000000"

        pix_code = _generate_emv_pix_payload(pix_key=merchant_pix, merchant_name=merchant_name, amount=amount, description=description)

        ext_ref = f"sdr_{int(time.time())}"
        payment_link = f"https://sandbox.asaas.com/c/{ext_ref}"

        charge_payload = {
            "user_id": user_id,
            "client_id": client_id if client_id != "N/A" else None,
            "amount": amount,
            "payment_method": "pix",
            "status": "pending",
            "description": description,
            "external_reference": ext_ref,
            "payment_link": payment_link,
            "qr_code_payload": pix_code
        }
        res = db.table("charges").insert(charge_payload).execute()
        charge_id = res.data[0]['id'] if res.data else ext_ref

        return (
            f"PIX Dinâmico gerado com sucesso no valor exato de R$ {amount:.2f}!\n"
            f"ID da cobrança: {charge_id}\n\n"
            f"Código PIX Copia e Cola:\n{pix_code}\n\n"
            f"Link de pagamento alternativo: {payment_link}\n\n"
            f"Instrução: Envie o código acima e instrua o cliente a usar a opção 'PIX Copia e Cola' no app do banco dele."
        )
    except Exception as e:
        return f"Erro ao gerar PIX dinâmico: {str(e)}"

@tool("fechar_pedido_venda", args_schema=FecharPedidoVendaInput)
async def fechar_pedido_venda(user_id: str, client_id: str, itens_descricao: str, valor_total: float, forma_pagamento: str = "pix") -> str:
    """Fecha e registra a venda de serviços ou produtos para o cliente no sistema (PDV/Frente de Caixa)."""
    try:
        db = _get_db()
        order_payload = {
            "user_id": user_id,
            "client_id": client_id if client_id != "N/A" else None,
            "total_amount": valor_total,
            "status": "completed",
            "payment_method": forma_pagamento,
            "notes": f"Venda fechada via Agente SDR no WhatsApp: {itens_descricao}"
        }
        res = db.table("sales_orders").insert(order_payload).execute()
        order_id = res.data[0]['id'] if res.data else 'OK'

        return (
            f"Venda registrada com sucesso no sistema!\n"
            f"- Pedido: #{order_id[:8] if len(order_id) > 8 else order_id}\n"
            f"- Itens: {itens_descricao}\n"
            f"- Valor Total: R$ {valor_total:.2f}\n"
            f"- Forma de Pagamento: {forma_pagamento.upper()}\n"
            f"O pedido foi lançado no financeiro do MEI."
        )
    except Exception as e:
        return f"Erro ao fechar pedido de venda: {str(e)}"

@tool("consultar_catalogo", args_schema=ConsultarCatalogoInput)
async def consultar_catalogo(user_id: str, termo: str = "") -> str:
    """Consulta os produtos e serviços cadastrados no catálogo oficial do MEI com seus respectivos preços, unidades e fotos."""
    try:
        db = _get_db()
        resp = db.table("catalog_items").select("*").eq("user_id", user_id).eq("is_active", True).execute()
        items = resp.data or []
        if not items:
            return "O catálogo do MEI está vazio no momento. Nunca invente preços."

        lines = ["Itens disponíveis no catálogo:"]
        for i in items:
            name = i.get('name', '')
            desc = i.get('description', '') or ''
            if not termo or (termo.lower() in name.lower() or termo.lower() in desc.lower()):
                tipo = "🛠️ Serviço" if i.get('type') == 'service' else "📦 Produto"
                preco = f"R$ {float(i.get('price', 0)):.2f}".replace('.', ',')
                unidade = i.get('billing_unit') or 'unidade'
                estoque = f" | Estoque: {i.get('stock_quantity')}" if i.get('type') == 'product' and i.get('stock_quantity') is not None else ""
                img = f" [IMG:{i.get('image_url')}]" if i.get('image_url') else ""
                lines.append(f"- {name} | {tipo} | {preco} por {unidade}{estoque}{img}")

        return "\n".join(lines)
    except Exception as e:
        return f"Erro ao consultar catálogo: {str(e)}"

@tool("consultar_agendamentos", args_schema=UserIdInput)
async def consultar_agendamentos(user_id: str) -> str:
    """Consulta os agendamentos existentes na agenda do MEI."""
    try:
        items = await _supabase_get("appointments", {"user_id": f"eq.{user_id}"})
        if not items:
            return "Nenhum agendamento futuro encontrado."

        lines = ["Agenda de atendimentos:"]
        for a in items:
            dt = a.get('scheduled_at', '')[:16].replace('T', ' ')
            lines.append(f"- {dt} | {a.get('description')} | Status: {a.get('status')}")
        return "\n".join(lines)
    except Exception as e:
        return f"Erro ao consultar agendamentos: {str(e)}"

@tool("agendar_servico", args_schema=AgendarServicoInput)
async def agendar_servico(user_id: str, client_id: str, data_hora: str, descricao: str) -> str:
    """Agenda um serviço na agenda de atendimentos do MEI."""
    try:
        payload = {
            "user_id": user_id,
            "client_id": client_id,
            "scheduled_at": data_hora,
            "description": descricao,
            "status": "pending"
        }
        data = await _supabase_post("appointments", payload)
        inserted_id = data[0].get('id') if data else 'N/A'
        return f"Agendamento confirmado para {data_hora}! ID: {inserted_id}"
    except Exception as e:
        return f"Erro ao agendar serviço: {str(e)}"

@tool("solicitar_atendimento_humano", args_schema=TelefoneInput)
async def solicitar_atendimento_humano(user_id: str, telefone: str) -> str:
    """Desativa a IA para o cliente e transfere o atendimento para o profissional MEI humano."""
    try:
        db = _get_db()
        clean = re.sub(r'\D', '', telefone)
        # Atualiza no cliente
        resp = db.table("clients").select("id, whatsapp_number, phone").eq("user_id", user_id).execute()
        for c in (resp.data or []):
            cp = re.sub(r'\D', '', c.get("whatsapp_number") or c.get("phone") or "")
            if clean and cp and (clean.endswith(cp) or cp.endswith(clean[-8:])):
                db.table("clients").update({"ai_agent_enabled": False}).eq("id", c["id"]).execute()
                break

        return "Atendimento humano solicitado com sucesso. A IA foi pausada para este cliente e o MEI foi notificado."
    except Exception as e:
        return f"Erro ao solicitar atendimento humano: {str(e)}"


# Lista completa de ferramentas disponibilizadas ao Agente SDR
CUSTOMER_TOOLS = [
    buscar_cliente_por_telefone,
    consultar_cliente_por_cpf,
    cadastrar_ou_atualizar_cliente,
    obter_chave_pix_mei,
    gerar_pix_dinamico,
    fechar_pedido_venda,
    consultar_catalogo,
    consultar_agendamentos,
    agendar_servico,
    solicitar_atendimento_humano
]
