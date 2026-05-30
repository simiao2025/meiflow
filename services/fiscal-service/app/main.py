import os
import sys
import uuid
import asyncio
from datetime import datetime
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv

# Adiciona o diretório shared ao path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
from shared.models import UserProfile
from shared.database import supabase
from shared.security import verify_internal_key
from shared.middleware import SecurityHeadersMiddleware, CorrelationIdMiddleware
from shared.logger import get_logger

logger = get_logger("fiscal-service")

app = FastAPI(
    title="MEIFlow Fiscal Service",
    description="Serviço responsável pela emissão de notas e gestão tributária (DAS)",
    version="1.1.0",
    dependencies=[Depends(verify_internal_key)]
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CorrelationIdMiddleware)

# Suporte a CORS para o navegador
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from shared.cache import redis_client

@app.get("/health")
async def health_check():
    """Verifica a saúde do serviço e conexão com o banco."""
    health = {"status": "healthy", "service": "fiscal-service", "dependencies": {}}
    try:
        # Verifica a tabela principal de notas fiscais no schema public
        supabase.table("nfse").select("count", count="exact").limit(1).execute()
        health["dependencies"]["supabase"] = "ok"
    except Exception as e:
        logger.error(f"Erro de conexão Supabase: {e}")
        health["dependencies"]["supabase"] = "error"
        health["status"] = "unhealthy"

    try:
        await redis_client.ping()
        health["dependencies"]["redis"] = "ok"
    except Exception as e:
        logger.error(f"Erro de conexão Redis: {e}")
        health["dependencies"]["redis"] = "error"
        health["status"] = "unhealthy"
        
    return health

@app.get("/das/{user_id}")
async def get_das_status(user_id: str):
    """Retorna o histórico de guias DAS (mensal) do usuário."""
    try:
        # Nota: Usamos 'das_records' para mensal e 'annual_declarations' para o DASN-SIMEI anual
        response = supabase.table("das_records").select("*").eq("user_id", user_id).order("due_date", desc=True).limit(12).execute()
        return response.data
    except Exception as e:
        logger.error(f"Erro ao buscar DAS para {user_id}: {e}")
        # Se a tabela das_records não existir, retornamos lista vazia em vez de erro 500
        return []

@app.get("/invoices/{user_id}")
async def get_invoices(user_id: str):
    """Retorna a lista de Notas Fiscais emitidas."""
    try:
        response = supabase.table("nfse").select("*").eq("user_id", user_id).order("issue_date", desc=True).limit(15).execute()
        return response.data
    except Exception as e:
        logger.error(f"Erro ao buscar notas fiscais para {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Erro ao recuperar histórico de notas.")

@app.post("/invoices")
async def create_invoice(invoice: dict):
    """Simula a emissão de uma NFS-e e registra no banco."""
    try:
        user_id = invoice.get("user_id")
        if not user_id:
            raise HTTPException(status_code=400, detail="ID do usuário é obrigatório.")

        logger.info(f"Iniciando emissão de nota para usuário {user_id}")
        await asyncio.sleep(1.0) # Simulação de latência da prefeitura

        # Chave de acesso fake de 44 dígitos
        fake_key = "".join([str(uuid.uuid4().int)[i % 10] for i in range(44)])
        
        db_payload = {
            "user_id": user_id,
            "direction": "outbound",
            "type": invoice.get("type", "nfse"),
            "receiver_name": invoice.get("receiver_name", "Consumidor Final"),
            "total_amount": invoice.get("amount", 0),
            "status": "autorizada",
            "access_key": fake_key,
            "pdf_url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
            "issue_date": datetime.utcnow().isoformat()
        }
        
        # FIX: Removido .schema("fiscal") e padronizado para tabela 'nfse' no public
        response = supabase.table("nfse").insert(db_payload).execute()
        return response.data[0]
    except Exception as e:
        logger.error(f"Falha na emissão de nota: {e}")
        raise HTTPException(status_code=500, detail="Falha ao emitir nota fiscal.")

class TransmitDasnRequest(BaseModel):
    user_id: str
    year: int
    revenue_services: float
    revenue_commerce: float
    has_employee: bool
    is_rectification: bool = False

@app.post("/dasn/transmit")
async def transmit_dasn(req: TransmitDasnRequest):
    """Simula a transmissão da Declaração Anual do MEI (DASN-SIMEI)."""
    try:
        logger.info(f"Iniciando transmissão DASN para {req.user_id} - Ano {req.year} (Retificadora: {req.is_rectification})")
        
        # Simula latência de resposta governamental
        await asyncio.sleep(2.0)
        
        # Verifica se já existe uma declaração
        existing = supabase.table("annual_declarations").select("*").eq("user_id", req.user_id).eq("year", req.year).execute()
        
        db_payload = {
            "user_id": req.user_id,
            "year": req.year,
            "total_revenue_services": req.revenue_services,
            "total_revenue_commerce": req.revenue_commerce,
            "has_employee": req.has_employee,
            "status": "sent",
            "transmission_date": datetime.utcnow().isoformat(),
        }
        
        if existing.data and len(existing.data) > 0:
            if not req.is_rectification:
                raise HTTPException(status_code=400, detail="Declaração já transmitida para este ano. Confirme se deseja enviar uma Retificadora.")
            # Atualiza (Retificadora)
            response = supabase.table("annual_declarations").update(db_payload).eq("id", existing.data[0]['id']).execute()
            receipt_type = "RECIBO DE ENTREGA (RETIFICADORA)"
        else:
            # Insere (Original)
            response = supabase.table("annual_declarations").insert(db_payload).execute()
            receipt_type = "RECIBO DE ENTREGA (ORIGINAL)"

        return {
            "success": True, 
            "message": "Declaração transmitida com sucesso.",
            "data": response.data[0] if response.data else None,
            "receipt_type": receipt_type
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Falha na transmissão DASN: {e}")
        raise HTTPException(status_code=500, detail="Falha ao transmitir declaração.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
