# MEIFlow

> Sistema completo de gestão financeira, fiscal e administrativa para o Microempreendedor Individual (MEI) brasileiro.

## 🎯 Sobre o Projeto

**MEIFlow** é um app mobile (Android + iOS) que combina:

- **Gestão Financeira** — receitas, despesas, fluxo de caixa, conciliação bancária
- **Automação Fiscal** — DAS, DASN-SIMEI, NFS-e, calendário fiscal
- **Dashboard Administrativo** — métricas, alertas, visão geral do negócio
- **Assistente IA Pessoal** — agente autônomo que orienta, executa ações fiscais e dá recomendações financeiras
- **Agente IA de Atendimento** — atende os clientes do negócio do MEI via WhatsApp (Evolution Go)
- **Oportunidades** — crédito, licitações, monitoramento de legislação

## 🏗️ Arquitetura

```
apps/mobile/          → Expo (React Native) — TypeScript
services/ai-service/  → Python (FastAPI + LangGraph)
supabase/             → Supabase (PostgreSQL, Auth, Edge Functions, Storage)
```

Detalhes completos em [`docs/architecture/README.md`](docs/architecture/README.md).

## 🛠️ Tech Stack

| Camada | Tecnologia |
|--------|-----------|
| Mobile | Expo SDK 52+, TypeScript strict, Expo Router |
| Estado | Zustand, React Hook Form, Zod |
| DB Local | WatermelonDB (offline-first) |
| Backend | Supabase (Auth, PostgreSQL + RLS, Storage, Edge Functions, Realtime) |
| IA | Python 3.12, FastAPI, LangGraph, OpenAI GPT-4o, Claude (fallback) |
| WhatsApp | Evolution Go |
| Pagamentos | Asaas |
| Mapas | Google Maps SDK + Google Places API |

## 📋 Pré-requisitos

- **Node.js** ≥ 22.x (LTS)
- **Python** ≥ 3.12
- **Docker** + Docker Compose
- **Expo CLI** (`npm install -g expo-cli`)
- **EAS CLI** (`npm install -g eas-cli`)
- **Git** ≥ 2.40
- Conta no [Supabase](https://supabase.com)
- Conta no [Expo](https://expo.dev)

## 🚀 Setup Local

### 1. Clonar e instalar

```bash
git clone <repo-url> MEIFlow
cd MEIFlow

# Mobile
cd apps/mobile
npm install

# AI Service
cd ../../services/ai-service
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
```

### 2. Configurar variáveis de ambiente

```bash
# Copiar templates
cp apps/mobile/.env.example apps/mobile/.env
cp services/ai-service/.env.example services/ai-service/.env

# Preencher com suas credenciais (ver .env.example para instruções)
```

### 3. Subir serviços

```bash
# Redis + AI Service
docker compose up -d

# App mobile (Expo)
cd apps/mobile
npx expo start
```

### 4. Verificar

```bash
# Saúde da API
curl http://localhost:8000/health

# Auditoria de código
npm run audit:all
```

## 📁 Estrutura do Projeto

```
MEIFlow/
├── apps/
│   └── mobile/              # Expo app (TypeScript)
│       ├── app/             # Expo Router (file-based routing)
│       ├── components/      # UI components por módulo
│       ├── database/        # WatermelonDB schemas e sync
│       ├── hooks/           # Custom hooks
│       ├── services/        # Supabase client, API calls
│       ├── stores/          # Zustand stores
│       ├── theme/           # Design tokens (cores, tipografia)
│       ├── types/           # TypeScript types (gerados + manuais)
│       └── utils/           # Helpers, formatters, validators
│
├── services/
│   └── ai-service/          # Python AI Service
│       ├── app/             # FastAPI app + routes
│       ├── agents/          # LangGraph agents
│       │   ├── assistant/   # Assistente pessoal MEI
│       │   └── customer/    # Agente atendimento clientes
│       ├── tools/           # Ferramentas dos agentes
│       ├── integrations/    # Clientes APIs externas
│       └── Dockerfile
│
├── supabase/
│   ├── migrations/          # SQL migrations
│   ├── functions/           # Edge Functions (Deno/TypeScript)
│   └── seed.sql             # Dados de teste
│
├── docs/
│   ├── architecture/        # ADRs, diagramas, visão geral
│   ├── plans/               # Design docs e planos
│   └── api/                 # Documentação de API
│
├── docker-compose.yml
├── .env.example
├── .gitignore
├── CONTRIBUTING.md
├── SECURITY.md
├── CHANGELOG.md
└── README.md
```

## 🧪 Scripts de Qualidade

```bash
# Auditoria completa
npm run audit:all

# Auditoria individual
npm run audit:duplicates    # Código duplicado (jscpd)
npm run audit:deadcode      # Código morto (knip)
npm run audit:deps          # Dependências não usadas (depcheck)
npm run audit:circular      # Dependências circulares (madge)
npm run audit:lint          # Linting (ESLint)
npm run audit:format        # Formatação (Prettier)

# Testes
npm test                    # Unit + integration
npm run test:coverage       # Com cobertura

# Python AI Service
cd services/ai-service
pytest                      # Unit tests
ruff check .                # Linting Python
ruff format .               # Formatação Python
```

## 📐 Padrões do Projeto

Leia [`CONTRIBUTING.md`](CONTRIBUTING.md) para detalhes completos. Resumo:

- **TypeScript strict** — sem `any`, sem `@ts-ignore`
- **ESLint + Prettier** — enforced via pre-commit hooks (Husky)
- **Conventional Commits** — `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`
- **Code Review** — PRs obrigatórios, mínimo 1 aprovação
- **DRY, YAGNI, KISS** — princípios inegociáveis
- **Offline-first** — toda operação deve funcionar sem internet quando possível

## 📄 Licença

Proprietário — todos os direitos reservados. Ver [`LICENSE`](LICENSE).
