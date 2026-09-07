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

O MeuFenil é uma **SPA React 19 + Vite** que fala diretamente com o **Supabase** (PostgREST + Auth + Edge Functions); as peças server-side próprias são duas rotas Vercel — `api/keepalive` (cron diário) e `api/referencias-sync` (cron semanal, FEAT-0017) — e as ferramentas de operação rodam localmente (CLI + script de migrations + provisionamento do ator Sistema). Não há servidor de aplicação próprio. (Fonte: `architecture/overview.md`)

A fonte da verdade da especificação é o **Specification System** em `.ai/specs/` — em divergência factual entre spec e implementação, a implementação vence e a divergência é registrada. (Fonte: `CLAUDE.md`)

## Requisitos

- **Node.js 18+** (npm) — (Fonte: `README.md`, seção "Setup local").
- **Supabase CLI** (devDependency `supabase`) — usada pelo script de migrations (`scripts/apply-supabase-migrations.sh`) (Fonte: `backend/cli.md`).
- **Conta/projeto Supabase** (development e production; 2 ambientes) (Fonte: `database/overview.md`).
- **Vercel** para deploy da SPA + crons (opcional para desenvolvimento local) (Fonte: `backend/api-keepalive.md`, `backend/api-referencias-sync.md`).
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
│   │   ├── features/        # FEAT-0001..0014 e FEAT-0017 (specs de features)
│   │   ├── product/ domain/ frontend/ backend/ database/ security/ testing/
│   └── proposed/            # evoluções futuras (PROPOSED)
├── src/react-app/
│   ├── pages/               # 9 páginas (Home, Dashboard, Referencias, ...)
│   ├── components/          # Layout, AdicionarRegistro, ModalReferencia, ConsentimentoLGPD, login-as/
│   ├── hooks/               # 15 hooks de dados (1 por página; exceção Admin)
│   ├── services/            # 13 services client-side + dtos/
│   ├── lib/                 # supabase.ts (anon), errors.ts (AppError), logger.ts
│   └── context/             # AuthContext
├── src/shared/
│   ├── background-jobs.ts   # persistência de jobs (keepalive e afins)
│   ├── powerbi/             # extração/validação da origem (FEAT-0017 M2/M3)
│   ├── referencias-sync/    # motor puro: canonical/compare/engine (FEAT-0017 M3)
│   └── security/            # testes de segurança (integração real) + test-helpers
├── api/                     # keepalive.ts + referencias-sync.ts (funções Vercel)
├── supabase/
│   ├── migrations/          # migrations versionadas (baseline 20260103015052 → 20260907)
│   └── functions/           # edge functions: delegar-acesso, delete-account
├── scripts/
│   ├── cli/                 # CLI de gestão do banco (5 comandos)
│   ├── apply-supabase-migrations.sh
│   └── provisionar-ator-sistema.js  # ator Sistema (FEAT-0017)
├── public/                  # manifest.json (PWA), ícones
└── vercel.json              # crons + rewrite SPA
```

(Fonte: `frontend/overview.md`, `backend/overview.md`; verificado em: filesystem)

Detalhe das camadas frontend: `pages → hooks → services → lib/supabase`, com DTOs espelhando o snake_case do banco, erros `AppError` + `logger`, loading por skeletons (14 componentes). (Fonte: `frontend/overview.md`)

## Fluxo de desenvolvimento spec-driven

O projeto segue o fluxo **spec-driven** (governança em `.ai/specs/CONVENTIONS.md`, camada operacional ADR-0012):

1. **Proposta:** o pedido vira uma Proposed Spec em `.ai/specs/proposed/` (templates em `.ai/specs/templates/`), com Issue canônica no GitHub e item no Project. Status inicial `PROPOSED`. (Fonte: `proposed/index.md`; ADR-0012)
2. **Aprovação humana:** decisão registrada na proposta (`Decision:` + `Approved by/on:`) → `ACCEPTED`.
3. **Implementação:** em work branch `<tipo>/<id>-<slug>` (ex.: `feature/FEAT-0017-sincronizacao-referencias-anvisa`) criada de `development`; Feature Spec em `.ai/specs/current/features/` viaja no mesmo commit da implementação.
4. **Testes:** comportamento novo exige testes (consulte `current/testing/testing-strategy.md` e os testes existentes antes de criar).
5. **Validação e housekeeping:** PR com `Part of #N` (nunca `Closes`) → aprovação humana → merge em `development` → ACs marcados `IMPLEMENTED` → proposta arquivada em `archive/implemented/<categoria>/` → Issue fechada → System Map atualizado.

