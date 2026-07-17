# fiscal Specification

## Purpose
Automação e gestão das obrigações fiscais do MEI: DAS, DASN-SIMEI, emissão de NFS-e e acompanhamento do calendário fiscal.

## Requirements
- **DAS:** Geração e consulta de guias com PIX/Código de barras.
- **NFS-e:** Emissão seguindo padrão ABRASF 2.04 via gateway.
- **DASN:** Assistência no preenchimento e envio da declaração anual.
- **Calendário:** Acompanhamento de vencimentos e alertas proativos.

## Data Model
- `fiscal.das_records`: Registros de DAS.
- `fiscal.nfse`: Emissões de NFS-e.
- `fiscal.dasn_declarations`: Declarações anuais.

## Acceptance Criteria
- [ ] Geração DAS < 1s.
- [ ] Emissão NFS-e < 5s via integração.
- [ ] Alertas proativos de vencimento.
