from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime, timedelta, timezone
from tools.crm_tools import _supabase_get, _supabase_patch
from app.whatsapp_service import WhatsAppService
from langchain_core.messages import SystemMessage
from agents.customer.graph import customer_app

# Importações para auto-reconciliation
from agents.accounting.reconciler import reconciler_agent
from agents.accounting.categorizer import categorizer_agent
from shared.rate_limiter import public_api_limiter, reconciliation_limiter

scheduler = AsyncIOScheduler()

async def check_pending_followups():
    """
    Roda a cada 10 minutos.
    Verifica clientes que tiveram última atualização há mais de 30 min e menos de 2 horas.
    """
    try:
        # Busca clientes ativos com a IA
        # Idealmente, teríamos um campo 'last_message_at' ou 'status' para otimizar isso.
        # Aqui fazemos um envio simulado de 'SYSTEM_EVENT' para o grafo avaliar se precisa de followup.
        print("Executando checagem de follow-up das conversas...")
        
        # Exemplo: Buscando todos os clientes com IA ativada
        clients = await _supabase_get("clients", {"ai_agent_enabled": "eq.true"})
        
        now = datetime.now(timezone.utc)
        thirty_mins_ago = now - timedelta(minutes=30)
        two_hours_ago = now - timedelta(hours=2)
        
        for client in clients:
            updated_str = client.get("updated_at")
            if not updated_str: continue
            
            # Formato esperado: 2026-05-12T03:02:58+00:00
            # Evita erros de parse simplificando
            try:
                updated_at = datetime.fromisoformat(updated_str.replace("Z", "+00:00"))
                if two_hours_ago < updated_at < thirty_mins_ago:
                    phone = client["whatsapp_number"]
                    
                    # Invoca o agente silenciosamente passando uma mensagem de sistema
                    # O agente vai olhar o histórico e decidir se deve mandar follow up
                    print(f"Pedindo para IA avaliar follow-up do cliente {phone}")
                    initial_state = {
                        "messages": [SystemMessage(content="VERIFICAÇÃO DE SISTEMA: Já se passaram 30 minutos desde a última mensagem. Avalie o histórico. Se ficou faltando alguma resposta do cliente para finalizar um agendamento ou cadastro, envie uma mensagem curta e amigável perguntando se ele ainda tem interesse. Caso contrário, responda apenas 'SKIP'.")],
                        "mei_id": client.get("user_id", "default"),
                        "client_phone": phone
                    }
                    config = {"configurable": {"thread_id": phone}}
                    result = await customer_app.ainvoke(initial_state, config=config)
                    ai_response = result["messages"][-1].content
                    
                    if "SKIP" not in ai_response:
                        await WhatsAppService.send_message(
                            "instancia_padrao", # Deveria pegar de env ou config
                            phone,
                            ai_response
                        )
                        # Atualizamos o updated_at para não cobrar de novo
                        await _supabase_patch("clients", "id", client["id"], {})
                        
            except Exception as e:
                print(f"Erro ao processar follow-up do cliente {client.get('id')}: {e}")
                
    except Exception as e:
        print(f"Erro geral no scheduler de followups: {e}")

async def auto_reconcile_all_users():
    """
    Roda a cada 6 horas.
    Para cada usuário com conectores Pluggy ativos:
    1. Busca statements não conciliados
    2. Categoriza com LLM
    3. Tenta matching automático com alta confiança (>0.90)
    4. Aprova automaticamente matches de alta confiança
    5. Deixa sugestões de média/baixa confiança para aprovação manual
    """
    logger = __import__("logging").getLogger(__name__)
    logger.info("Iniciando auto-reconciliation para todos os usuários...")

    try:
        # 1. Buscar todos os usuários com conectores ativos
        connectors = await _supabase_get("pluggy_connectors", {
            "status": "eq.login_succeeded",
        })

        if not connectors:
            logger.info("Nenhum conector ativo encontrado para auto-reconciliation.")
            return

        # Agrupar por user_id
        users = set(c.get("user_id") for c in connectors if c.get("user_id"))
        logger.info(f"Auto-reconciliation para {len(users)} usuários...")

        for user_id in users:
            try:
                await _reconcile_user(user_id, logger)
            except Exception as e:
                logger.error(f"Erro na auto-reconciliation do usuário {user_id}: {e}")

        logger.info("Auto-reconciliation concluída.")
    except Exception as e:
        logger.error(f"Erro geral na auto-reconciliation: {e}")