**Regras centrais:** nenhuma feature sem specification; nunca tratar `proposed/` como comportamento implementado; divergência factual spec × código nunca é resolvida silenciosamente — registre. (Fonte: `CLAUDE.md` seções 2, 5, 8; ADR-0012)

## Padrões de código

- **Frontend (camadas):** páginas compõem componentes + hooks; hooks de dados com assinatura `useX(usuarioId?)` retornando `{ data, loading, error, ações }`; services finos sobre supabase-js (anon) com mapeamento snake_case → camelCase e `AppError` com código simbólico + mensagem pt-BR. (Fonte: `frontend/overview.md`; verificado em: `src/react-app/hooks/useDashboard.ts`, `src/react-app/services/dashboard.service.ts`)
- **Cálculo de fenilalanina no cliente:** `fenil_mg = (fenil_mg_por_100g × peso_g) / 100` — a UI calcula; o banco armazena o valor informado (Fonte: FEAT-0003 - Registro Diário de Consumo; verificado em: `src/react-app/components/AdicionarRegistro.tsx:94-95`).
- **Timezone:** datas formatadas no timezone do usuário (`usuarios.timezone`, default `America/Sao_Paulo`) via `formatInTimeZone` (Fonte: FEAT-0005 - Dashboard diário; `database/usuarios.md`).
- **Autorização é do banco:** a UI apenas esconde/mostra elementos; o enforcement é RLS/RPCs. (Fonte: `security/security-model.md` seção 2)
- **Identidade de referências (ENH-0004):** modelo canônico com `nome` + `marca` separados (`marca` opcional, `''` = sem marca declarada); identidade imutável de globais `(nome, marca, fenil_mg_por_100g)` — mudar uma global = arquivar a atual + criar a nova (BR-034/BR-037). (Fonte: FEAT-0008; `database/referencias.md`)
- **Backend serverless:** rotas Vercel com camada pura testável separada da camada de infra: keepalive usa `src/shared/background-jobs.ts`; a sincronização (FEAT-0017) usa o motor puro em `src/shared/referencias-sync/` (canonical/compare/engine, sem I/O) + extração em `src/shared/powerbi/`, com o handler `api/referencias-sync.ts` apenas orquestrando. (Fonte: FEAT-0017; `backend/api-referencias-sync.md`)
- **Padrões visuais:** Tailwind com configuração padrão; gradiente indigo→purple em CTAs, cards `bg-white/80 backdrop-blur-sm rounded-2xl`, modais bottom-sheet mobile × central desktop, gráficos Recharts com gradiente `#6366f1 → #9333ea`. Não há design system formal — siga os padrões observados (Fonte: `frontend/overview.md` — seção "Padrões visuais observados").
- **Convenções de commit:** commits lógicos e pequenos; mensagens com prefixo de tipo (`feat:`, `fix:`, `chore:`, `docs:`). Push nunca é automático — aguarde autorização explícita (Fonte: `CLAUDE.md` seção 12).

## Testes

**Stack:** Vitest + Testing Library (jsdom), testes colocalizados (`X.test.ts(x)` ao lado do código); **61 arquivos / 618 testes** na última verificação (2026-09-07); cobertura ~82% statements (medição 2026-08-15; sem threshold configurado); execução serial (`fileParallelism: false`) por causa dos testes de segurança compartilharem o banco development. (Fonte: `testing/testing-strategy.md`)

**Níveis existentes:**

| Nível | Onde | Exemplo |
|---|---|---|
| Unit (shared) | `src/shared/` | `background-jobs.test.ts`; motor de sync: `canonical/compare/engine/validate.test.ts` |
| Service | `services/*.service.test.ts` | mocks do supabase + assertions de `AppError` |
| Hook | `hooks/use*.test.ts(x)` | `renderHook` + mocks |
| Página/Componente | `pages/*.test.tsx`, `components/*.test.tsx` | Admin, Perfil, Referencias, Dashboard, AdicionarRegistro, ConsentimentoLGPD |
| API/Serverless | `api/keepalive.test.ts`, `api/referencias-sync.test.ts` | handler com mocks |
| Segurança (integração real) | `src/shared/security/` | JWTs reais contra o banco **development** (AV.1–7, T1.x, T2.x, T3.x) + suítes de RPC de referências/sync (ativar, remover, `referencias-sync`, rollback, seed) |

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

