import httpx
import time
import json

base_url = "https://evolution-api.brasilonthebox.shop"
instance_name = "mei_01225331000101"
global_key = "abcslirm2026"
instance_token = "token_mei_01225331000101"

with httpx.Client() as client:
    # 1. Tentar logout
    print("Efetuando logout da instância...")
    res_logout = client.delete(
        f"{base_url}/instance/logout/{instance_name}",
        headers={"apikey": global_key}
    )
    print(f"Logout Status: {res_logout.status_code}, Body: {res_logout.text}")
    
    time.sleep(2)
    
    # 2. Tentar solicitar novo código
    print("Solicitando novo Pairing Code...")
    res_pair = client.post(
        f"{base_url}/instance/pair",
        headers={"apikey": instance_token},
        json={"phone": "5563981122538", "subscribe": ["MESSAGES"]}
    )
    print(f"Pair Status: {res_pair.status_code}, Body: {res_pair.text}")
