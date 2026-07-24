"""
Cliente da Meta WhatsApp Business Cloud API.

Documentação oficial: https://developers.facebook.com/docs/whatsapp/cloud-api

Este cliente NÃO substitui o Evolution Go (v3) — coexiste:
- `whatsapp_service.py` continua operando instâncias Evolution Go.
- Este módulo expõe o client oficial Meta Cloud API para conexões via OAuth.

Diferenças-chave:
- Endpoints: https://graph.facebook.com/v19.0/{phone_number_id}/messages
- Auth: Bearer System User Access Token (não apikey por instância).
- Rate limits: 1000 msg/segundo por phone_number_id (limite padrão).
- Tipos aceitos: text, template, image, audio, document, video.
"""
import logging
from typing import Optional

import httpx

logger = logging.getLogger("whatsapp-meta")

META_GRAPH_VERSION = "v19.0"
META_GRAPH_BASE = f"https://graph.facebook.com/{META_GRAPH_VERSION}"


class WhatsAppMetaError(Exception):
    """Erro de comunicação com a Meta Cloud API."""

    def __init__(self, status_code: int, message: str, code: Optional[int] = None):
        self.status_code = status_code
        self.code = code
        super().__init__(f"Meta WA {status_code} ({code}): {message}")


class WhatsAppMetaClient:
    """
    Cliente oficial da Cloud API por phone_number_id.

    Cada MEI conectado têm seu phone_number_id+token gravados em `profiles`.
    Use o factory `client_for(phone_number_id, access_token)` para obter
    instâncias isoladas e evitar vazar tokens entre usuários.
    """

    def __init__(self, phone_number_id: str, access_token: str):
        if not phone_number_id:
            raise ValueError("phone_number_id é obrigatório.")
        if not access_token:
            raise ValueError("access_token é obrigatório.")
        self.phone_number_id = phone_number_id
        self.access_token = access_token

    @classmethod
    def client_for(cls, phone_number_id: str, access_token: str) -> "WhatsAppMetaClient":
        return cls(phone_number_id, access_token)

    def _endpoint(self) -> str:
        return f"{META_GRAPH_BASE}/{self.phone_number_id}/messages"

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

    @staticmethod
    def _normalize_phone(phone: str) -> str:
        """Remove tudo que não for dígito (alguns clients enviam '+' ou espaços)."""
        return "".join(ch for ch in phone if ch.isdigit())

    async def send_text(self, to: str, text: str, preview_url: bool = True) -> dict:
        """
        Envia uma mensagem de texto simples.
        `to` deve estar em formato E.164 (sem '+' ou espaços).

        Cloud API Markdown limita preview_url;a 4096 caracteres.
        """
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": self._normalize_phone(to),
            "type": "text",
            "text": {"body": text, "preview_url": preview_url},
        }
        return await self._post_message(payload)

    async def send_template(
        self,
        to: str,
        template_name: str,
        language: str = "pt_BR",
        components: Optional[list] = None,
    ) -> dict:
        """
        Envia uma mensagem de template pré-aprovado.
        Template precisa estar aprovado no WhatsApp Manager.
        """
        template = {
            "name": template_name,
            "language": {"code": language},
        }
        if components:
            template["components"] = components
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": self._normalize_phone(to),
            "type": "template",
            "template": template,
        }
        return await self._post_message(payload)

    async def send_image(self, to: str, image_url: str, caption: str = "") -> dict:
        """Envia imagem a partir de URL pública HTTP(S)."""
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": self._normalize_phone(to),
            "type": "image",
            "image": {"link": image_url, "caption": caption or None},
        }
        return await self._post_message(payload)

    async def send_audio(self, to: str, audio_url: str) -> dict:
        """Envia áudio (mp3/ogg/m4a) a partir de URL pública."""
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": self._normalize_phone(to),
            "type": "audio",
            "audio": {"link": audio_url},
        }
        return await self._post_message(payload)

    async def send_document(
        self,
        to: str,
        document_url: str,
        caption: str = "",
        filename: str = "documento.pdf",
    ) -> dict:
        """Envia documento (PDF/DOCX/XLSX) a partir de URL pública."""
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": self._normalize_phone(to),
            "type": "document",
            "document": {"link": document_url, "caption": caption or None, "filename": filename},
        }
        return await self._post_message(payload)

    async def mark_message_read(self, message_id: str) -> dict:
        """Marca uma mensagem recebida como lida (reduz SLA de resposta)."""
        endpoint = f"{META_GRAPH_BASE}/{self.phone_number_id}/messages"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                endpoint,
                headers=self._headers(),
                json={"messaging_product": "whatsapp", "status": "read", "message_id": message_id},
            )
            if resp.status_code not in (200, 201):
                raise WhatsAppMetaError(resp.status_code, resp.text)
            return resp.json()

    async def _post_message(self, payload: dict) -> dict:
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                resp = await client.post(self._endpoint(), headers=self._headers(), json=payload)
                data = resp.json()
            except Exception as e:
                logger.error(f"Meta Cloud API request failed: {e}")
                raise WhatsAppMetaError(500, str(e))

            if resp.status_code not in (200, 201):
                error = data.get("error", {})
                logger.warning(
                    f"Meta send_message failed status={resp.status_code} "
                    f"err={error.get('code')}/{error.get('type')}: {error.get('message')}"
                )
                raise WhatsAppMetaError(
                    resp.status_code,
                    error.get("message", resp.text),
                    code=error.get("code"),
                )
            return data


async def download_media(media_id: str, access_token: str) -> Optional[bytes]:
    """
    Efetua o download de uma mídia recebida via webhook.
    Fluxo: media_id -> retrieve URL -> download bytes.
    """
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            # 1. Resolva o media_id em URL temporária
            resp = await client.get(f"{META_GRAPH_BASE}/{media_id}", headers=headers)
            resp.raise_for_status()
            url = resp.json().get("url")
            if not url:
                return None
            # 2. Download do binário
            media_resp = await client.get(url, headers=headers)
            media_resp.raise_for_status()
            return media_resp.content
        except Exception as e:
            logger.error(f"Erro ao baixar mídia Meta {media_id}: {e}")
            return None
