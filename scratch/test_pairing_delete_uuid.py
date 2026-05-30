import httpx

base_url = "https://evolution-api.brasilonthebox.shop"
uuid = "aa78a5b4-33b8-442a-8b85-2c87d4696aa1"
global_key = "abcslirm2026"

with httpx.Client() as client:
    print("Deletando a instância pelo UUID...")
    res_del = client.delete(
        f"{base_url}/instance/delete/{uuid}",
        headers={"apikey": global_key}
    )
    print(f"Delete Status: {res_del.status_code}, Body: {res_del.text}")
