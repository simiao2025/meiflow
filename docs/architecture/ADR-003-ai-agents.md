# ADR-003: Agentes IA com LangGraph em Serviço Separado

**Status:** Aceita
**Data:** 2026-05-08
**Decisores:** Equipe MEIFlow

## Contexto

O MEIFlow possui dois agentes IA distintos:

1. **Assistente Pessoal do MEI** — orienta sobre fiscal, financeiro, crédito, legislação, licitações
2. **Agente de Atendimento** — atende clientes do negócio do MEI via WhatsApp

Ambos precisam: estado persistente, memória, ferramentas (tools), streaming de respostas, e isolamento de dados entre usuários.

## Decisão

### Framework: **LangGraph**

**Alternativas consideradas:**
- LangChain Agents — menos controle sobre fluxo, sem grafos de estado
- AutoGen — focado em multi-agent, over-engineered para 2 agentes
- CrewAI — abstração alta demais, difícil customizar
- OpenAI Assistants API — lock-in, sem controle do fluxo, custo alto

**Motivo:** LangGraph permite definir agentes como grafos de estado com nós (ferramentas, classificadores, geradores) e transições condicionais. Controle total sobre o fluxo, com persistência de estado e streaming nativo.

### Hospedagem: **Serviço Python separado (FastAPI)**

**Alternativas consideradas:**
- Edge Functions do Supabase — timeout de 60s, sem estado, Deno (não Python)
- Serverless (AWS Lambda) — cold starts, sem streaming SSE
- Embedded no app (on-device LLM) — modelos muito grandes, sem qualidade suficiente

**Motivo:** FastAPI em container Docker permite: long-running connections (SSE streaming), Redis para estado/cache, acesso direto ao Supabase via service_role, e deploy independente.

### Comunicação: **App → Edge Function (proxy) → FastAPI**

```
App Expo (JWT) → Edge Function (valida JWT, extrai user_id) → FastAPI → LangGraph
```

**Por que não direto?**
- Edge Function valida JWT sem expor service_role ao client
- Rate limiting centralizado
- Logging e monitoramento unificados
- Python service nunca exposto à internet pública

### Segurança de Dados entre MEIs

```python
# Cada chamada ao agente recebe APENAS dados do user_id autenticado
@router.post("/chat")
async def chat(request: ChatRequest, user_id: str = Depends(get_authenticated_user)):
    # O agente SÓ pode acessar tools que filtram por user_id
    # Nenhuma tool aceita user_id como parâmetro — é injetado automaticamente
    response = await assistant_agent.invoke(
        message=request.message,
        config={"configurable": {"user_id": user_id}},
    )
```

## Consequências

### Positivas
- Controle total sobre comportamento dos agentes
- Streaming de respostas (UX de chat em tempo real)
- Escala independente (IA pode ter mais recursos que backend)
- Fallback de LLM (GPT-4o → Claude) transparente
- Memória persistente e contextual por usuário

### Negativas
- Infraestrutura adicional (Docker, Redis)
- Custo de LLM por mensagem
- Latência adicional (Edge Function → Python)

### Riscos e Mitigações
| Risco | Mitigação |
|-------|----------|
| Custo de LLM alto | Rate limiting + cache de respostas comuns |
| Alucinação fiscal | Validação contra dados reais do DB antes de entregar |
| Prompt injection | System prompts blindados + input sanitization |
| Serviço Python fora do ar | App mostra "Assistente indisponível" + fila de msgs pendentes |
