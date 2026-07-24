import os
import sys
import uuid
import asyncio
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from supabase import create_client, Client
from dotenv import load_dotenv

# Adiciona o diretório shared ao path para importar os modelos
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
from shared.models import Transaction, TransactionStatus
from shared.database import supabase
from shared.security import verify_jwt
from shared.middleware import SecurityHeadersMiddleware, CorrelationIdMiddleware
from shared.logger import get_logger

logger = get_logger("financial-service")

# Inicialização — sem dependência global (JWT é injetado por rota)
app = FastAPI(
    title="MEIFlow Financial Service",
    description="Serviço responsável pela gestão financeira e saldo do MEI",
    version="2.0.0",
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CorrelationIdMiddleware)

# CORS restrito — apenas origens confiáveis
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
    allow_headers=["Content-Type", "Authorization", "X-Correlation-ID"],
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
async def create_transaction(transaction: dict, user_id: str = Depends(verify_jwt)):
    """Registra uma nova transação financeira.
    O user_id é extraído do JWT — nunca do payload do cliente.
    """
    try:
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
        logger.error(f"Erro ao criar transação para o usuário {user_id[:8]}...: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao processar transação.")

@app.get("/transactions")
async def get_transactions(user_id: str = Depends(verify_jwt)):
    """Retorna o histórico de transações do usuário autenticado."""
    try:
        response = supabase.table("transactions").select("*").eq("user_id", user_id).execute()
        return response.data
    except Exception as e:
        logger.error(f"Erro ao buscar transações para {user_id[:8]}...: {e}")
        raise HTTPException(status_code=500, detail="Erro ao recuperar histórico financeiro.")

@app.get("/balance")
async def get_balance(user_id: str = Depends(verify_jwt)):
    """Calcula o saldo real (Receitas - Despesas) do usuário autenticado."""
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
        logger.error(f"Erro ao calcular saldo para {user_id[:8]}...: {e}")
        raise HTTPException(status_code=500, detail="Erro ao calcular saldo financeiro.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

