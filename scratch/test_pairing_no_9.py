import httpx
import time

base_url = "https://evolution-api.brasilonthebox.shop"
instance_name = "mei_01225331000101"

with httpx.Client() as client:
    print("Testando Pairing Code com número SEM o 9...")
    res_pair = client.post(
        f"{base_url}/instance/pair",
        headers={"apikey": f"token_{instance_name}"},
        json={"phone": "556381122538", "subscribe": ["MESSAGES"]}
    )
    print(f"Status: {res_pair.status_code}, Body: {res_pair.text}")
