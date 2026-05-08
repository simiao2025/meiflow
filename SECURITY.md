# Política de Segurança — MEIFlow

## Compromisso

O MEIFlow lida com dados financeiros, fiscais e pessoais (CPF, CNPJ, dados bancários) de Microempreendedores Individuais. A segurança é prioridade absoluta e inegociável.

## Reportar Vulnerabilidades

Se você descobrir uma vulnerabilidade de segurança, **NÃO abra uma issue pública**.

Envie um email para: **security@meiflow.com.br**

Inclua:
- Descrição detalhada da vulnerabilidade
- Passos para reproduzir
- Impacto potencial
- Sugestão de correção (se houver)

**Tempo de resposta:** 48 horas para confirmação, 7 dias para plano de ação.

## Práticas de Segurança

### Dados em Repouso
- CPF/CNPJ criptografados com `pgcrypto` (pgp_sym_encrypt)
- Tokens de integração no Supabase Vault
- Senhas via bcrypt (Supabase Auth)

### Dados em Trânsito
- HTTPS/TLS 1.3 enforced (Supabase)
- Certificate pinning no app mobile
- Edge Functions como proxy para serviço IA (nunca exposto diretamente)

### Autenticação
- JWT com refresh tokens (access: 1h, refresh: 30 dias)
- MFA (TOTP) para ações sensíveis
- Biometria (Fingerprint/Face ID) para acesso rápido
- Bloqueio após 5 tentativas falhas

### Autorização
- Row Level Security (RLS) em **todas** as tabelas
- Política base: `user_id = auth.uid()` — cada MEI só acessa seus dados
- Assinatura ativa verificada via RLS para operações de escrita
- Edge Functions com `service_role` nunca exposto ao client

### App Mobile
- `expo-secure-store` para tokens
- MMKV criptografado para cache
- FLAG_SECURE em telas financeiras (bloqueia screenshots)
- Detecção de root/jailbreak
- Tela de bloqueio após 5 minutos de inatividade
- ProGuard + Hermes (ofuscação em produção)
- Debug mode desabilitado em builds de produção

### Agentes IA
- System prompts blindados contra prompt injection
- Input sanitization + guardrails (LangGraph)
- Data isolation: cada chamada recebe apenas dados do user_id autenticado
- Rate limiting: 30 msgs/min, 500/dia por usuário
- Respostas fiscais validadas contra dados reais do DB
- API keys em variáveis de ambiente, rotação mensal

### LGPD
- Consentimento granular no onboarding
- Direito de acesso: exportação de dados (JSON/PDF)
- Direito de exclusão: cascade delete + anonimização de logs
- Portabilidade: exportação em formato aberto (CSV/JSON)
- Retenção: dados fiscais 5 anos, conversas IA 12 meses, logs 90 dias

## Checklist de Segurança para PRs

Antes de mergear qualquer PR que toque em:

- [ ] **Auth/Autenticação** — verificar que não há bypass de JWT
- [ ] **Queries SQL** — verificar RLS policies atualizadas
- [ ] **Inputs de usuário** — validação com Zod (client) + verificação no servidor
- [ ] **APIs externas** — credenciais em env vars, nunca hardcoded
- [ ] **Logs** — nenhum dado sensível (CPF, tokens, senhas) nos logs
- [ ] **Edge Functions** — CORS configurado, rate limiting ativo
- [ ] **Dependências** — `npm audit` sem vulnerabilidades críticas

## Dependências

Auditar regularmente:

```bash
# Node.js
npm audit
npm audit fix

# Python
pip audit
safety check
```