PostgreSQL (Supabase). **Dev (pós-FEAT-0017 M1–M6):** **12 tabelas**, RLS habilitado em todas, **36 políticas**, **15 funções** e **4 triggers** (3 em `public` + 1 em `auth.users`), **5 enums**. **Prod segue no schema pré-ENH-0004** (sem coluna `marca`, sem as 5 tabelas de sync) até a release v1.11.0. (Fonte: `database/overview.md`)

### Migrations

- **Local atual:** `supabase/migrations/` (Supabase CLI). Baseline `20260103015052_remote_schema.sql`; sequências de 2026-08 (jobs, monitoramento, fix de segurança, baseline de objetos, default do limite diário), **ENH-0004** (`20260904000000` a `20260904040000` — marca + identidade imutável) e **FEAT-0017** (`20260905000000`/`010000`/`020000` — M1: tabelas de sync, auditoria, admin-only; `20260906000000` — M4: aplicação/curadoria; `20260906010000` — M5: rollback/restauração; `20260907000000` — M6: seed `pre_sync_inativa`). Todas as migrations 2026-09 aplicadas **somente em dev**; prod aguarda a release. (Fonte: `database/overview.md` — tabela de migrations; verificado em: `supabase/migrations/`)
- **Legado:** `migrations/` na raiz (`usuarios.sql`, `referencias.sql`, `registros.sql`, `exames_pku.sql`, `dados.sql` — seed ANVISA com 2.959 INSERTs). Snapshot antigo; não contém o estado atual de políticas. (Fonte: `database/overview.md`)
- **Aplicação:** `scripts/apply-supabase-migrations.sh --env development|production` (fluxo: `supabase link` → `migration repair` do baseline → `db push`). Nunca aplique nos dois ambientes na mesma execução. (Fonte: `backend/cli.md`)

### RLS

- RLS é a **fronteira de autorização**: grants amplos para todas as roles; o enforcement vive nas policies (Fonte: `security/security-model.md` seção 8; ADR-0004).
- **Padrões transversais:** ownership (`auth.uid() = coluna_dono`), delegação (`EXISTS delegacoes_acesso ativa`), admin (`is_admin_user` ou claim JWT), visibilidade de referências (`is_global = true OR criado_por = auth.uid()`), invariantes de negócio no RLS (INSERT de registro exige referência ativa; DELETE de referência bloqueado com registros vinculados). (Fonte: `security/security-model.md` seção 8)
- **FEAT-0017:** as 5 tabelas de sync têm somente policies `admin_select_*` (leitura por admin; escritas exclusivamente via RPCs service_role/admin). (Fonte: `database/overview.md`; `security/security-model.md` §11)
- Matriz completa por recurso/operação: `security/security-model.md` seção 3. (Fonte: `security/security-model.md`)

### RPCs

15 funções em `public` em dev; as de negócio usam `SECURITY DEFINER` + `SET search_path TO 'public'` com verificação interna de dono/delegado/admin (ADR-0010):

| RPC | Papel |
|---|---|
| `ativar_referencia(uuid)` | reativa referência — global exige admin desde a ENH-0004/FEAT-0017 M1; usuário comum reativa só pessoais |
| `remover_ou_desativar_referencia(uuid)` | remove (sem registros) ou arquiva/desativa (com registros); globais sempre arquivam (BR-037) |
| `get_estatisticas_admin()` | agregados do painel admin |
| `is_admin_user(uuid)` | apoio de autorização (policies + RPCs) |
| `dashboard_hoje` / `dashboard_ultimos_dias` | RPCs órfãs — sem chamadores no código (agregação é client-side) |
| `aplicar_sync_referencias(...)` | FEAT-0017 M4 — aplica sync em transação única; EXECUTE somente `service_role` |
| `decidir_pendencia_referencia(...)` | FEAT-0017 M4 — curadoria de pendência (admin) |
| `pode_operar_recuperacao(...)` | FEAT-0017 M5 — helper: admin E `usuarios.pode_recuperacao` |
| `reverter_sync_referencias(...)` | FEAT-0017 M5 — rollback seletivo da última sync aplicada (admin E `pode_recuperacao`) |
| `restaurar_referencias_de_backup(...)` | FEAT-0017 M5 — restauração excepcional de backup (admin E `pode_recuperacao`) |

(As funções de trigger `handle_new_user`, `fn_trim_background_job_executions`, `fn_auditar_is_ativa_manual` e `fn_trim_referencia_backups` completam o inventário de 15 — Fonte: `database/rpc.md`; `backend/overview.md`)

### Triggers

