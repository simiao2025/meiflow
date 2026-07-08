import os
import sys
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from dotenv import load_dotenv
from pydantic import BaseModel
import httpx
import os

# Adiciona o diretório shared ao path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
from shared.models import Client as ClientModel, Appointment
from shared.database import supabase, supabase_admin
import secrets
import string
from shared.security import verify_internal_key
from shared.middleware import SecurityHeadersMiddleware, CorrelationIdMiddleware
from shared.logger import get_logger

logger = get_logger("crm-service")

app = FastAPI(
    title="MEIFlow CRM Service",
    description="Serviço responsável pela gestão de clientes e agenda",
    version="1.1.0",
    dependencies=[Depends(verify_internal_key)]
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CorrelationIdMiddleware)

# CORS restrito — apenas origens confiáveis
# Em produção, substituir pelas URLs reais do frontend
ALLOWED_ORIGINS = [
    "http://localhost:8081",  # Expo dev
    "http://localhost:3000",  # Web dev alternativo
    "https://app.meiflow.com.br",  # Produção
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Internal-Key", "X-Correlation-ID"],
)

from shared.cache import redis_client

class EvolutionInstanceRequest(BaseModel):
    user_id: str
    cnpj: str

class EvolutionPairingRequest(BaseModel):
    user_id: str
    phone_number: str

class KiwifyWebhookRequest(BaseModel):
    email: str
    full_name: str
    cpf: str
    order_status: str = "paid"

@app.get("/health")
async def health_check():
    """Verifica a saúde do serviço e suas dependências."""
    health = {"status": "healthy", "service": "crm-service", "dependencies": {}}
    
    # Check Supabase
    try:
        supabase.table("clients").select("count", count="exact").limit(1).execute()
        health["dependencies"]["supabase"] = "ok"
    except Exception as e:
        logger.error(f"Falha na dependência Supabase (CRM): {e}")
        health["dependencies"]["supabase"] = "error"
        health["status"] = "unhealthy"

    # Check Redis
    try:
        await redis_client.ping()
        health["dependencies"]["redis"] = "ok"
    except Exception as e:
        logger.error(f"Falha na dependência Redis (CRM): {e}")
        health["dependencies"]["redis"] = "error"
        health["status"] = "unhealthy"
        
    return health

# --- Clients ---

@app.get("/clients/{user_id}", response_model=List[ClientModel])
async def list_clients(user_id: str):
    """Lista os clientes de um usuário específico."""
    try:
        response = supabase.table("clients").select("*").eq("user_id", user_id).order("name").execute()
        return response.data
    except Exception as e:
        logger.error(f"Erro ao listar clientes para {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Erro ao recuperar lista de clientes.")

@app.post("/clients")
async def create_client(client: ClientModel):
    """Cadastra um novo cliente."""
    try:
        data = client.dict(exclude_none=True)
        response = supabase.table("clients").insert(data).execute()
        return response.data[0]
    except Exception as e:
        logger.error(f"Erro ao cadastrar cliente: {e}")
        raise HTTPException(status_code=500, detail="Erro ao salvar dados do cliente.")

# --- Appointments ---

@app.get("/appointments/{user_id}")
async def list_appointments(user_id: str):
    """Lista a agenda de compromissos."""
    try:
        response = supabase.table("appointments").select("*").eq("user_id", user_id).order("scheduled_at").execute()
        return response.data
    except Exception as e:
        logger.error(f"Erro ao listar agenda para {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Erro ao recuperar agenda.")

@app.post("/appointments")
async def create_appointment(appointment: Appointment):
    """Agenda um novo compromisso."""
    try:
        data = appointment.dict(exclude_none=True)
        response = supabase.table("appointments").insert(data).execute()
        return response.data[0]
    except Exception as e:
        logger.error(f"Erro ao criar compromisso: {e}")
        raise HTTPException(status_code=500, detail="Erro ao salvar agendamento.")

# --- Evolution Go Integration ---

