import httpx
import asyncio
import json

async def simulate_kiwify_webhook():
    # Usamos a URL do Gateway (Nginx) que mapeia para o crm-service
    url = "http://127.0.0.1/api/v1/crm/webhooks/kiwify"
    data = {
        "email": "simiaoacjunior@hotmail.com",
        "full_name": "FRANCISCO DA SILVA",
        "cpf": "96187190149",
        "order_status": "paid"
    }
    
    print(f"Simulando webhook Kiwify para {data['email']}...")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                url, 
                json=data, 
                headers={"X-Internal-Key": "meiflow_secret_2026_internal"},
                timeout=15.0
            )
            if response.status_code == 200:
                print("[SUCCESS] Webhook processado com sucesso!")
                print(json.dumps(response.json(), indent=2))
                print("\n--- JORNADA DO USUARIO ---")
                print(f"1. Usuario recebeu e-mail com senha: {response.json()['temporary_password']}")
                print("2. Usuario abre o app e faz login.")
                print("3. App detecta falta de CNPJ e abre Onboarding.")
                print("4. Usuario preenche dados da empresa e clica 'Finalizar'.")
                print("5. App detecta flag 'must_change_password' e abre Troca de Senha.")
                print("6. Usuario define nova senha e entra no Dashboard.")
            else:
                print(f"[ERROR] Erro no webhook: {response.status_code}")
                print(response.text)
        except Exception as e:
            print(f"[FAILED] Falha ao conectar no servico CRM: {e}")

if __name__ == "__main__":
    asyncio.run(simulate_kiwify_webhook())
