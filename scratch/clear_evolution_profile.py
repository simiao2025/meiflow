import os
from supabase import create_client

url = os.getenv("EXPO_PUBLIC_SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase = create_client(url, key)

user_id = "3c764dfe-860c-49b2-935e-2903876f024f"

print(f"Limpando dados da Evolution para o usuário {user_id}...")
res = supabase.table("profiles").update({
    "evolution_instance": None,
    "evolution_token": None,
    "evolution_status": "pending"
}).eq("id", user_id).execute()

print(f"Status: {len(res.data)} linhas atualizadas.")
