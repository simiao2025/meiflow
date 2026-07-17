# auth-profile Specification

## Purpose
Autenticação simplificada via CNPJ com consulta à Receita Federal e onboarding guiado para MEI, garantindo segurança e aderência ao perfil do usuário.

## Requirements
- Login via CNPJ + Senha/Biometria.
- Integração com Receita Federal para validação e auto-preenchimento de dados (CNPJ/Razão Social/CNAE).
- Fluxo de onboarding para definição de senha e preferências iniciais.

## Data Model
- `public.profiles`: Dados cadastrais do MEI.

## Acceptance Criteria
- [ ] Validação de CNPJ ativa.
- [ ] Onboarding completo salvando dados no Supabase.
- [ ] Biometria configurada (opcional).
