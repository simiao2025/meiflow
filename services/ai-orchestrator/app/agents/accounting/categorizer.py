import json
import logging
from typing import List, Dict, Any

# Mock dependency just for context, in reality uses langchain/openai
# from langchain_openai import ChatOpenAI

logger = logging.getLogger(__name__)

class CategorizerAgent:
    def __init__(self):
        # self.llm = ChatOpenAI(model="gpt-4o", temperature=0.1)
        pass

    async def categorize_statements(self, statements: List[Dict[str, Any]], user_cnae_context: str) -> List[Dict[str, Any]]:
        """
        Takes raw bank statements and uses an LLM to assign an accounting category.
        """
        logger.info(f"Categorizing {len(statements)} statements with context: {user_cnae_context}")
        
        # Em uma implementação real, montaríamos um prompt em lote para o LLM.
        # Prompt Base: 
        # "Você é um contador digital para um MEI com o CNAE {user_cnae_context}. 
        # Categorize as seguintes transações bancárias em uma das seguintes categorias:
        # [Receita_Servicos, Receita_Produtos, Despesa_Insumos, Despesa_Operacional, Impostos, Transferencia_Propria, Outros]."
        
        categorized = []
        for stmt in statements:
            desc = stmt.get('description', '').lower()
            amt = float(stmt.get('amount', 0))
            
            # Simple mock logic replacing the actual LLM call for the POC
            category = "Outros"
            if amt > 0:
                category = "Receita_Servicos" if "pix" in desc or "ted" in desc else "Receita_Produtos"
            else:
                if "das" in desc or "imposto" in desc or "simples" in desc:
                    category = "Impostos"
                elif "fornecedor" in desc or "compra" in desc or "mercado" in desc:
                    category = "Despesa_Insumos"
                elif "energia" in desc or "internet" in desc or "telefone" in desc:
                    category = "Despesa_Operacional"
                else:
                    category = "Outros"
                    
            stmt['category_auto'] = category
            categorized.append(stmt)
            
        return categorized

# Instância Singleton
categorizer_agent = CategorizerAgent()