async def _reconcile_user(user_id: str, logger):
    """Processa reconciliação para um único usuário."""
    # 1. Buscar statements não conciliados (últimos 90 dias)
    statements = (
        await _supabase_get("bank_statements", {
            "user_id": f"eq.{user_id}",
            "reconciled": "is.false",
        })
    ) or []

    if not statements:
        return

    logger.info(f"Usuário {user_id[:8]}...: {len(statements)} statements pendentes")

    # 2. Categorizar
    profile = await _supabase_get("profiles", {"id": f"eq.{user_id}"})
    cnae = profile[0].get("atividade_cnae", "") if profile else ""

    try:
        categorized = await categorizer_agent.categorize_statements(statements, cnae)
        for stmt in categorized:
            if stmt.get("category_ai") and stmt.get("id"):
                await _supabase_patch("bank_statements", "id", stmt["id"], {
                    "category_ai": stmt["category_ai"],
                })
    except Exception as e:
        logger.warning(f"Categoriza��ão falhou para {user_id[:8]}: {e}")
        categorized = statements

    # 3. Buscar DAS e Notas pendentes
    invoices = (
        await _supabase_get("invoices", {
            "user_id": f"eq.{user_id}",
            "status": "eq.autorizada",
        })
    ) or []

    das_records = (
        await _supabase_get("das_records", {
            "user_id": f"eq.{user_id}",
            "status": "eq.pending",
        })
    ) or []

    if not invoices and not das_records:
        return

    # 4. Gerar sugestões
    suggestions = reconciler_agent.suggest_matches(categorized, invoices, das_records)

    # 5. Auto-aprovar sugestões de alta confiança (>= 0.90)
    auto_approved = 0
    for sug in suggestions:
        confidence = sug.get("confidence", 0)
        if confidence >= 0.90:
            try:
                if "das" in (sug.get("match_type") or ""):
                    await _supabase_patch("das_records", "id", sug["match_id"], {
                        "status": "paid",
                    })

                transaction = {
                    "user_id": user_id,
                    "type": "receita" if sug["statement_amount"] > 0 else "despesa",
                    "amount": abs(sug["statement_amount"]),
                    "category": sug.get("match_type", "Conciliação"),
                    "description": sug.get("reason", f"Auto-reconciliação: {sug.get('match_type', '')}"),
                    "bank_statement_id": sug["statement_id"],
                }
                await _supabase_post("transactions", transaction)

                await _supabase_patch("bank_statements", "id", sug["statement_id"], {
                    "reconciled": True,
                })

                auto_approved += 1
            except Exception as e:
                logger.error(f"Erro ao auto-aprovar sugestão {sug.get('statement_id')}: {e}")

    if auto_approved > 0:
        logger.info(f"Auto-aprovadas {auto_approved} reconciliações para {user_id[:8]}")


async def check_appointment_reminders():
    """
    Roda de hora em hora.
    Envia lembrete para agendamentos que ocorrerão nas próximas 24 horas.
    """
    print("Executando checagem de lembretes de agendamentos...")
    try:
        # Pega agendamentos onde status é 'pending'
        appointments = await _supabase_get("appointments", {"status": "eq.pending"})
        now = datetime.now(timezone.utc)
        
        for appt in appointments:
            sched_str = appt.get("scheduled_at")
            if not sched_str: continue
            
            sched_at = datetime.fromisoformat(sched_str.replace("Z", "+00:00"))
            time_diff = sched_at - now
            
            # Se for nas próximas 24h e ainda não avisado
            if timedelta(hours=0) < time_diff < timedelta(hours=24):
                # Busca cliente
                client = await _supabase_get("clients", {"id": f"eq.{appt['client_id']}"})
                if client:
                    phone = client[0]["whatsapp_number"]
                    nome = client[0]["name"]
                    mensagem = f"Olá {nome}! Passando para lembrar do seu agendamento de '{appt['description']}' amanhã às {sched_at.strftime('%H:%M')}. Confirma sua presença?"
                    
                    await WhatsAppService.send_message("instancia_padrao", phone, mensagem)
                    # Atualiza status para evitar duplo envio
                    await _supabase_patch("appointments", "id", appt["id"], {"status": "reminded"})
    except Exception as e:
        print(f"Erro geral no scheduler de lembretes: {e}")

async def cleanup_rate_limiter():
    """Limpa chaves expiradas do rate limiter a cada 30 minutos."""
    logger = __import__("logging").getLogger(__name__)
    try:
        removed = reconciliation_limiter.cleanup_expired()
        removed += public_api_limiter.cleanup_expired()
        if removed:
            logger.debug(f"Rate limiter cleanup: {removed} keys removidas")
    except Exception as e:
        logger.warning(f"Erro no cleanup do rate limiter: {e}")


def start_scheduler():
    scheduler.add_job(check_pending_followups, 'interval', minutes=10)
    scheduler.add_job(check_appointment_reminders, 'interval', hours=1)
    scheduler.add_job(auto_reconcile_all_users, 'interval', hours=6)
    scheduler.add_job(cleanup_rate_limiter, 'interval', minutes=30)
    scheduler.start()
    print("Background Scheduler iniciado com sucesso.")
