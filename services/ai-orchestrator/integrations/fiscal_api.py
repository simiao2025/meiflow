import asyncio
import uuid
from datetime import datetime


class FiscalIntegrationService:
    """
    Serviço Mock para Emissão de Notas Fiscais.
    Em um ambiente de produção real, este serviço faria requisições HTTP
    para APIs como Focus NFe, WebmaniaBR ou Arquivei utilizando o Certificado A1 do MEI.
    """

    @staticmethod
    async def emitir_nf(payload: dict) -> dict:
        """
        Recebe os dados da nota, simula o tempo de processamento na SEFAZ/Prefeitura
        e retorna um objeto com o link do PDF e XML.
        """
        print(f"[FISCAL API] Iniciando emissão de {payload.get('type', 'nfse').upper()} para {payload.get('receiver_name')}...")

        # Simula a latência da API do governo
        await asyncio.sleep(2)

        # Gera uma chave de acesso fake (44 dígitos)
        fake_access_key = "".join([str(uuid.uuid4().int)[i] for i in range(44)])

        print("[FISCAL API] Emissão Autorizada com Sucesso!")

        return {
            "status": "autorizada",
            "access_key": fake_access_key,
            "number": str(uuid.uuid4().int)[:6],
            "series": "1",
            "xml_url": f"https://s3.amazonaws.com/meiflow/fake-xml/{fake_access_key}.xml",
            "pdf_url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
            "issue_date": datetime.utcnow().isoformat() + "Z"
        }
