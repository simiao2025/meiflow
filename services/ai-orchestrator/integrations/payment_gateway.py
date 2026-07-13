import asyncio
import uuid


class PaymentGatewayService:
    """
    Serviço Mock de Gateway de Pagamentos (Asaas/MercadoPago).
    Em produção, ele faria requisições HTTP para a API do Asaas usando
    a asaas_api_key do MEI.
    """

    @staticmethod
    async def create_charge(payload: dict) -> dict:
        """
        Cria uma cobrança no Gateway.
        Payload esperado: { "amount": float, "method": "pix"|"credit_card", "description": str, "client_name": str }
        """
        print(f"[GATEWAY] Criando cobrança de R$ {payload['amount']} via {payload['method']}...")

        # Simula latência de rede
        await asyncio.sleep(1.5)

        external_id = f"pay_{uuid.uuid4().hex[:12]}"

        if payload['method'] == 'pix':
            return {
                "status": "pending",
                "external_reference": external_id,
                "payment_link": f"https://sandbox.asaas.com/c/{external_id}",
                "qr_code_payload": f"00020101021226...PIX-MOCK-MOCK...{payload['amount']}...5303986",
                "qr_code_base64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", # Dummy 1x1 pixel base64
            }
        else: # Cartão de Crédito/Débito
            return {
                "status": "pending",
                "external_reference": external_id,
                "payment_link": f"https://sandbox.asaas.com/c/{external_id}",
                "qr_code_payload": None,
                "qr_code_base64": None,
            }

    @staticmethod
    async def simulate_webhook_payment(external_reference: str) -> dict:
        """
        Simula a confirmação de pagamento vindo por Webhook do Asaas.
        """
        print(f"[GATEWAY] Webhook recebido: Pagamento Confirmado {external_reference}")
        return {
            "event": "PAYMENT_RECEIVED",
            "payment": {"id": external_reference}
        }
