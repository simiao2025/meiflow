import json
import logging
from typing import Any, Dict, List

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

logger = logging.getLogger(__name__)

# Categorias contábeis padronizadas (SPED / ECD)
CATEGORIES = [
    "Receita_Servicos",         # Prestação de serviços
    "Receita_Produtos",         # Venda de mercadorias/produtos
    "Receita_Outras",           # Outras receitas
    "Despesa_Insumos",          # Matéria-prima, mercadorias para revenda
    "Despesa_Operacional",      # Água, luz, internet, telefone, aluguel
    "Despesa_Pessoal",          # Pró-labore, salários
    "Despesa_Financeira",       # Juros, tarifas bancárias, anuidade cartão
    "Impostos",                 # DAS, impostos, taxas
    "Transferencia_Propria",    # TED/PIX entre contas do mesmo titular
    "Investimento",             # Compra de equipamentos, software, veículos
    "Saque",                    # Saques em espécie
    "Recebimento_Cliente",      # Recebimento de cliente identificado
    "Pagamento_Fornecedor",     # Pagamento a fornecedor identificado
    "Estorno",                  # Estornos / chargebacks
    "Outros",                   # Não classificado
]

# Prompt do sistema para o LLM
SYSTEM_PROMPT_TEMPLATE = """Você é um contador digital especializado em MEI (Microempreendedor Individual) brasileiro.
O usuário tem o seguinte CNAE: {cnae_context}

Classifique cada transação bancária em UMA das seguintes categorias contábeis:
{category_list}

Regras:
- Transações de SAÍDA com "DAS", "Imposto", "Simples Nacional", "GPS", "INSS" na descrição → "Impostos"
- Transações de SAÍDA com "PIX", "TED", "DOC" para pessoas físicas ou não identificadas → pode ser "Transferencia_Propria" ou "Despesa_Pessoal"
- Transações de ENTRADA com "PIX", "TED" → "Receita_Servicos" (a menos que seja transferência entre contas)
- Transações com descrição contendo "anuidade", "tarifa", "juros", "iof" → "Despesa_Financeira"
- Transferências entre contas do mesmo banco → "Transferencia_Propria"
- Descrições genéricas demais ("Pgto", "Transf", "Cred") → use o contexto de descrições similares anteriores

Responda APENAS com um JSON array de objetos, onde cada objeto tem:
  {{"id": "<index>", "category": "<categoria>", "confidence": <0.0-1.0>, "reason": "<motivo curto>"}}
"""


class CategorizerAgent:
    def __init__(self):
        self.llm = ChatOpenAI(model="gpt-4o", temperature=0.05)

    async def categorize_statements(
        self, statements: List[Dict[str, Any]], user_cnae_context: str
    ) -> List[Dict[str, Any]]:
        """
        Usa LLM para categorizar transações bancárias com base no CNAE do MEI.
        """
        logger.info(
            f"Categorizing {len(statements)} statements with LLM (CNAE: {user_cnae_context})"
        )

        if not statements:
            return []

        # Se for apenas 1-2 statements, faz chamada direta
        if len(statements) <= 2:
            return await self._categorize_batch(statements, user_cnae_context)

        # Para lotes maiores, processa em grupos de 15 para caber no contexto
        batch_size = 15
        all_categorized = []

        for i in range(0, len(statements), batch_size):
            batch = statements[i : i + batch_size]
            categorized_batch = await self._categorize_batch(batch, user_cnae_context)
            all_categorized.extend(categorized_batch)

        logger.info(
            f"Categorization complete: {len(all_categorized)}/{len(statements)} categorized"
        )
        return all_categorized

    async def _categorize_batch(
        self, statements: List[Dict[str, Any]], cnae_context: str
    ) -> List[Dict[str, Any]]:
        """
        Categoriza um lote de statements usando o LLM.
        """
        # Montar lista de transações para o prompt
        tx_lines = []
        for i, stmt in enumerate(statements):
            desc = (stmt.get("description") or "").strip()
            amt = float(stmt.get("amount", 0))
            date = stmt.get("transaction_date") or ""
            direction = "ENTRADA" if amt > 0 else "SAÍDA"
            tx_lines.append(
                f"  [{i}] Data: {date} | {direction} | R$ {abs(amt):.2f} | Descrição: '{desc}'"
            )

        tx_text = "\n".join(tx_lines)
        category_list = "\n".join([f"- {c}" for c in CATEGORIES])

        system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
            cnae_context=cnae_context or "não informado",
            category_list=category_list,
        )

        user_prompt = f"""Classifique as seguintes transações bancárias:

{tx_text}

Responda APENAS com o JSON array."""

        content = ""
        try:
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt),
            ]

            response = await self.llm.ainvoke(messages)
            content = response.content.strip()

            # Extrair JSON da resposta (o LLM pode adicionar markdown)
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()

            classifications = json.loads(content)

            # Aplicar classificações aos statements
            categorized = []
            for idx, stmt in enumerate(statements):
                stmt_copy = dict(stmt)

                # Encontrar a classificação correspondente (pelo índice no batch)
                classification = next(
                    (c for c in classifications if c.get("id") == idx),
                    None,
                )

                if classification:
                    stmt_copy["category_ai"] = classification.get("category", "Outros")
                    stmt_copy["category_confidence"] = classification.get(
                        "confidence", 0.5
                    )
                    stmt_copy["category_reason"] = classification.get("reason", "")
                else:
                    stmt_copy["category_ai"] = "Outros"
                    stmt_copy["category_confidence"] = 0.0
                    stmt_copy["category_reason"] = "Não classificado pelo LLM"

                categorized.append(stmt_copy)

            return categorized

        except json.JSONDecodeError as e:
            logger.error(f"Erro ao parsear resposta do LLM: {e}. Resposta: {content}")
            # Fallback: categorização mock simples
            return self._fallback_categorize(statements)

        except Exception as e:
            logger.error(f"Erro ao chamar LLM: {e}")
            return self._fallback_categorize(statements)

    def _fallback_categorize(
        self, statements: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Fallback: categorização baseada em regras simples (mock).
        Usada quando o LLM não está disponível.
        """
        categorized = []
        for stmt in statements:
            desc = (stmt.get("description") or "").lower()
            amt = float(stmt.get("amount", 0))
            stmt_copy = dict(stmt)

            category = "Outros"
            if amt > 0:
                if any(k in desc for k in ["pix", "ted", "doc"]):
                    category = "Receita_Servicos"
                else:
                    category = "Receita_Outras"
            else:
                if any(k in desc for k in ["das", "imposto", "simples"]):
                    category = "Impostos"
                elif any(k in desc for k in ["tarifa", "juros", "iof", "anuidade"]):
                    category = "Despesa_Financeira"
                elif any(k in desc for k in ["energia", "internet", "telefone", "agua"]):
                    category = "Despesa_Operacional"
                elif any(k in desc for k in ["fornecedor", "compra", "estoque"]):
                    category = "Despesa_Insumos"
                elif any(k in desc for k in ["pix", "ted", "transf"]):
                    category = "Transferencia_Propria"
                else:
                    category = "Outros"

            stmt_copy["category_ai"] = category
            stmt_copy["category_confidence"] = 0.6
            stmt_copy["category_reason"] = f"Fallback (keyword: '{desc[:30]}')"
            categorized.append(stmt_copy)

        return categorized


# Instância Singleton
categorizer_agent = CategorizerAgent()
