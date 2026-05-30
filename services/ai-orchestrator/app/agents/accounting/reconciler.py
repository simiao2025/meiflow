import logging
from typing import List, Dict, Any, Tuple

logger = logging.getLogger(__name__)

class ReconcilerAgent:
    def __init__(self):
        pass

    def suggest_matches(self, statements: List[Dict[str, Any]], 
                        pending_invoices: List[Dict[str, Any]], 
                        pending_das: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Cruza transações bancárias não-conciliadas com Notas Fiscais e Guias DAS pendentes.
        """
        logger.info(f"Reconciling {len(statements)} statements against {len(pending_invoices)} invoices and {len(pending_das)} DAS")
        
        suggestions = []
        
        for stmt in statements:
            if stmt.get('reconciled', False):
                continue
                
            amt = float(stmt.get('amount', 0))
            
            # 1. Tentar fazer match com DAS (Saída de Dinheiro)
            if amt < 0:
                abs_amt = abs(amt)
                for das in pending_das:
                    das_amt = float(das.get('amount', 0))
                    # Match exato de valor
                    if abs(abs_amt - das_amt) < 0.01:
                        suggestions.append({
                            "statement_id": stmt.get("id"),
                            "statement_desc": stmt.get("description"),
                            "statement_amount": amt,
                            "match_type": "das_payment",
                            "match_id": das.get("id"),
                            "confidence": 0.95,
                            "reason": "O valor debitado no banco é exatamente o valor da guia DAS vencendo neste mês."
                        })
                        break # Simplificação para o POC
            
            # 2. Tentar fazer match com Invoices (Entrada de Dinheiro)
            elif amt > 0:
                for inv in pending_invoices:
                    inv_amt = float(inv.get('valor', 0))
                    # Match exato de valor
                    if abs(amt - inv_amt) < 0.01:
                        suggestions.append({
                            "statement_id": stmt.get("id"),
                            "statement_desc": stmt.get("description"),
                            "statement_amount": amt,
                            "match_type": "invoice_receipt",
                            "match_id": inv.get("id"),
                            "confidence": 0.90,
                            "reason": f"Esta entrada corresponde exatamente à Nota Fiscal Nº {inv.get('numero_nf', 'Desconhecido')} emitida recentemente."
                        })
                        break
                        
        return suggestions

reconciler_agent = ReconcilerAgent()
