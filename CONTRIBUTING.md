# Guia de Contribuição — MEIFlow

## Princípios Inegociáveis

Estes princípios regem **todo** código do MEIFlow. Sem exceções.

### 1. Consistência

- **Um padrão, sempre.** Se o projeto usa arrow functions, todo novo código usa arrow functions.
- **Prettier + ESLint** decidem formatação. Não discuta estilo — configure a ferramenta.
- **Conventional Commits** — toda mensagem de commit segue o padrão.

### 2. Pureza de Código

- **DRY** — Don't Repeat Yourself. Se algo aparece 2x, extraia para utilitário.
- **YAGNI** — You Ain't Gonna Need It. Não implemente "por precaução".
- **KISS** — Keep It Simple. A solução mais simples que funciona é a correta.
- **Zero `any`** — TypeScript strict. Sem `any`, sem `@ts-ignore`, sem `as unknown as`.
- **Zero `console.log`** — Use logger estruturado. Console.log é bloqueado pelo ESLint.
- **Zero código morto** — Código comentado? Delete. Função não usada? Delete. O git guarda o histórico.

### 3. Performance

- **Measure first** — Não otimize sem medir. Use React DevTools Profiler, Expo Performance Monitor.
- **Lazy loading** — Telas e componentes pesados carregam sob demanda.
- **Memoize com critério** — `useMemo`/`useCallback` apenas quando há re-render mensurável.
- **Bundle size** — Monitore o tamanho do bundle. Imports diretos, nunca `import * from`.
- **Queries otimizadas** — Supabase: selecione apenas colunas necessárias. Sempre paginar.
- **Offline-first** — WatermelonDB para leitura local. Rede é fallback, não dependência.

---

## Setup de Desenvolvimento

### Pré-requisitos

```bash
node --version   # ≥ 22.x
python --version # ≥ 3.12
docker --version # ≥ 24.x
git --version    # ≥ 2.40
```

### Primeira vez

```bash
git clone <repo-url> MEIFlow && cd MEIFlow

# Mobile
cd apps/mobile && npm install && cd ../..

# AI Service
cd services/ai-service
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
cd ../..

# Variáveis de ambiente
cp .env.example .env
# Editar .env com suas credenciais

# Docker (Redis + AI Service)
docker compose up -d
```

---

## Padrões de Código

### TypeScript (Mobile + Edge Functions)

```typescript
// ✅ CORRETO — tipos explícitos, const por padrão, early returns
export const calcularLimiteMEI = (faturamentoAnual: number): LimiteStatus => {
  if (faturamentoAnual < 0) {
    throw new AppError('Faturamento não pode ser negativo');
  }

  const LIMITE_ANUAL = 81_000;
  const percentual = (faturamentoAnual / LIMITE_ANUAL) * 100;

  if (percentual >= 100) return { status: 'excedido', percentual };
  if (percentual >= 80) return { status: 'alerta', percentual };
  return { status: 'normal', percentual };
};

// ❌ ERRADO — any, var, função gigante, sem tipos
function calcular(data: any) {
  var result;
  // ... 80 linhas de lógica misturada ...
  return result;
}
```

### Nomenclatura

| Elemento | Padrão | Exemplo |
|----------|--------|---------|
| Variáveis/funções | camelCase | `calcularDAS`, `faturamentoMensal` |
| Tipos/Interfaces | PascalCase | `Transaction`, `DASRecord` |
| Constantes | UPPER_SNAKE_CASE | `LIMITE_ANUAL_MEI`, `MAX_RETRIES` |
| Arquivos componentes | PascalCase | `DASCard.tsx`, `TransactionList.tsx` |
| Arquivos utilitários | camelCase | `formatCurrency.ts`, `dateUtils.ts` |
| Stores (Zustand) | camelCase + Store | `authStore.ts`, `financialStore.ts` |
| Hooks | use + PascalCase | `useAuth.ts`, `useNetworkStatus.ts` |
| Testes | *.test.ts(x) | `DASCard.test.tsx` |
| Migrations SQL | snake_case com número | `00001_initial_schema.sql` |

### Python (AI Service)

```python
# ✅ CORRETO — tipagem, docstrings, async, snake_case
async def consultar_faturamento(
    user_id: str,
    periodo: PeriodoConsulta,
) -> FaturamentoResponse:
    """Consulta faturamento do MEI no período especificado."""
    if not user_id:
        raise ValueError("user_id é obrigatório")

    transactions = await db.fetch_transactions(user_id, periodo)
    total = sum(t.amount for t in transactions if t.type == "receita")

    return FaturamentoResponse(total=total, count=len(transactions))
```

```python
# Linting e formatação Python
ruff check .        # Linting
ruff format .       # Formatação
ruff check --fix .  # Auto-fix
```

---

## Commits

### Conventional Commits (obrigatório)

```
<tipo>(<escopo>): <descrição curta>

<corpo opcional>

<rodapé opcional>
```

**Tipos permitidos:**

| Tipo | Quando usar |
|------|-----------|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `refactor` | Refatoração sem mudar comportamento |
| `docs` | Apenas documentação |
| `style` | Formatação, sem mudança de lógica |
| `test` | Adicionar ou corrigir testes |
| `chore` | Manutenção, configs, CI |
| `perf` | Melhoria de performance |
| `security` | Correção de segurança |

**Escopos comuns:** `mobile`, `ai-service`, `supabase`, `edge-fn`, `docs`

**Exemplos:**

```bash
git commit -m "feat(mobile): add DAS generation screen with barcode display"
git commit -m "fix(ai-service): prevent prompt injection in assistant agent"
git commit -m "refactor(mobile): extract currency formatter to shared utils"
git commit -m "perf(supabase): add composite index on transactions(user_id, date)"
git commit -m "security(mobile): enable FLAG_SECURE on financial screens"
```

---

## Branches

```
main              → produção (protegido, merge via PR)
develop           → desenvolvimento (integração)
feat/<nome>       → feature branches
fix/<nome>        → bugfix branches
refactor/<nome>   → refatoração
release/<versão>  → preparação de release
```

---

## Pull Requests

### Antes de abrir um PR

```bash
# 1. Auditoria de código
npm run audit:all

# 2. Testes passando
npm test

# 3. Lint sem erros
npm run lint

# 4. Build sem erros
npm run build

# 5. Sem secrets expostos
grep -r "sk-\|sk_live\|password\s*=" apps/ services/ --include="*.ts" --include="*.py"
```

### Template de PR

```markdown
## O que muda
Descrição clara e concisa.

## Por quê
Motivação e contexto.

## Como testar
Passos para verificar.

## Checklist
- [ ] Testes escritos e passando
- [ ] Lint sem erros
- [ ] Sem `any`, `console.log`, ou código comentado
- [ ] RLS policies atualizadas (se tocou em schema)
- [ ] Documentação atualizada (se mudou API/comportamento)
- [ ] Sem secrets no código
```

---

## Auditoria de Qualidade

Execute regularmente (e sempre antes de PRs):

```bash
npm run audit:all
```

Isso roda:
1. **jscpd** — duplicação (meta: < 5%)
2. **knip** — código morto (meta: 0 achados)
3. **depcheck** — dependências não usadas (meta: 0)
4. **madge** — dependências circulares (meta: 0 ciclos)
5. **ESLint** — linting (meta: 0 erros)
6. **Prettier** — formatação (meta: 0 diferenças)

**Qualquer achado deve ser resolvido antes do merge.**
