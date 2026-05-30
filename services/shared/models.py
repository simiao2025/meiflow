from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class ServiceType(str, Enum):
    SERVICE = "service"
    PRODUCT = "product"

class TransactionType(str, Enum):
    RECEITA = "receita"
    DESPESA = "despesa"

class TransactionStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class UserProfile(BaseModel):
    id: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    cnpj: Optional[str] = None
    avatar_url: Optional[str] = None

class CatalogItem(BaseModel):
    id: Optional[str] = None
    user_id: str
    name: str
    description: Optional[str] = None
    price: float
    type: ServiceType = ServiceType.SERVICE
    billing_unit: str = "unidade"

class Transaction(BaseModel):
    id: Optional[str] = None
    user_id: str
    amount: float
    type: TransactionType = TransactionType.RECEITA
    description: str
    payment_method: str = "cash"
    status: TransactionStatus = TransactionStatus.PENDING
    category: Optional[str] = "Geral"
    created_at: Optional[datetime] = None

class Invoice(BaseModel):
    id: Optional[str] = None
    user_id: str
    direction: str = "outbound"
    type: str = "nfse"
    receiver_name: str
    total_amount: float
    status: str
    access_key: Optional[str] = None
    pdf_url: Optional[str] = None
    issue_date: datetime

class Client(BaseModel):
    id: Optional[str] = None
    user_id: str
    name: str
    email: Optional[str] = None
    whatsapp_number: Optional[str] = None
    total_revenue: float = 0.0

class Appointment(BaseModel):
    id: Optional[str] = None
    user_id: str
    client_id: str
    description: str
    scheduled_at: datetime
    status: str = "pending"
