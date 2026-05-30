import os
import sys
import uuid
import asyncio
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from supabase import create_client, Client
from dotenv import load_dotenv

# Adiciona o diretório shared ao path para importar os modelos
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
from shared.models import Transaction, TransactionStatus
from shared.database import supabase
from shared.security import verify_internal_key
from shared.middleware import SecurityHeadersMiddleware, CorrelationIdMiddleware
from shared.logger import get_logger

logger = get_logger("financial-service")

# Inicialização com segurança e middlewares ativados
app = FastAPI(
    title="MEIFlow Financial Service",
    description="Serviço responsável pela gestão financeira e saldo do MEI",
    version="1.1.0",
    dependencies=[Depends(verify_internal_key)]
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CorrelationIdMiddleware)

# Adiciona suporte a CORS para o navegador
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
    """Verifica a saúde do serviço e suas dependências."""
    health = {"status": "healthy", "service": "financial-service", "dependencies": {}}
    
    # Check Supabase (public schema)
    try:
        supabase.table("transactions").select("count", count="exact").limit(1).execute()
        health["dependencies"]["supabase"] = "ok"
    except Exception as e:
        logger.error(f"Falha na dependência Supabase: {e}")
        health["dependencies"]["supabase"] = "error"
        health["status"] = "unhealthy"

    # Check Redis
    try:
        await redis_client.ping()
        health["dependencies"]["redis"] = "ok"
    except Exception as e:
        logger.error(f"Falha na dependência Redis: {e}")
        health["dependencies"]["redis"] = "error"
        health["status"] = "unhealthy"
        
    return health

@app.post("/transactions")
async def create_transaction(transaction: dict):
    """Registra uma nova transação financeira."""
    try:
        user_id = transaction.get("user_id")
        amount = transaction.get("amount", 0)
        method = transaction.get("payment_method", "cash")

        db_payload = {
            "user_id": user_id,
            "amount": amount,
            "type": transaction.get("type", "receita"),
            "category": transaction.get("category", "Geral"),
            "description": transaction.get("description", ""),
            "payment_method": method,
            "status": "completed" if method == "cash" else "pending"
        }
        
        response = supabase.table("transactions").insert(db_payload).execute()
        return response.data[0]
    except Exception as e:
        logger.error(f"Erro ao criar transação para o usuário {transaction.get('user_id')}: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao processar transação.")

@app.get("/transactions/{user_id}", response_model=List[Transaction])
async def get_transactions(user_id: str):
    """Retorna o histórico de transações de um usuário."""
    try:
        response = supabase.table("transactions").select("*").eq("user_id", user_id).execute()
        return response.data
    except Exception as e:
        logger.error(f"Erro ao buscar transações para {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Erro ao recuperar histórico financeiro.")

@app.get("/balance/{user_id}")
async def get_balance(user_id: str):
    """Calcula o saldo real (Receitas - Despesas) do usuário."""
    try:
        response = supabase.table("transactions").select("amount, type, status").eq("user_id", user_id).execute()
        
        total = 0.0
        for t in response.data:
            amount = float(t['amount'])
            status = t.get('status', 'completed')
            
            if status == 'completed' or status is None:
                if t['type'] == 'receita':
                    total += amount
                else:
                    total -= amount
                    
        return {"user_id": user_id, "balance": round(total, 2)}
    except Exception as e:
        logger.error(f"Erro ao calcular saldo para {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Erro ao calcular saldo financeiro.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