Em dev (4): `fn_trim_background_job_executions` (retenção de 365 dias de execuções de job), `trg_auditar_is_ativa_manual` (auditoria de mudança manual de `is_ativa`, FEAT-0017 M1), `trg_trim_referencia_backups` (retenção de 12 meses de backups de sync, FEAT-0017 M1) e `on_auth_user_created` (cria perfil no sign-up). Os triggers `trg_normalizar_nome_referencia` e `trg_remover_favoritos_referencia_inativa` foram **eliminados na ENH-0004** (dev); prod ainda os possui até a release. (Fonte: `database/triggers.md`)

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

- **Ambientes:** 2 bancos Supabase (development/production) — dev recebe as migrations primeiro; prod recebe no trem de release (estrutura diverge entre 2026-09-04 e a release; ver `database/overview.md` §Ambientes). A aplicação roda na **Vercel** (SPA + crons). (Fonte: `database/overview.md`; `security/secrets-and-environments.md`)
- **SPA:** build `npm run build` → deploy Vercel (rewrite SPA em `vercel.json`).
- **Cron keepalive (`api/keepalive.ts`):** `0 12 * * *` UTC → pinga **dois alvos por execução**: prod (`KEEPALIVE_SUPABASE_URL`/`KEEPALIVE_SUPABASE_SERVICE_ROLE_KEY`, com fallback em `VITE_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_URL`) e dev (`KEEPALIVE_DEV_SUPABASE_URL`/`KEEPALIVE_DEV_SUPABASE_SERVICE_ROLE_KEY` — obrigatórias, sem fallback; DEBT-0006); persiste uma linha por alvo em `background_job_executions` (mesmo `run_id`). Responde `200` só se os dois alvos responderem. (Fonte: `backend/api-keepalive.md`; verificado em: `api/keepalive.ts`)
- **Cron de sincronização (`api/referencias-sync.ts`):** `0 12 * * 1` UTC (semanal) — sincroniza o conjunto global de referências (FEAT-0017), alvo **somente prod**. Envs dedicadas: `REFERENCIAS_SYNC_SUPABASE_URL`, `REFERENCIAS_SYNC_SUPABASE_SERVICE_ROLE_KEY` (obrigatórias, sem fallback), `CRON_SECRET` (Bearer do cron; a Vercel envia o header automaticamente quando a env existe) e `POWERBI_RESOURCE_KEY` (resource key pública do relatório Power BI — nunca hardcoded). (Fonte: `backend/api-referencias-sync.md`)
- **Migrations em produção:** via `scripts/apply-supabase-migrations.sh --env production` (exige digitar `PRODUCTION`). Migration/deploy em produção nunca é automático. (Fonte: `backend/cli.md`; `CLAUDE.md` seção 8)
- **Release:** pré-requisito operacional (gate W7, ADR-0013/REF-0004): release de FEAT/ENH exige diff real de documentação — a pasta `wiki/` é atualizada pelo agente wiki-documenter (FEAT-0016) e a wiki pública é sincronizada pelo workflow `sync-wiki.yml` em push para `master` alterando `wiki/**`. (Fonte: `.ai/specs/CONVENTIONS.md` §18.9; verificado em: `.github/workflows/sync-wiki.yml`)
- **Branch model:** work branches de `development`; releases `development → release/vX.Y.Z → master` (PR). (Fonte: `CLAUDE.md` seção 12)

## Como contribuir

1. **Abra uma issue** descrevendo o problema ou a melhoria (ou use uma proposta existente em `.ai/specs/proposed/`). Ao abrir, a issue recebe uma resposta automática informando que o mantenedor avaliará (label `triage`) — sem IA em fluxos automáticos (ADR-0013).
2. Para mudanças de comportamento: siga o fluxo spec-driven (proposta → aprovação → feature spec → work branch). Nenhuma feature sem specification.
3. **Convenções de branch:** `<tipo>/<id>-<slug>` (ex.: `feature/FEAT-0001-autenticacao`) a partir de `development`.
4. **Testes:** toda mudança de comportamento precisa de testes apropriados; rode `npm run test:run` e os testes relevantes.
5. **PR:** aponte para `development`, com `Part of #N` referenciando a Issue canônica. Não altere specs apenas para justificar código; sincronize a documentação no mesmo commit quando o comportamento documentado mudar.
6. **Housekeeping pós-merge:** ACs → `IMPLEMENTED`, proposta para `archive/implemented/`, Issue fechada, System Map atualizado. (Fonte: `CLAUDE.md` seção 5; `CONVENTIONS.md` §18)

> **Segurança e dados:** mudanças em schema, RLS, RPC, autorização, regras de negócio ou contratos externos são HIGH RISK — exigem decisão humana antes da implementação. (Fonte: `CLAUDE.md` seção 7)
