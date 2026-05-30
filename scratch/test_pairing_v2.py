import httpx
import json

url = "https://evolution-api.brasilonthebox.shop/instance/connect"
headers = {
    "apikey": "token_mei_01225331000101",
    "Content-Type": "application/json"
}
payload = {
    "instanceName": "mei_01225331000101",
    "phone": "5563981122538"
}

with httpx.Client() as client:
    # Test POST /instance/connect
    response = client.post(url, headers=headers, json=payload)
    print(f"POST /instance/connect Status: {response.status_code}")
    print(f"POST /instance/connect Body: {response.text}")

    # Test POST /instance/pair with instanceName
    url_pair = "https://evolution-api.brasilonthebox.shop/instance/pair"
    response = client.post(url_pair, headers=headers, json=payload)
    print(f"POST /instance/pair Status: {response.status_code}")
    print(f"POST /instance/pair Body: {response.text}")
