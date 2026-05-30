import os
from supabase import create_client, Client
from dotenv import load_dotenv
import json

load_dotenv()

def check_profile():
    url = os.getenv("EXPO_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    supabase = create_client(url, key)
    
    email = "simiaoacjunior@hotmail.com"
    print(f"Buscando perfil para {email}...")
    
    response = supabase.table("profiles").select("*").eq("email", email).execute()
    
    if response.data:
        print("Perfil encontrado:")
        print(json.dumps(response.data[0], indent=2))
    else:
        print("Perfil nao encontrado.")

if __name__ == "__main__":
    check_profile()