@app.post("/evolution/instance/create")
async def create_evolution_instance(req: EvolutionInstanceRequest):
    """
    Cria uma instância no Evolution Go atrelada ao CNPJ do usuário e salva o token no banco.
    """
    evo_url = os.environ.get("EVOLUTION_API_URL")
    evo_key = os.environ.get("EVOLUTION_API_KEY")

    if not evo_url or not evo_key:
        logger.error("Credenciais Evolution API não encontradas no ambiente.")
        raise HTTPException(status_code=500, detail="Serviço de mensageria temporariamente indisponível.")

    # Gera um nome limpo para a instância baseado no CNPJ (apenas números)
    cnpj_clean = "".join(filter(str.isdigit, req.cnpj))
    if not cnpj_clean:
        raise HTTPException(status_code=400, detail="CNPJ inválido.")
        
    instance_name = f"mei_{cnpj_clean}"
    
    evo_data = {}
    async with httpx.AsyncClient() as client:
        try:
            # Rota padrão da Evolution API v2 para criar instância
            response = await client.post(
                f"{evo_url}/instance/create",
                headers={"apikey": evo_key},
                json={
                    "instanceName": instance_name,
                    "name": instance_name,
                    "token": f"token_{instance_name}",
                    "qrcode": True
                },
                timeout=15.0
            )
            
            # Se retornar 400 ou 500, verificamos o corpo da mensagem
            if response.status_code in [400, 500]:
                try:
                    error_data = response.json()
                    logger.warning(f"Evolution API {response.status_code} Body: {error_data}")
                    error_msg = str(error_data).lower()
                    if "already exists" in error_msg or "already_exists" in error_msg:
                        logger.info(f"Instância {instance_name} já existe ou erro ignorável. Prosseguindo...")
                    else:
                        response.raise_for_status()
                except Exception:
                    # Se não for JSON ou erro inesperado na verificação
                    if response.status_code == 500:
                         logger.error(f"Erro 500 detectado na Evolution API. Pode ser instabilidade ou instância já existente.")
                         # Em caso de 500, vamos tentar prosseguir mesmo assim se a instância já estiver no painel
                         pass
                    else:
                         response.raise_for_status()
            else:
                response.raise_for_status()
                evo_data = response.json()
                
        except Exception as e:
            # Se for erro de status (que não seja o 'already exists' tratado acima)
            logger.error(f"Falha na comunicação com Evolution API: {e}")
            raise HTTPException(status_code=502, detail=f"Falha ao criar instância no provedor: {str(e)}")

    # Salva o token gerado diretamente no perfil do usuário
    try:
        supabase_admin.table("profiles").update({
            "evolution_token": f"token_{instance_name}",
            "evolution_instance": instance_name,
            "evolution_status": "disconnected"
        }).eq("id", req.user_id).execute()
    except Exception as e:
        logger.error(f"Erro ao persistir dados da Evolution no banco: {e}")
        # Retornamos sucesso mesmo se falhar no DB pois a instância foi criada
        
    return {
        "status": "success", 
        "instanceName": instance_name, 
        "evolution_response": evo_data
    }

