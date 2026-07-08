import logging
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple

logger = logging.getLogger(__name__)

# Tolerância para match de valor (evita problemas com centavos/arredondamento)
VALUE_TOLERANCE = 0.05

# Janela de dias para considerar data próxima
DATE_WINDOW_DAYS = 5

# Palavras-chave para match de descrição com DAS
DAS_KEYWORDS = ["das", "simples nacional", "simples", "pg das", "das-mei", "dasn"]

# Palavras-chave para match de descrição com Nota Fiscal
NF_KEYWORDS = ["nfse", "nota fiscal", "nfs-e", "serviço", "fatura", "recibo"]


class ReconcilerAgent:
    def __init__(self):
        pass

    def suggest_matches(
        self,
        statements: List[Dict[str, Any]],
        pending_invoices: List[Dict[str, Any]],
        pending_das: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Cruza transações bancárias não-conciliadas com DAS e Notas Fiscais.

        Estratégia de matching (em ordem de prioridade):
        1. Match exato de valor + data próxima → alta confiança
        2. Match exato de valor + descrição com keyword → alta confiança
        3. Match de valor aproximado (tol. 0.05) + data próxima → média confiança
        4. Match de descrição com keyword DAS → baixa confiança (sugestão)
        5. Match de descrição com keyword NF + valor aproximado → média confiança
        """
        logger.info(
            f"Reconciling {len(statements)} statements against "
            f"{len(pending_invoices)} invoices and {len(pending_das)} DAS"
        )

        suggestions = []
        processed_statements = set()

        for stmt in statements:
            stmt_id = stmt.get("id")
            if stmt.get("reconciled", False) or stmt_id in processed_statements:
                continue

            amt = float(stmt.get("amount", 0))
            stmt_desc = (stmt.get("description") or "").lower()
            stmt_date = self._parse_date(stmt.get("transaction_date"))

            suggestion = None

            if amt < 0:
                # Saída → match com DAS
                suggestion = self._match_das(
                    stmt, abs(amt), stmt_desc, stmt_date, pending_das
                )
            elif amt > 0:
                # Entrada → match com Nota Fiscal
                suggestion = self._match_invoice(
                    stmt, amt, stmt_desc, stmt_date, pending_invoices
                )

            if suggestion:
                suggestions.append(suggestion)
                processed_statements.add(stmt_id)

        logger.info(f"Found {len(suggestions)} reconciliation suggestions")
        return suggestions

    def _match_das(
        self,
        stmt: Dict[str, Any],
        abs_amount: float,
        description: str,
        stmt_date: datetime | None,
        pending_das: List[Dict[str, Any]],
    ) -> Dict[str, Any] | None:
        """Tenta fazer match da transação com guias DAS pendentes."""
        best_match = None
        best_score = 0.0

        for das in pending_das:
            das_amount = float(das.get("amount", 0))
            das_date = self._parse_date(das.get("due_date"))
            das_ref = (das.get("reference_month") or "").lower()

            # Calcular score de matching
            score, match_type, reason = self._calculate_das_match_score(
                abs_amount, description, stmt_date, das_amount, das_date, das_ref
            )

            if score > best_score:
                best_score = score
                best_match = {
                    "statement_id": stmt.get("id"),
                    "statement_desc": stmt.get("description"),
                    "statement_amount": -abs_amount,
                    "statement_date": stmt.get("transaction_date"),
                    "match_type": match_type,
                    "match_id": das.get("id"),
                    "confidence": round(score, 2),
                    "reason": reason,
                    "matched_das_reference": das_ref,
                    "matched_das_due_date": das.get("due_date"),
                }

        return best_match

    def _match_invoice(
        self,
        stmt: Dict[str, Any],
        amount: float,
        description: str,
        stmt_date: datetime | None,
        pending_invoices: List[Dict[str, Any]],
    ) -> Dict[str, Any] | None:
        """Tenta fazer match da transação com notas fiscais pendentes."""
        best_match = None
        best_score = 0.0

        for inv in pending_invoices:
            inv_amount = float(inv.get("valor", inv.get("total_amount", 0)))
            inv_date = self._parse_date(inv.get("emitted_at") or inv.get("issue_date"))
            inv_number = inv.get("numero_nf", inv.get("number", "Desconhecido"))
            inv_client = (
                inv.get("client_name") or inv.get("descricao_servico", "")
            ).lower()

            # Calcular score de matching
            score, match_type, reason = self._calculate_invoice_match_score(
                amount, description, stmt_date, inv_amount, inv_date, inv_client
            )

            if score > best_score:
                best_score = score
                best_match = {
                    "statement_id": stmt.get("id"),
                    "statement_desc": stmt.get("description"),
                    "statement_amount": amount,
                    "statement_date": stmt.get("transaction_date"),
                    "match_type": match_type,
                    "match_id": inv.get("id"),
                    "confidence": round(score, 2),
                    "reason": reason,
                    "matched_invoice_number": inv_number,
                }

        return best_match

    def _calculate_das_match_score(
        self,
        stmt_amount: float,
        stmt_desc: str,
        stmt_date: datetime | None,
        das_amount: float,
        das_date: datetime | None,
        das_ref: str,
    ) -> Tuple[float, str, str]:
        """
        Calcula score de matching entre uma transação e um DAS.
        Retorna (score, match_type, reason).
        """
        # 1. Match exato de valor + data próxima (maior confiança)
        if abs(stmt_amount - das_amount) < VALUE_TOLERANCE:
            if stmt_date and das_date and abs((stmt_date - das_date).days) <= DATE_WINDOW_DAYS:
                mes_ano = das_ref or das_date.strftime("%m/%Y") if das_date else ""
                return (
                    0.98,
                    "das_exact_value_date",
                    f"Valor exato do DAS de {mes_ano} debitado próximo ao vencimento.",
                )

            # Match exato de valor + descrição contém keyword DAS
            if any(kw in stmt_desc for kw in DAS_KEYWORDS):
                mes_ano = das_ref or das_date.strftime("%m/%Y") if das_date else ""
                return (
                    0.95,
                    "das_exact_value_keyword",
                    f"Valor exato do DAS de {mes_ano}. Descrição confirma: '{stmt_desc[:40]}'.",
                )

            # Match exato de valor (apenas valor)
            mes_ano = das_ref or ""
            ref_str = f" de {mes_ano}" if mes_ano else ""
            return (
                0.90,
                "das_exact_value",
                f"Valor debitado corresponde exatamente ao DAS{ref_str}.",
            )

        # 2. Match aproximado de valor + data próxima
        value_diff_pct = abs(stmt_amount - das_amount) / max(das_amount, 0.01)
        if value_diff_pct < 0.05 and stmt_date and das_date:
            days_diff = abs((stmt_date - das_date).days)
            if days_diff <= DATE_WINDOW_DAYS:
                mes_ano = das_ref or ""
                return (
                    0.70,
                    "das_near_value_date",
                    f"Valor próximo ({value_diff_pct*100:.1f}% de diferença) do DAS "
                    f"{'de ' + mes_ano if mes_ano else ''}próximo ao vencimento.",
                )

        # 3. Descrição contém DAS + data próxima
        if any(kw in stmt_desc for kw in DAS_KEYWORDS):
            if stmt_date and das_date and abs((stmt_date - das_date).days) <= DATE_WINDOW_DAYS * 2:
                return (
                    0.60,
                    "das_keyword_date",
                    f"Descrição '{stmt_desc[:40]}' sugere pagamento de imposto "
                    f"próximo ao vencimento.",
                )
            # Solta: só keyword
            return (
                0.40,
                "das_keyword_only",
                f"Descrição '{stmt_desc[:40]}' sugere pagamento de imposto, mas valor difere.",
            )

        # 4. Data próxima + sem keyword
        if stmt_date and das_date and abs((stmt_date - das_date).days) <= 3:
            return (
                0.30,
                "das_date_proximity",
                f"Débito próximo ao vencimento do DAS de {das_ref}, mas valor ou descrição não confirmam.",
            )

        return (0.0, "", "")

    def _calculate_invoice_match_score(
        self,
        stmt_amount: float,
        stmt_desc: str,
        stmt_date: datetime | None,
        inv_amount: float,
        inv_date: datetime | None,
        inv_client: str,
    ) -> Tuple[float, str, str]:
        """
        Calcula score de matching entre uma transação e uma Nota Fiscal.
        Retorna (score, match_type, reason).
        """
        # 1. Match exato de valor + data próxima (maior confiança)
        if abs(stmt_amount - inv_amount) < VALUE_TOLERANCE:
            if stmt_date and inv_date and abs((stmt_date - inv_date).days) <= DATE_WINDOW_DAYS:
                return (
                    0.95,
                    "invoice_exact_value_date",
                    f"Valor exato da NF recebido próximo à emissão.",
                )

            # Match exato + keyword NF
            if any(kw in stmt_desc for kw in NF_KEYWORDS) or inv_client in stmt_desc:
                return (
                    0.92,
                    "invoice_exact_value_keyword",
                    f"Valor exato da NF. {f'Cliente: {inv_client[:30]}' if inv_client else ''}",
                )

            return (
                0.85,
                "invoice_exact_value",
                "Valor recebido corresponde exatamente ao valor da NF.",
            )

        # 2. Match aproximado + data próxima
        value_diff_pct = abs(stmt_amount - inv_amount) / max(inv_amount, 0.01)
        if value_diff_pct < 0.05 and stmt_date and inv_date:
            days_diff = abs((stmt_date - inv_date).days)
            if days_diff <= DATE_WINDOW_DAYS:
                return (
                    0.65,
                    "invoice_near_value_date",
                    f"Valor próximo ({value_diff_pct*100:.1f}% de diferença) recebido "
                    f"próximo à emissão da NF.",
                )

        # 3. Cliente na descrição + valor aproximado
        if inv_client and (
            inv_client in stmt_desc or any(
                part in stmt_desc for part in inv_client.split() if len(part) > 3
            )
        ):
            if abs(stmt_amount - inv_amount) / max(inv_amount, 0.01) < 0.10:
                return (
                    0.55,
                    "invoice_client_description",
                    f"Cliente '{inv_client[:30]}' identificado na descrição com valor "
                    f"próximo ao da NF.",
                )

        return (0.0, "", "")

    def _parse_date(self, date_str: Any) -> datetime | None:
        """Tenta parsear uma string de data em múltiplos formatos."""
        if not date_str:
            return None

        if isinstance(date_str, datetime):
            return date_str

        if isinstance(date_str, str):
            formats = [
                "%Y-%m-%d",
                "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%dT%H:%M:%S%z",
                "%d/%m/%Y",
                "%Y/%m/%d",
                "%d-%m-%Y",
            ]
            for fmt in formats:
                try:
                    return datetime.strptime(date_str, fmt)
                except (ValueError, TypeError):
                    continue

        return None


reconciler_agent = ReconcilerAgent()
