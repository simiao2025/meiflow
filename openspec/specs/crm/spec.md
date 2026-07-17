# crm Specification

## Purpose
Gestão de clientes e atendimento automatizado via WhatsApp para o negócio do MEI.

## Requirements
- **Cadastro:** Clientes com geolocalização e histórico de atendimentos.
- **WhatsApp:** Integração com Evolution Go para envio de mensagens, agendamentos e atendimento.
- **Histórico:** Registro de todas as interações e visitas.

## Data Model
- `crm.clients`: Dados dos clientes.
- `crm.whatsapp_sessions`: Configuração e status das sessões WhatsApp.
- `crm.service_visits`: Registro de visitas agendadas.

## Acceptance Criteria
- [ ] Conexão WhatsApp estável.
- [ ] Histórico de cliente centralizado.
- [ ] Integração mapa com clientes.