@app.post("/evolution/instance/pairing-code")
async def get_pairing_code(req: EvolutionPairingRequest):
    """Gera um código de pareamento do WhatsApp para uma instância específica."""
    evo_url = os.environ.get("EVOLUTION_API_URL")
    evo_key = os.environ.get("EVOLUTION_API_KEY")

    if not evo_url or not evo_key:
        raise HTTPException(status_code=500, detail="Credenciais da Evolution não configuradas.")

    # Busca a instância e o token do usuário usando admin para evitar problemas de RLS
    try:
        profile_resp = supabase_admin.table("profiles").select("evolution_instance, evolution_token").eq("id", req.user_id).single().execute()
        profile_data = profile_resp.data
    except Exception as e:
        logger.warning(f"Usuário não encontrado ou erro ao buscar profile: {e}")
        profile_data = None

    if not profile_data or not profile_data.get("evolution_instance"):
        raise HTTPException(status_code=404, detail="Instância não encontrada para este usuário.")

    instance_name = profile_data["evolution_instance"]
    instance_token = profile_data.get("evolution_token") or f"token_{instance_name}"
    phone_clean = "".join(filter(str.isdigit, req.phone_number))

    async with httpx.AsyncClient() as client:
        try:
            # Evolution Go (Novo): Pairing Code é gerado via POST /instance/pair
            # Usamos o token da própria instância como apikey conforme padrão do provedor
            logger.info(f"Gerando Pairing Code para instância {instance_name} no Evolution Go...")
            
            response = await client.post(
                f"{evo_url}/instance/pair",
                headers={"apikey": instance_token},
                json={
                    "phone": phone_clean,
                    "subscribe": ["MESSAGES"]
                },
                timeout=15.0
            )
            
            if response.status_code != 200:
                logger.warning(f"Falha na rota principal /pair (Status {response.status_code}). Tentando fallback...")
                # Fallback: Se falhar com token da instância, tenta com a Global Key v2
                response = await client.post(
                    f"{evo_url}/instance/connect/{instance_name}",
                    headers={"apikey": evo_key},
                    json={"number": phone_clean},
                    timeout=15.0
                )

            response.raise_for_status()
            data = response.json()
            logger.info(f"Evolution API Response: {data}")
            
            # No Evolution Go o retorno é {"data": {"PairingCode": "..."}}
            # Na Evolution v2 é {"code": "..."} ou {"pairingCode": "..."}
            evo_res = data.get("data", {})
            code = evo_res.get("PairingCode") or data.get("code") or data.get("pairingCode")
            
            # Retentativa caso o Evolution Go demore para gerar o código (Assíncrono)
            import asyncio
            retries = 2
            while not code and retries > 0:
                logger.info(f"Código vazio, aguardando 1.5s para tentar novamente... ({retries} tentativas restantes)")
                await asyncio.sleep(1.5)
                response = await client.post(
                    f"{evo_url}/instance/pair",
                    headers={"apikey": instance_token},
                    json={"phone": phone_clean, "subscribe": ["MESSAGES"]},
                    timeout=15.0
                )
                if response.status_code == 200:
                    data = response.json()
                    evo_res = data.get("data", {})
                    code = evo_res.get("PairingCode") or data.get("code") or data.get("pairingCode")
                retries -= 1

            if not code:
                # Verificamos se já está conectado
                if data.get("instance", {}).get("state") == "open" or evo_res.get("connected") is True:
                    return {"status": "already_connected"}
                raise HTTPException(status_code=400, detail="O WhatsApp bloqueou a geração do código (limite de tentativas excedido) ou o número já está conectado a muitas instâncias. Aguarde alguns minutos, desconecte outros aparelhos e tente novamente.")
                
            return {"status": "success", "code": code}
            
        except Exception as e:
            logger.error(f"Erro crítico ao buscar Pairing Code: {e}")
            raise HTTPException(status_code=502, detail=f"Falha na comunicação com Evolution Go: {str(e)}")

@app.get("/evolution/instance/status/{user_id}")
async def get_instance_status(user_id: str):
    """Verifica o status de conexão da instância no Evolution Go."""
    evo_url = os.environ.get("EVOLUTION_API_URL")
    evo_key = os.environ.get("EVOLUTION_API_KEY")

    # Busca a instância do usuário usando admin para evitar problemas de RLS
    profile_resp = supabase_admin.table("profiles").select("evolution_instance").eq("id", user_id).single().execute()
    profile_data = profile_resp.data

    if not profile_data or not profile_data.get("evolution_instance"):
        return {"status": "not_created"}

    instance_name = profile_data["evolution_instance"]

    async with httpx.AsyncClient() as client:
        try:
            # A Evolution retorna o estado da conexão na rota de connectionState
            response = await client.get(
                f"{evo_url}/instance/connectionState/{instance_name}",
                headers={"apikey": evo_key},
                timeout=5.0
            )
            if response.status_code == 404:
                 return {"status": "not_created"}
                 
            response.raise_for_status()
            data = response.json()
            
            state = data.get("instance", {}).get("state") or data.get("state")
            
            # Atualiza o banco de dados caso esteja conectado
            if state == "open":
                supabase.table("profiles").update({"evolution_status": "connected"}).eq("id", user_id).execute()
                
            return {"status": state} # 'open', 'connecting', 'close', etc.
            
        except Exception as e:
            logger.warning(f"Erro ao verificar status da Evolution API: {e}")
            return {"status": "unknown"}

