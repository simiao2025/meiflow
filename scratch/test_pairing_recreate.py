import httpx
import time

base_url = "https://evolution-api.brasilonthebox.shop"
instance_name = "mei_01225331000101"
global_key = "abcslirm2026"
phone = "5563981122538"

with httpx.Client() as client:
    print("Deletando a instância...")
    res_del = client.delete(
        f"{base_url}/instance/delete/{instance_name}",
        headers={"apikey": global_key}
    )
    print(f"Delete Status: {res_del.status_code}, Body: {res_del.text}")
    
    time.sleep(2)
    
    print("Recriando a instância...")
    res_create = client.post(
        f"{base_url}/instance/create",
        headers={"apikey": global_key},
        json={"instanceName": instance_name, "token": f"token_{instance_name}", "qrcode": True}
    )
    print(f"Create Status: {res_create.status_code}, Body: {res_create.text}")
    
    time.sleep(3)
    
    print("Solicitando Pairing Code...")
    res_pair = client.post(
        f"{base_url}/instance/pair",
        headers={"apikey": f"token_{instance_name}"},
        json={"phone": phone, "subscribe": ["MESSAGES"]}
    )
    print(f"Pair Status: {res_pair.status_code}, Body: {res_pair.text}")
