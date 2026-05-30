from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime, timedelta, timezone
from tools.crm_tools import _supabase_get, _supabase_patch
from app.whatsapp_service import WhatsAppService
from langchain_core.messages import SystemMessage
from agents.customer.graph import customer_app

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

def start_scheduler():
    scheduler.add_job(check_pending_followups, 'interval', minutes=10)
    scheduler.add_job(check_appointment_reminders, 'interval', hours=1)
    scheduler.start()
    print("Background Scheduler iniciado com sucesso.")
