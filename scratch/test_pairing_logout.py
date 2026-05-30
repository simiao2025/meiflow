import httpx
import time

base_url = "https://evolution-api.brasilonthebox.shop"
uuid = "aa78a5b4-33b8-442a-8b85-2c87d4696aa1"
global_key = "abcslirm2026"

with httpx.Client() as client:
    print("Efetuando logout da instância pelo UUID...")
    res_logout = client.delete(
        f"{base_url}/instance/logout/{uuid}",
        headers={"apikey": global_key}
    )
    print(f"Logout Status: {res_logout.status_code}, Body: {res_logout.text}")
