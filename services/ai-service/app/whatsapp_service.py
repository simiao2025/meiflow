import httpx

from .config import settings


class WhatsAppService:
    @staticmethod
    async def send_message(instance_name: str, number: str, text: str):
        # Na Evolution GO, o endpoint e o payload são otimizados
        url = f"{settings.EVOLUTION_API_URL}/message/sendText/{instance_name}"
        headers = {
            "apikey": settings.EVOLUTION_API_KEY,
            "Content-Type": "application/json"
        }

        # Estrutura simplificada da Evolution GO
        payload = {
            "number": number,
            "text": text,
            "delay": 1200,
            "linkPreview": True
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                print(f"Erro ao enviar mensagem via Evolution GO: {e}")
                return {"error": str(e)}
