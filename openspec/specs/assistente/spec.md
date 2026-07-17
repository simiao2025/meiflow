# assistente Specification

## Purpose
Agente de IA pessoal do MEI que orienta, executa ações fiscais e fornece recomendações financeiras contextuais.

## Requirements
- **IA:** LangGraph orchestrator (GPT-4o/Claude 3.5).
- **Proatividade:** Alertas de limite MEI, lembretes de DAS, anomalias financeiras, sugestões de crédito.
- **Contexto:** Memória de conversas e preferências do usuário.

## Data Model
- `ai.conversations`: Histórico de conversas.
- `ai.messages`: Mensagens das conversas.
- `ai.agent_memory`: Memória persistente dos agentes.

## Acceptance Criteria
- [ ] Respostas contextuais com base nos dados do usuário.
- [ ] Validação de respostas fiscais contra DB real.
- [ ] Streaming de mensagens (SSE).
