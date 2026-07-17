from typing import Annotated, List, Optional, TypedDict

from langchain_core.messages import BaseMessage, SystemMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from app.llm_factory import LLMFactory
from tools.crm_tools import CUSTOMER_TOOLS
from tools.financial_tools import FINANCIAL_TOOLS
from tools.fiscal_tools import FISCAL_TOOLS

# Combina as ferramentas de todos os domínios para o agente
ALL_TOOLS = CUSTOMER_TOOLS + FINANCIAL_TOOLS + FISCAL_TOOLS

# Memória em runtime para o chat do app
memory = MemorySaver()


class AgentState(TypedDict):
    # O add_messages permite anexar novas mensagens ao histórico automaticamente
    messages: Annotated[List[BaseMessage], add_messages]
    user_id: str
    provider: Optional[str]  # Provider LLM selecionado pelo usuário

SYSTEM_PROMPT = (
    "Você é o MEIFlow Assistant — braço direito do Microempreendedor Individual.\n"
    "O seu ID de usuário interno é: {user_id}. Use-o como 'user_id' SEMPRE que for chamar qualquer ferramenta.\n"
    "Você tem ACESSO TOTAL aos dados do negócio via ferramentas.\n\n"
    "REGRAS:\n"
    "1. Seja BREVE e OBJETIVO. Responda direto ao ponto, sem enrolação.\n"
    "2. Use SEMPRE as ferramentas para consultar dados reais antes de responder. Lembre-se de passar o user_id.\n"
    "3. Não invente dados. Se não encontrou, diga que não há registros.\n"
    "4. Responda em Português do Brasil.\n"
    "5. Formate valores como R$ X.XXX,XX.\n"
    "6. Use emojis com moderação para facilitar a leitura.\n\n"
    "FERRAMENTAS DISPONÍVEIS:\n"
    "- consultar_perfil: dados cadastrais do MEI (nome, CPF, CNPJ, endereço)\n"
    "- consultar_transacoes: receitas e despesas recentes\n"
    "- resumo_financeiro: totais de receita, despesa, saldo e faturamento anual\n"
    "- consultar_contas_bancarias: contas bancárias cadastradas\n"
    "- consultar_das: guias DAS com status de pagamento\n"
    "- consultar_notas_fiscais: NF-e e NFS-e emitidas/recebidas\n"
    "- consultar_catalogo: produtos e serviços com preços\n"
    "- listar_clientes: todos os clientes cadastrados\n"
    "- buscar_cliente_por_telefone: busca cliente por WhatsApp\n"
    "- cadastrar_cliente: registra novo cliente\n"
    "- agendar_servico: cria agendamento\n"
    "- consultar_agendamentos: agenda do MEI\n"
    "- gerar_cobranca: gera PIX ou link de pagamento\n"
    "- consultar_cobrancas: cobranças emitidas e status\n"
)


def create_assistant_graph():
    async def call_model(state: AgentState):
        # Cria o modelo dinamicamente baseado no provider do usuário
        provider = state.get("provider")
        model = LLMFactory.get_model(provider=provider)
        model_with_tools = model.bind_tools(ALL_TOOLS)

        messages = state['messages']
        # Adiciona contexto do sistema se for a primeira mensagem
        if not any(isinstance(m, SystemMessage) for m in messages):
            system_msg = SystemMessage(content=SYSTEM_PROMPT.replace("{user_id}", state["user_id"]))
            messages = [system_msg] + messages

        response = await model_with_tools.ainvoke(messages)
        return {"messages": [response]}

    # Roteador para invocar ferramentas
    def should_continue(state: AgentState):
        messages = state['messages']
        last_message = messages[-1]
        if last_message.tool_calls:
            return "tools"
        return END

    # Define o Grafo
    workflow = StateGraph(AgentState)

    workflow.add_node("agent", call_model)
    workflow.add_node("tools", ToolNode(ALL_TOOLS))

    workflow.add_edge(START, "agent")
    workflow.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    workflow.add_edge("tools", "agent")

    return workflow.compile(checkpointer=memory)

assistant_app = create_assistant_graph()
