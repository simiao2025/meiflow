import httpx
import json

url = "https://evolution-api.brasilonthebox.shop/instance/connect"
# Usando o TOKEN da instância como apikey conforme o padrão do Evolution Go para ações específicas
headers = {
    "apikey": "token_mei_01225331000101",
    "Content-Type": "application/json"
}
payload = {
    "phone": "5563981122538",
    "subscribe": ["MESSAGE", "SEND_MESSAGE", "CONNECTION", "QRCODE"],
    "immediate": True
}

with httpx.Client() as client:
    response = client.post(url, headers=headers, json=payload)
    print(f"Status: {response.status_code}")
    print(f"Body: {response.text}")
