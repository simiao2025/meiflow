import os
import httpx
from dotenv import load_dotenv
import json
import asyncio

load_dotenv()

async def check_profile():
    url = os.getenv("EXPO_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    email = "simiaoacjunior@hotmail.com"
    print(f"Buscando perfil para {email} via REST API...")
    
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}"
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{url}/rest/v1/profiles?email=eq.{email}&select=*", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            if data:
                print("Perfil encontrado:")
                print(json.dumps(data[0], indent=2))
            else:
                print("Perfil nao encontrado.")
        else:
            print(f"Erro na API: {response.status_code}")
            print(response.text)

if __name__ == "__main__":
    asyncio.run(check_profile())
