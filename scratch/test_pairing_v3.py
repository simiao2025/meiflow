import httpx
import json

url = "https://evolution-api.brasilonthebox.shop/instance/pair"
headers = {
    "apikey": "token_mei_01225331000101",
    "Content-Type": "application/json"
}
payload = {
    "phone": "5563981122538",
    "subscribe": ["MESSAGES"]
}

with httpx.Client() as client:
    response = client.post(url, headers=headers, json=payload)
    print(f"Status: {response.status_code}")
    print(f"Body: {response.text}")
