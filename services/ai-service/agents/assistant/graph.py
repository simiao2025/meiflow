from typing import Annotated, List, TypedDict

from langchain_core.messages import BaseMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages

from app.llm_factory import LLMFactory


class AgentState(TypedDict):
    # O add_messages permite anexar novas mensagens ao histórico automaticamente
    messages: Annotated[List[BaseMessage], add_messages]
    user_id: str

def create_assistant_graph():
    # Inicializa o modelo (Multi-LLM ready)
    model = LLMFactory.get_model()

    async def call_model(state: AgentState):
        messages = state['messages']
        # Adiciona contexto do sistema se for a primeira mensagem
        if not any(isinstance(m, SystemMessage) for m in messages):
            system_prompt = SystemMessage(content=(
                "Você é o MEIFlow Assistant, um especialista em gestão para MEI no Brasil. "
                "Sua missão é ajudar o empreendedor com finanças, impostos (DAS), "
                "notas fiscais e crédito. "
                "Seja profissional, prático e empático. Responda sempre em Português do Brasil."
            ))
            messages = [system_prompt] + messages

        response = await model.ainvoke(messages)
        return {"messages": [response]}

    # Define o Grafo
    workflow = StateGraph(AgentState)
    workflow.add_node("agent", call_model)
    workflow.add_edge(START, "agent")
    workflow.add_edge("agent", END)

    return workflow.compile()

assistant_app = create_assistant_graph()
