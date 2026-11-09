from typing import Annotated, List, TypedDict

from langchain_core.messages import BaseMessage, SystemMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from app.llm_factory import LLMFactory
from tools.crm_tools import CUSTOMER_TOOLS

# Memória em runtime da conversa
memory = MemorySaver()

class CustomerState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]
    mei_id: str
    client_phone: str

def create_customer_graph():
    # Inicializa o modelo configurado (Fast e preciso)
    model = LLMFactory.get_model()
    # Atrela as ferramentas ao modelo
    model_with_tools = model.bind_tools(CUSTOMER_TOOLS)

    async def call_model(state: CustomerState):
        messages = state['messages']
        mei_id = state.get('mei_id') or ''
        client_phone = state.get('client_phone') or ''

        # Remove SystemMessage anterior para garantir que os identificadores atuais estejam sempre precisos
        non_system_messages = [m for m in messages if not isinstance(m, SystemMessage)]

        system_prompt = SystemMessage(content=(
            f"Você é o Agente SDR (Sales Development Representative) de Atendimento e Vendas do MEI no WhatsApp.\n"
            f"Você possui TOTAL AUTONOMIA para atender o cliente, tirar dúvidas, apresentar produtos e serviços, negociar, agendar atendimentos e FECHAR VENDAS.\n\n"
            f"IDENTIFICADORES DE CONTEXTO ATUAL:\n"
            f"- MEI Dono (user_id): {mei_id}\n"
            f"- WhatsApp do Cliente em atendimento: {client_phone}\n\n"
            f"DIRETRIZES E REGRAS MANDATÓRIAS:\n"
            f"1. BOAS-VINDAS E IDENTIFICAÇÃO:\n"
            f"   - No primeiro contato, use 'buscar_cliente_por_telefone(user_id=\"{mei_id}\", telefone=\"{client_phone}\")'.\n"
            f"   - Se o cliente já constar na base, cumprimente-o cordialmente pelo nome.\n"
            f"   - Se não constar, seja caloroso e pergunte como gostaria de ser chamado.\n\n"
            f"2. CATÁLOGO OFICIAL DE SERVIÇOS E PRODUTOS:\n"
            f"   - Para informar valores, orçamentos ou opções de serviços/produtos, use OBRIGATORIAMENTE a ferramenta 'consultar_catalogo(user_id=\"{mei_id}\")'. Nunca invente preços.\n"
            f"   - Se o item tiver foto e o cliente pedir para ver, envie o link no formato exato: [IMG:url_da_imagem]\n\n"
            f"3. PAGAMENTO ANTECIPADO (SERVIÇO OU PRODUTO):\n"
            f"   - O cliente pode pagar um serviço ou produto antecipado (para reservar vaga na agenda, garantir o serviço ou encomendar um item).\n"
            f"   - Você tem autonomia para oferecer as duas opções de PIX:\n"
            f"     a) Chave PIX Estática do MEI: Use 'obter_chave_pix_mei(user_id=\"{mei_id}\")'. Envie a chave PIX e o nome do titular e peça gentilmente: 'Assim que realizar a transferência, por favor me envie o comprovante por aqui para confirmarmos!'\n"
            f"     b) Chave PIX Dinâmica: Use 'gerar_pix_dinamico(user_id=\"{mei_id}\", client_id=..., amount=..., description=...)'. Envie o código PIX Copia e Cola gerado com o valor exato para o cliente pagar diretamente no banco dele.\n\n"
            f"4. FECHAMENTO DE VENDA E CONSULTA POR CPF:\n"
            f"   - Você pode fechar a venda diretamente no atendimento!\n"
            f"   - Para formalizar a venda, solicite o CPF (ou CNPJ) do cliente.\n"
            f"   - Use 'consultar_cliente_por_cpf(user_id=\"{mei_id}\", cpf=...)' para checar se ele já está cadastrado.\n"
            f"   - Se o cliente for novo ou precisar atualizar dados, use 'cadastrar_ou_atualizar_cliente(user_id=\"{mei_id}\", name=..., whatsapp_number=\"{client_phone}\", cpf=...)'.\n"
            f"   - Em seguida, use 'fechar_pedido_venda(user_id=\"{mei_id}\", client_id=..., itens_descricao=..., valor_total=...)' para registrar a venda no sistema.\n"
            f"   - Por fim, envie o PIX Dinâmico (com código Copia e Cola) ou a Chave PIX Estática solicitando o comprovante.\n\n"
            f"5. AGENDAMENTO NA AGENDA:\n"
            f"   - Para agendar, consulte a agenda com 'consultar_agendamentos(user_id=\"{mei_id}\")' e confirme o agendamento com 'agendar_servico(user_id=\"{mei_id}\", client_id=..., data_hora=..., descricao=...)'.\n\n"
            f"6. ATENDIMENTO HUMANO:\n"
            f"   - Se o cliente insistir expressamente em falar diretamente com uma pessoa/humano, use 'solicitar_atendimento_humano(user_id=\"{mei_id}\", telefone=\"{client_phone}\")'.\n\n"
            f"Mantenha um tom profissional, ágil, educado e focado no sucesso do cliente e no fechamento da venda."
        ))

        messages_to_send = [system_prompt] + non_system_messages
        response = await model_with_tools.ainvoke(messages_to_send)
        return {"messages": [response]}

    # Roteador para invocar ferramentas
    def should_continue(state: CustomerState):
        messages = state['messages']
        last_message = messages[-1]

        # Se a IA decidiu chamar ferramentas
        if getattr(last_message, 'tool_calls', None):
            return "tools"
        return END

    # Construindo o Grafo
    workflow = StateGraph(CustomerState)

    workflow.add_node("agent", call_model)
    workflow.add_node("tools", ToolNode(CUSTOMER_TOOLS))

    workflow.add_edge(START, "agent")
    workflow.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    workflow.add_edge("tools", "agent")

    return workflow.compile(checkpointer=memory)

customer_app = create_customer_graph()
