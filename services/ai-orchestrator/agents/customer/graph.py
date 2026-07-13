from typing import Annotated, List, TypedDict

from langchain_core.messages import BaseMessage, SystemMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from app.llm_factory import LLMFactory
from tools.crm_tools import CUSTOMER_TOOLS

# Memória em runtime (Para produção, migrar para AsyncPostgresSaver)
memory = MemorySaver()

class CustomerState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]
    mei_id: str
    client_phone: str

def create_customer_graph():
    # Inicializa o modelo (Multi-LLM ready)
    model = LLMFactory.get_model()
    # Atrela as ferramentas ao modelo
    model_with_tools = model.bind_tools(CUSTOMER_TOOLS)

    async def call_model(state: CustomerState):
        messages = state['messages']

        # Injeta o prompt apenas se não existir
        if not any(isinstance(m, SystemMessage) for m in messages):
            system_prompt = SystemMessage(content=(
                "Você é o assistente virtual de atendimento de um profissional autônomo (MEI). "
                "Sua missão é atender o cliente de forma rápida, amigável e voltada à venda.\n\n"
                "REGRAS OBRIGATÓRIAS:\n"
                "1. Sempre que iniciar uma conversa, use a ferramenta 'buscar_cliente_por_telefone' para saber se o cliente já existe. Se existir, chame-o pelo nome.\n"
                "2. Se não existir, pergunte o nome e cadastre usando 'cadastrar_cliente'.\n"
                "3. Para falar de preços ou serviços, use OBRIGATORIAMENTE a ferramenta 'consultar_catalogo'. Nunca invente preços.\n"
                "4. Se o cliente quiser ver a foto de um produto/serviço e você viu no catálogo que tem um link de foto, "
                "responda enviando o link no formato exato: [IMG:url_da_imagem]\n"
                "5. Para agendar, use 'agendar_servico'.\n"
                "6. Se pedirem para falar com humano, use 'solicitar_atendimento_humano'.\n"
                "7. Se o cliente concordar com um orçamento ou quiser comprar/pagar algo, pergunte se prefere PIX ou Cartão. Use a ferramenta 'gerar_cobranca' passando o 'telefone', o 'valor', o 'metodo' (pix ou credit_card) e envie o código ou link retornado para o cliente."
            ))
            messages = [system_prompt] + messages

        response = await model_with_tools.ainvoke(messages)
        return {"messages": [response]}

    # Roteador para invocar ferramentas
    def should_continue(state: CustomerState):
        messages = state['messages']
        last_message = messages[-1]

        # Se a IA decidiu chamar uma tool
        if last_message.tool_calls:
            return "tools"
        return END

    # Construindo o Grafo
    workflow = StateGraph(CustomerState)

    workflow.add_node("agent", call_model)
    workflow.add_node("tools", ToolNode(CUSTOMER_TOOLS))

    workflow.add_edge(START, "agent")
    workflow.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    workflow.add_edge("tools", "agent")

    # Compila com a memória persistente
    return workflow.compile(checkpointer=memory)

customer_app = create_customer_graph()
