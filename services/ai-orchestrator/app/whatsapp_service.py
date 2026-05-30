import httpx

from .config import settings


class WhatsAppService:
    @staticmethod
    async def send_message(instance_name: str, number: str, text: str):
        url = f"{settings.EVOLUTION_API_URL}/message/sendText/{instance_name}"
        headers = {"apikey": settings.EVOLUTION_API_KEY, "Content-Type": "application/json"}
        payload = {"number": number, "text": text, "delay": 1200, "linkPreview": True}

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                print(f"Erro ao enviar mensagem: {e}")
                return {"error": str(e)}

    @staticmethod
    async def send_audio(instance_name: str, number: str, audio_base64: str):
        """Envia um arquivo de áudio em base64 via Evolution API."""
        url = f"{settings.EVOLUTION_API_URL}/message/sendWhatsAppAudio/{instance_name}"
        headers = {"apikey": settings.EVOLUTION_API_KEY, "Content-Type": "application/json"}
        payload = {
            "number": number,
            "audio": f"data:audio/mp3;base64,{audio_base64}",
            "delay": 1500
        }
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                print(f"Erro ao enviar áudio: {e}")
                return {"error": str(e)}

    @staticmethod
    async def send_media(instance_name: str, number: str, media_url: str, caption: str = ""):
        """Envia uma imagem/mídia via Evolution API a partir de uma URL."""
        url = f"{settings.EVOLUTION_API_URL}/message/sendMedia/{instance_name}"
        headers = {"apikey": settings.EVOLUTION_API_KEY, "Content-Type": "application/json"}
        payload = {
            "number": number,
            "mediaMessage": {
                "mediatype": "image",
                "caption": caption,
                "media": media_url
            },
            "delay": 1500
        }
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                print(f"Erro ao enviar mídia: {e}")
                return {"error": str(e)}

    @staticmethod
    async def download_media(instance_name: str, message_id: str) -> dict:
        """Faz o download da mídia (base64) de uma mensagem da Evolution API."""
        url = f"{settings.EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/{instance_name}"
        headers = {"apikey": settings.EVOLUTION_API_KEY, "Content-Type": "application/json"}
        payload = {"message": {"key": {"id": message_id}}}
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                return response.json() # Retorna o objeto com a propriedade base64
            except Exception as e:
                print(f"Erro ao baixar mídia: {e}")
                return {"error": str(e)}

