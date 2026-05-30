import httpx

base_url = "https://evolution-api.brasilonthebox.shop"
instance_name = "mei_01225331000101"
global_key = "abcslirm2026"

with httpx.Client() as client:
    print("Reiniciando a instância...")
    res_restart = client.put(
        f"{base_url}/instance/restart/{instance_name}",
        headers={"apikey": global_key}
    )
    print(f"Restart Status: {res_restart.status_code}, Body: {res_restart.text}")
