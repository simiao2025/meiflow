import http.client
import json
import time

def check_service(name, host, port, path="/health"):
    print(f"[*] Verificando {name}...")
    try:
        conn = http.client.HTTPConnection(host, port, timeout=5)
        headers = {"X-Internal-Key": "meiflow_secret_2026_internal"}
        conn.request("GET", path, headers=headers)
        response = conn.getresponse()
        data = response.read().decode()
        
        if response.status == 200:
            print(f"  [OK] {name} está saudável!")
            try:
                details = json.loads(data)
                for dep, status in details.get("dependencies", {}).items():
                    print(f"    - {dep}: {status}")
            except:
                pass
        else:
            print(f"  [ERRO] {name} retornou status {response.status}")
            print(f"  Resposta: {data}")
    except Exception as e:
        print(f"  [FALHA] Não foi possível conectar ao {name}: {e}")
    print("-" * 30)

if __name__ == "__main__":
    print("=" * 40)
    print("   MEIFlow System Blindagem Check")
    print("=" * 40)
    
    # Verifica via Gateway (Nginx)
    check_service("Gateway (Financeiro)", "localhost", 80, "/api/v1/financial/health")
    check_service("Gateway (Fiscal)", "localhost", 80, "/api/v1/fiscal/health")
    check_service("Gateway (CRM)", "localhost", 80, "/api/v1/crm/health")
    
    # Verifica Direto (se as portas estiverem expostas)
    print("[*] Verificando conexões diretas...")
    check_service("Financeiro Direto", "localhost", 8001, "/health")
    
    print("\n[✔] Auditoria concluída.")
