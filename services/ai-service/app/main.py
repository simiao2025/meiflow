from typing import Optional

import uvicorn
from fastapi import FastAPI, HTTPException
from langchain_core.messages import HumanMessage
from pydantic import BaseModel

from agents.assistant.graph import assistant_app

app = FastAPI(title="MEIFlow AI Service", version="0.1.0")

class ChatRequest(BaseModel):
    message: str
    user_id: str
    thread_id: Optional[str] = "default"
    provider: Optional[str] = "openai"

class ChatResponse(BaseModel):
    response: str
    thread_id: str

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/api/v1/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        # Prepara o estado inicial do agente
        initial_state = {
            "messages": [HumanMessage(content=request.message)],
            "user_id": request.user_id
        }

        # Executa o grafo do assistente
        # Nota: thread_id é usado para manter o contexto da conversa
        config = {"configurable": {"thread_id": request.thread_id}}

        result = await assistant_app.ainvoke(initial_state, config=config)

        # Pega a última mensagem (a resposta da IA)
        last_message = result["messages"][-1]

        return ChatResponse(
            response=last_message.content,
            thread_id=request.thread_id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


from app.whatsapp_service import WhatsAppService


@app.post("/webhook/whatsapp")
async def whatsapp_webhook(data: dict):
    # Log básico para depuração da Evolution GO
    event = data.get('event', '').lower()
    print(f"Evento Evolution GO recebido: {event}")

    # Evolution GO costuma usar 'messages.upsert'
    if event in ['messages.upsert', 'messages_upsert']:
        message_data = data.get('data', {})
        message = message_data.get('message', {})

        # Na GO, o JID pode estar em diferentes lugares dependendo da versão
        key = message_data.get('key', {})
        remote_jid = key.get('remoteJid')
        instance_name = data.get('instance')

        # Ignorar mensagens enviadas por nós mesmos
        if key.get('fromMe', False):
            return {"status": "ignored_self"}

        # Extração de texto robusta
        text = ""
        if 'conversation' in message:
            text = message['conversation']
        elif 'extendedTextMessage' in message:
            text = message['extendedTextMessage'].get('text', "")

        if text and remote_jid:
            print(f"Processando mensagem de {remote_jid}: {text[:50]}...")

            # Chamar a IA (LangGraph)
            initial_state = {
                "messages": [HumanMessage(content=text)],
                "user_id": "whatsapp_system"
            }

            config = {"configurable": {"thread_id": remote_jid}}
            result = await assistant_app.ainvoke(initial_state, config=config)
            ai_response = result["messages"][-1].content

            # Responder via Evolution GO
            await WhatsAppService.send_message(
                instance_name=instance_name,
                number=remote_jid.split('@')[0],
                text=ai_response
            )

    return {"status": "processed"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