@app.delete("/evolution/instance/disconnect/{user_id}")
async def disconnect_instance(user_id: str):
    """Desconecta a instância do Evolution Go e reseta o status."""
    evo_url = os.environ.get("EVOLUTION_API_URL")
    evo_key = os.environ.get("EVOLUTION_API_KEY")

    profile_resp = supabase_admin.table("profiles").select("evolution_instance").eq("id", user_id).single().execute()
    profile_data = profile_resp.data

    if not profile_data or not profile_data.get("evolution_instance"):
        return {"status": "not_created"}

    instance_name = profile_data["evolution_instance"]

    async with httpx.AsyncClient() as client:
        try:
            # Logout no Evolution API v2/Go
            response = await client.delete(
                f"{evo_url}/instance/logout/{instance_name}",
                headers={"apikey": evo_key},
                timeout=10.0
            )
            # Ignora erros de 404 se a instância não estiver logada
            if response.status_code not in [200, 404, 500]:
                 response.raise_for_status()
                 
            # Atualiza no banco local
            supabase_admin.table("profiles").update({"evolution_status": "disconnected"}).eq("id", user_id).execute()
            
            return {"status": "success", "message": "WhatsApp desconectado."}
        except Exception as e:
            logger.error(f"Erro ao desconectar instância {instance_name}: {e}")
            raise HTTPException(status_code=502, detail=f"Erro ao desconectar no provedor: {str(e)}")

# --- Webhooks (Simulation) ---

@app.post("/webhooks/kiwify")
async def kiwify_webhook(req: KiwifyWebhookRequest):
    """
    Simula o recebimento de um webhook do Kiwify para criar o usuário e enviar a senha temporária.
    """
    if req.order_status != "paid":
        return {"status": "ignored", "reason": "order_not_paid"}

    # 1. Gera senha temporária
    alphabet = string.ascii_letters + string.digits
    temp_password = ''.join(secrets.choice(alphabet) for i in range(12))

    try:
        # 2. Cria o usuário no Supabase Auth usando o admin client
        # Passamos os metadados para que o trigger crie o profile corretamente
        user_response = supabase_admin.auth.admin.create_user({
            "email": req.email,
            "password": temp_password,
            "email_confirm": True,
            "user_metadata": {
                "full_name": req.full_name,
                "cpf": req.cpf,
                "must_change_password": True,
                "is_temporary_password": True
            }
        })

        if not user_response.user:
            raise Exception("Falha ao criar usuário no Supabase Auth")

        user_id = user_response.user.id

        # 3. Simula o envio de e-mail (aqui seria integração com SendGrid, Mailgun, etc.)
        # No MEIFlow, poderíamos usar um serviço de mensageria interno.
        login_url = "meiflow://auth/login" # Deep link para o app
        
        email_content = f"""
        Olá {req.full_name},
        
        Seu acesso ao MEIFlow foi liberado!
        
        E-mail: {req.email}
        Senha Temporária: {temp_password}
        
        Acesse o app e complete seu cadastro:
        {login_url}
        
        Por segurança, você deverá trocar sua senha no primeiro acesso.
        """
        
        # Log seguro: apenas confirma envio, sem expor senha
        logger.info(f"E-MAIL DE BOAS-VINDAS ENVIADO PARA {req.email[:3]}***@{'***'.join(req.email.split('@')[1:])}")

        env = os.getenv("ENV", "development")
        
        result = {
            "status": "success",
            "user_id": user_id,
            "email_sent": True,
            "message": "Usuário criado e e-mail de boas-vindas enviado."
        }
        
        # Apenas em dev/local expõe a senha temporária
        if env == "development":
            result["temporary_password"] = temp_password
        
        return result

    except Exception as e:
        logger.error(f"Erro no processamento do webhook Kiwify: {e}")
        err_msg = str(e).lower()
        if "already exists" in err_msg or "already registered" in err_msg:
             raise HTTPException(status_code=400, detail="Usuario ja cadastrado com este e-mail. Delete-o no Supabase para repetir a simulacao.")
        raise HTTPException(status_code=500, detail=f"Erro interno ao processar venda: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
