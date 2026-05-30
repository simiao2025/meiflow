import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

def get_supabase_client() -> Client:
    """Retorna um cliente Supabase configurado via variáveis de ambiente."""
    url = os.getenv("SUPABASE_URL") or os.getenv("EXPO_PUBLIC_SUPABASE_URL")
    # Para o backend, na maioria das vezes vamos usar a service_role
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("EXPO_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados no .env")
    return create_client(url, key)

def get_supabase_admin_client() -> Client:
    """Retorna um cliente Supabase com privilégios de admin (Service Role)."""
    url = os.getenv("SUPABASE_URL") or os.getenv("EXPO_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados no .env")
    return create_client(url, key)

# Singleton opcional para reuso de conexão
supabase: Client = get_supabase_client()
supabase_admin: Client = get_supabase_admin_client()
