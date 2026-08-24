# Guia do Desenvolvedor

Guia de desenvolvimento do **MeuFenil**: requisitos, configuração do ambiente, estrutura do projeto, fluxo spec-driven, padrões, testes, banco de dados, deploy e contribuição. Todas as informações técnicas apontam para as specs canônicas em `.ai/specs/current/` e para o código real do repositório.

## Sumário

- [Visão geral do projeto](#visao-geral-do-projeto)
- [Requisitos](#requisitos)
- [Configuração do ambiente](#configuracao-do-ambiente)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Fluxo de desenvolvimento spec-driven](#fluxo-de-desenvolvimento-spec-driven)
- [Padrões de código](#padroes-de-codigo)
- [Testes](#testes)
- [Banco de dados](#banco-de-dados)
- [Deploy](#deploy)
- [Como contribuir](#como-contribuir)

## Visão geral do projeto

O MeuFenil é uma **SPA React 19 + Vite** que fala diretamente com o **Supabase** (PostgREST + Auth + Edge Functions); a única peça server-side própria é a função Vercel `api/keepalive` (cron diário), e as ferramentas de operação rodam localmente (CLI + script de migrations). Não há servidor de aplicação próprio. (Fonte: `architecture/overview.md`)

A fonte da verdade da especificação é o **Specification System** em `.ai/specs/` — em divergência factual entre spec e implementação, a implementação vence e a divergência é registrada. (Fonte: `CLAUDE.md`)

## Requisitos

- **Node.js 18+** (npm) — (Fonte: `README.md`, seção "Setup local").
- **Supabase CLI** (devDependency `supabase`) — usada pelo script de migrations (`scripts/apply-supabase-migrations.sh`) (Fonte: `backend/cli.md`).
- **Conta/projeto Supabase** (development e production; 2 ambientes) (Fonte: `database/overview.md`).
- **Vercel** para deploy da SPA + cron (opcional para desenvolvimento local) (Fonte: `backend/api-keepalive.md`).
- **Bash** no Windows (Git Bash/WSL) para o script de migrations (o script é `bash`).

## Configuração do ambiente

1. Clone o repositório e instale as dependências:

```bash
git clone <repo>
cd meufenil
npm install
```

2. Crie os arquivos de ambiente `.env.development` e `.env.production` na raiz com as variáveis (nenhum `.env` é versionado — `.env*` está no `.gitignore`) (Fonte: `security/secrets-and-environments.md`):

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_APP_ENVIRONMENT=dev_or_prod
SUPABASE_PROJECT_ID=your_project_id
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_DATABASE_URL=your_database_url
```

> **Segurança:** nunca versione valores reais de secrets. Use placeholders e mantenha os arquivos `.env*` fora do git. (Fonte: `security/secrets-and-environments.md`)

3. Rode a aplicação em desenvolvimento:

```bash
npm run dev
```

4. Para aplicar migrations no banco (nunca nos dois ambientes na mesma execução; produção exige digitar `PRODUCTION`):

```bash
./scripts/apply-supabase-migrations.sh --env development
./scripts/apply-supabase-migrations.sh --env production
```

(Fonte: `backend/cli.md` — seção do script; `database/overview.md` — migrations)

5. Links úteis para o ambiente local: o client Supabase é criado em `src/react-app/lib/supabase.ts` com a anon key; a sessão é gerenciada pelo `AuthContext` (Fonte: `security/security-model.md` seção 1; verificado em: `src/react-app/context/AuthContext.tsx`).

## Estrutura do projeto

```
.meuFenil/
├── .ai/specs/               # Specification System (current/ + proposed/ + decisions/)
│   ├── current/
│   │   ├── system-map.md    # Índice funcional capability → camadas
│   │   ├── architecture/    # overview.md
│   │   ├── features/        # FEAT-0001..0014 (specs de features)
│   │   ├── product/ domain/ frontend/ backend/ database/ security/ testing/
│   └── proposed/            # evoluções futuras (PROPOSED)
├── src/react-app/
│   ├── pages/               # 9 páginas (Home, Dashboard, Referencias, ...)
│   ├── components/          # Layout, AdicionarRegistro, ModalReferencia, ConsentimentoLGPD, login-as/
│   ├── hooks/               # 14 hooks de dados (1 por página)
│   ├── services/            # 12 services client-side + dtos/
│   ├── lib/                 # supabase.ts (anon), errors.ts (AppError), logger.ts
│   └── context/             # AuthContext
├── src/shared/              # background-jobs.ts + security tests (test-helpers)
├── api/                     # keepalive.ts (função Vercel)
├── supabase/
│   ├── migrations/          # migrations versionadas (baseline 20260103015052)
│   └── functions/           # edge functions: delegar-acesso, delete-account
├── scripts/
│   ├── cli/                 # CLI de gestão do banco (5 comandos)
│   └── apply-supabase-migrations.sh
├── public/                  # manifest.json (PWA), ícones
└── vercel.json              # cron + rewrite SPA
```

(Fonte: `frontend/overview.md`, `backend/overview.md`; verificado em: filesystem)

Detalhe das camadas frontend: `pages → hooks → services → lib/supabase`, com DTOs espelhando o snake_case do banco, erros `AppError` + `logger`, loading por skeletons (14 componentes). (Fonte: `frontend/overview.md`)

## Fluxo de desenvolvimento spec-driven

O projeto segue o fluxo **spec-driven** (governança em `.ai/specs/CONVENTIONS.md`, camada operacional ADR-0012):

1. **Proposta:** o pedido vira uma Proposed Spec em `.ai/specs/proposed/` (templates em `.ai/specs/templates/`), com Issue canônica no GitHub e item no Project. Status inicial `PROPOSED`. (Fonte: `proposed/index.md`; ADR-0012)
2. **Aprovação humana:** decisão registrada na proposta (`Decision:` + `Approved by/on:`) → `ACCEPTED`.
3. **Implementação:** em work branch `<tipo>/<id>-<slug>` (ex.: `feature/FEAT-0016-...`) criada de `development`; Feature Spec em `.ai/specs/current/features/` viaja no mesmo commit da implementação.
4. **Testes:** comportamento novo exige testes (consulte `current/testing/testing-strategy.md` e os testes existentes antes de criar).
5. **Validação e housekeeping:** PR com `Part of #N` (nunca `Closes`) → aprovação humana → merge em `development` → ACs marcados `IMPLEMENTED` → proposta arquivada em `archive/implemented/<categoria>/` → Issue fechada → System Map atualizado.

**Regras centrais:** nenhuma feature sem specification; nunca tratar `proposed/` como comportamento implementado; divergência factual spec × código nunca é resolvida silenciosamente — registre. (Fonte: `CLAUDE.md` seções 2, 5, 8; ADR-0012)

## Padrões de código

- **Frontend (camadas):** páginas compõem componentes + hooks; hooks de dados com assinatura `useX(usuarioId?)` retornando `{ data, loading, error, ações }`; services finos sobre supabase-js (anon) com mapeamento snake_case → camelCase e `AppError` com código simbólico + mensagem pt-BR. (Fonte: `frontend/overview.md`; verificado em: `src/react-app/hooks/useDashboard.ts`, `src/react-app/services/dashboard.service.ts`)
- **Cálculo de fenilalanina no cliente:** `fenil_mg = (fenil_mg_por_100g × peso_g) / 100` — a UI calcula; o banco armazena o valor informado (Fonte: FEAT-0003 - Registro Diário de Consumo; verificado em: `src/react-app/components/AdicionarRegistro.tsx:94-95`).
- **Timezone:** datas formatadas no timezone do usuário (`usuarios.timezone`, default `America/Sao_Paulo`) via `formatInTimeZone` (Fonte: FEAT-0005 - Dashboard diário; `database/usuarios.md`).
- **Autorização é do banco:** a UI apenas esconde/mostra elementos; o enforcement é RLS/RPCs. (Fonte: `security/security-model.md` seção 2)
- **Padrões visuais:** Tailwind com configuração padrão; gradiente indigo→purple em CTAs, cards `bg-white/80 backdrop-blur-sm rounded-2xl`, modais bottom-sheet mobile × central desktop, gráficos Recharts com gradiente `#6366f1 → #9333ea`. Não há design system formal — siga os padrões observados (Fonte: `frontend/overview.md` — seção "Padrões visuais observados").
- **Convenções de commit:** commits lógicos e pequenos; mensagens com prefixo de tipo (`feat:`, `fix:`, `chore:`, `docs:`). Push nunca é automático — aguarde autorização explícita (Fonte: `CLAUDE.md` seção 12).

## Testes

**Stack:** Vitest + Testing Library (jsdom), testes colocalizados (`X.test.ts(x)` ao lado do código); 34 arquivos / 197 testes na última verificação; cobertura ~82% statements (sem threshold configurado). (Fonte: `testing/testing-strategy.md`)

**Níveis existentes:**

| Nível | Onde | Exemplo |
|---|---|---|
| Unit (shared) | `src/shared/` | `background-jobs.test.ts` |
| Service | `services/*.service.test.ts` | mocks do supabase + assertions de `AppError` |
| Hook | `hooks/use*.test.ts(x)` | `renderHook` + mocks |
| Página/Componente | `pages/*.test.tsx`, `components/*.test.tsx` | Admin, Perfil, Referencias, Dashboard, AdicionarRegistro, ConsentimentoLGPD |
| API/Serverless | `api/keepalive.test.ts` | handler com mocks (4 cenários) |
| Segurança (integração real) | `src/shared/security/` | JWTs reais contra o banco **development** (AV.1–7, T1.x, T2.x, T3.x) |

(Fonte: `testing/testing-strategy.md` seções 2–4)

**Como executar:**

```bash
npm test              # watch
npm run test:run      # execução única
npm run test:coverage # execução com cobertura
```

Os testes de segurança exigem `SUPABASE_SERVICE_ROLE_KEY` no ambiente (carregado de `.env.development`); sem a variável, as suítes pulam via `describeOrSkip`. Pré-condição: migration de segurança aplicada (`isSecurityMigrationApplied()`). (Fonte: `testing/testing-strategy.md` seções 4–5; `security/security-model.md` seção 12)

**CI:** GitHub Actions (`.github/workflows/ci.yml`) roda lint → `test:run` → build em push/PR. (Verificado em: `.github/workflows/ci.yml`)

## Banco de dados

PostgreSQL (Supabase) com **7 tabelas**, RLS habilitado em todas, **31 políticas**, **10 funções** e **4 triggers** (3 em `public` + 1 em `auth.users`). (Fonte: `database/overview.md`)

### Migrations

- **Local atual:** `supabase/migrations/` (Supabase CLI). Baseline: `20260103015052_remote_schema.sql`; migrations subsequentes `20260807...` a `20260815...` (jobs, monitoramento, segurança RLS/RPC, baseline de objetos não versionados, default de limite diário). (Fonte: `database/overview.md` — tabela de migrations)
- **Legado:** `migrations/` na raiz (`usuarios.sql`, `referencias.sql`, `registros.sql`, `exames_pku.sql`, `dados.sql` — seed ANVISA com 2.958 INSERTs). Snapshot antigo; não contém o estado atual de políticas. (Fonte: `database/overview.md`)
- **Aplicação:** `scripts/apply-supabase-migrations.sh --env development|production` (fluxo: `supabase link` → `migration repair` do baseline → `db push`). Nunca aplique nos dois ambientes na mesma execução. (Fonte: `backend/cli.md`)

### RLS

- RLS é a **fronteira de autorização**: grants amplos para todas as roles; o enforcement vive nas policies (Fonte: `security/security-model.md` seção 8; ADR-0004).
- **Padrões transversais:** ownership (`auth.uid() = coluna_dono`), delegação (`EXISTS delegacoes_acesso ativa`), admin (`is_admin_user`), visibilidade de referências (`is_global = true OR criado_por = auth.uid()`), invariantes de negócio no RLS (INSERT de registro exige referência ativa; DELETE de referência bloqueado com registros vinculados). (Fonte: `security/security-model.md` seção 8)
- Matriz completa por recurso/operação: `security/security-model.md` seção 3. (Fonte: `security/security-model.md`)

### RPCs

10 funções em `public`; as de negócio usam `SECURITY DEFINER` + `SET search_path TO 'public'` com verificação interna de dono/delegado/admin (ADR-0010):

| RPC | Papel |
|---|---|
| `ativar_referencia(uuid)` | reativa referência (dono/delegado/admin) |
| `remover_ou_desativar_referencia(uuid)` | remove ou desativa (soft delete se houver registros vinculados) |
| `get_estatisticas_admin()` | agregados do painel admin |
| `is_admin_user(uuid)` | apoio de autorização (policies + RPCs) |
| `dashboard_hoje` / `dashboard_ultimos_dias` | RPCs órfãs — sem chamadores no código (agregação é client-side) |

(Fonte: `database/rpc.md`; `backend/overview.md`)

### Triggers

`trg_normalizar_nome_referencia` (lower/trim do nome), `trg_remover_favoritos_referencia_inativa` (limpa favoritos ao desativar), `trg_trim_background_job_executions` (retenção de 365 dias) e `on_auth_user_created` (cria perfil no sign-up). (Fonte: `database/triggers.md`)

### CLI Interna

`node scripts/cli/index.js <comando>` (ou `npm run cli -- ...`):

| Comando | Função |
|---|---|
| `list --table T [--limit] [--order]` | SELECT com projeção/ordenação |
| `diag [--table T]` | contagem de linhas |
| `seed-referencia --nome --fenil --criado-por --confirm` | INSERT de referência pessoal |
| `login-oauth [--provider google]` | fluxo OAuth local → salva JWT em `.cli-token` |
| `run-sql --file .cli-sql --confirm --service-role --i-understand-rls` | executa SQL via conexão direta `pg` |

Comandos de escrita exigem `--confirm`; bypass de RLS exige `--service-role --i-understand-rls`. (Fonte: `backend/cli.md`)

### Edge Functions

| Função | Propósito | Autenticação |
|---|---|---|
| `delegar-acesso` | conceder/revogar/listar/assumir/sair de delegações | Bearer + `auth.getUser` com service role |
| `delete-account` | exclusão completa de conta (registros → usuarios → auth) | Bearer (verify_jwt = true no `config.toml`) |

Apenas `delete-account` está declarada no `supabase/config.toml`; a configuração de deploy de `delegar-acesso` é `[UNKNOWN]` (requer acesso ao dashboard). (Fonte: `backend/edge-function-delegar-acesso.md`, `backend/edge-function-delete-account.md`)

## Deploy

- **Ambientes:** 2 bancos Supabase (development/production) com estrutura lógica idêntica; a aplicação roda na **Vercel** (SPA + cron). (Fonte: `database/overview.md` — seção "Ambientes dev × prod"; `security/secrets-and-environments.md`)
- **SPA:** build `npm run build` → deploy Vercel (rewrite SPA em `vercel.json`).
- **Cron keepalive:** `0 12 * * *` UTC aciona `/api/keepalive`, que faz ping no banco do ambiente atual (`VERCEL_ENV`) com service role e persiste a execução em `background_job_executions`. (Fonte: `backend/api-keepalive.md`; verificado em: `api/keepalive.ts`)
- **Migrations em produção:** via `scripts/apply-supabase-migrations.sh --env production` (exige digitar `PRODUCTION`). Migration/deploy em produção nunca é automático. (Fonte: `backend/cli.md`; `CLAUDE.md` seção 8)
- **Branch model:** work branches de `development`; releases `development → release/vX.Y.Z → master` (PR). (Fonte: `CLAUDE.md` seção 12)
- **Wiki pública:** a pasta `wiki/` é sincronizada automaticamente para a wiki do GitHub (workflow `sync-wiki.yml` em push para `master` alterando `wiki/**`). (Verificado em: `.github/workflows/sync-wiki.yml`)

## Como contribuir

1. **Abra uma issue** descrevendo o problema ou a melhoria (ou use uma proposta existente em `.ai/specs/proposed/`). Ao abrir, a issue recebe uma resposta automática informando que o mantenedor avaliará (label `triage`) — sem IA em fluxos automáticos (ADR-0013).
2. Para mudanças de comportamento: siga o fluxo spec-driven (proposta → aprovação → feature spec → work branch). Nenhuma feature sem specification.
3. **Convenções de branch:** `<tipo>/<id>-<slug>` (ex.: `feature/FEAT-0001-autenticacao`) a partir de `development`.
4. **Testes:** toda mudança de comportamento precisa de testes apropriados; rode `npm run test:run` e os testes relevantes.
5. **PR:** aponte para `development`, com `Part of #N` referenciando a Issue canônica. Não altere specs apenas para justificar código; sincronize a documentação no mesmo commit quando o comportamento documentado mudar.
6. **Housekeeping pós-merge:** ACs → `IMPLEMENTED`, proposta para `archive/implemented/`, Issue fechada, System Map atualizado. (Fonte: `CLAUDE.md` seção 5; `CONVENTIONS.md` §18)

> **Segurança e dados:** mudanças em schema, RLS, RPC, autorização, regras de negócio ou contratos externos são HIGH RISK — exigem decisão humana antes da implementação. (Fonte: `CLAUDE.md` seção 7)
