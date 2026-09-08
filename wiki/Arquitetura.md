# Arquitetura do MeuFenil

Visão arquitetural do **MeuFenil**: uma SPA sem servidor de aplicação próprio, composta por frontend (React/Vite), backend distribuído (Supabase: Postgres/RLS/RPC + Auth + Edge Functions) e duas funções serverless na Vercel (keepalive diário e sincronização semanal de referências). (Fonte: `architecture/overview.md`)

## Sumário

- [Visão geral](#visao-geral)
- [Diagrama de camadas](#diagrama-de-camadas)
- [Frontend (React/Vite)](#frontend-reactvite)
- [Supabase (Postgres + Auth + Edge Functions)](#supabase-postgres--auth--edge-functions)
- [Vercel (keepalive + sincronização)](#vercel-keepalive--sincronizacao)
- [Fluxos de dados](#fluxos-de-dados)
- [Autenticação e autorização](#autenticacao-e-autorizacao)
- [Fronteiras de execução (runtime boundaries)](#fronteiras-de-execucao-runtime-boundaries)
- [Decisões arquiteturais (ADRs)](#decisoes-arquiteturais-adrs)

## Visão geral

- **SPA React 19 + TypeScript strict + Vite + Tailwind**, com React Router 7, Recharts, lucide-react e date-fns(-tz). (Fonte: `frontend/overview.md`)
- **Supabase como BaaS:** autenticação (Google OAuth), PostgREST (consultas com RLS), RPCs de negócio e 2 Edge Functions (Deno). (Fonte: `architecture/overview.md`, `backend/overview.md`)
- **Vercel:** hospedagem da SPA + funções `api/keepalive` (cron diário, `0 12 * * *` UTC) e `api/referencias-sync` (cron semanal, `0 12 * * 1` UTC — sincronização de referências com a origem ANVISA/Power BI, FEAT-0017). (Fonte: `backend/api-keepalive.md`, `backend/api-referencias-sync.md`)
- **Ferramentas locais:** CLI de gestão (`scripts/cli/`), script de migrations (`scripts/apply-supabase-migrations.sh`) e provisionamento do ator Sistema (`scripts/provisionar-ator-sistema.js`). (Fonte: `backend/cli.md`, `backend/api-referencias-sync.md`)
- **Banco (dev pós-FEAT-0017 M1–M6):** PostgreSQL com **12 tabelas** (7 legadas + 5 de sincronização), RLS em todas, **36 políticas** (31 + 5 `admin_select_*`), **15 funções** e **4 triggers** (3 em `public` + 1 em `auth.users`). Prod segue no schema pré-ENH-0004 (7 tabelas / 31 políticas / 10 funções) até a release. (Fonte: `database/overview.md`)

## Diagrama de camadas

```mermaid
flowchart TB
    subgraph Browser
        P[pages/ 9] --> H[hooks/ 15]
        P --> C[components/ + login-as/]
        C --> H
        H --> S[services/ 13 client-side]
        S --> SUP[sdk supabase-js — anon key]
        P --> AU[AuthContext + useUsuarioAtivo]
        H --> AU
    end
    SUP -->|JWT do usuário| PG[(PostgREST → RLS/RPCs → PostgreSQL)]
    S -->|Bearer + POST| ED[Edge Functions: delegar-acesso, delete-account]
    ED -->|service role| PG
    subgraph Vercel
        CRON[Vercel Cron diário 0 12 * * *] --> KEEP[api/keepalive.ts]
        KEEP --> BJ[src/shared/background-jobs.ts]
        CRONW[Vercel Cron semanal 0 12 * * 1] --> SYNC[api/referencias-sync.ts]
        SYNC --> PBI[src/shared/powerbi/ — extração/validação]
        SYNC --> MOT[src/shared/referencias-sync/ — motor puro]
    end
    KEEP -->|service role| PG
    SYNC -->|service role| PG
    PG --> TAB[(12 tabelas + 4 triggers + 15 funções — dev pós-FEAT-0017 M1–M6)]
```

Todas as arestas são confirmadas por código/configuração. (Fonte: `architecture/overview.md`, `backend/overview.md` — diagramas validados nas Fases 4–5 e pós-FEAT-0017)

## Frontend (React/Vite)

- **Camadas internas:** `pages → hooks → services → lib/supabase`; 1 hook de dados por página (`useX(usuarioId?)` retornando `{ data, loading, error, ações }`); exceção Admin (3 hooks, incluindo `useReferenciasSyncAdmin` do FEAT-0017 M6); services client-side com DTOs espelhando snake_case; erros `AppError` + `logger`; loading por skeletons (14 componentes). (Fonte: `frontend/overview.md`)
- **9 rotas** (`/`, `/dashboard`, `/referencias`, `/historico`, `/estatisticas`, `/perfil`, `/exames`, `/sobre`, `/admin`) sem proteção no nível de rota — cada página trata autenticação via `AuthContext`/`useUsuarioAtivo`; `/admin` tem gate duplo de papel na UI. (Fonte: `frontend/overview.md` — tabela de rotas)
- **PWA:** `public/manifest.json` (standalone, tema `#6366f1`, ícones 192/512/maskable) — instalável, porém **sem service worker/offline**. (Fonte: FEAT-0014 - PWA; `frontend/overview.md`)
- **Autorização de UI é controle de experiência** — o enforcement é do banco. (Fonte: `security/security-model.md` seção 2)

## Supabase (Postgres + Auth + Edge Functions)

### Banco de dados (Postgres + PostgREST)

- **12 tabelas em dev** (7 legadas + 5 de sincronização do FEAT-0017 M1): `usuarios`, `referencias`, `registros`, `exames_pku`, `referencias_favoritas`, `delegacoes_acesso`, `background_job_executions`, `referencia_syncs`, `referencia_sync_pendencias`, `referencia_eventos`, `referencia_snapshots`, `referencia_backups`. (Fonte: `database/overview.md`)
- **RLS habilitado em todas**; dev pós-FEAT-0017 = **36 políticas** (31 legadas + 5 `admin_select_*` nas tabelas de sync — leitura somente por admin); grants amplos — o RLS é a fronteira de autorização efetiva (ADR-0004). (Fonte: `security/security-model.md` seções 3 e 8; `database/overview.md`)
- **15 funções (RPCs) em dev**, todas SECURITY DEFINER (ADR-0010): negócio (`ativar_referencia`, `remover_ou_desativar_referencia`), sync M4 (`aplicar_sync_referencias` — service_role, `decidir_pendencia_referencia` — admin), recuperação M5 (`pode_operar_recuperacao`, `reverter_sync_referencias`, `restaurar_referencias_de_backup`), admin (`get_estatisticas_admin`), apoio (`is_admin_user`), consulta órfã (`dashboard_hoje`/`dashboard_ultimos_dias`) e funções de trigger (`handle_new_user`, `fn_trim_background_job_executions`, `fn_auditar_is_ativa_manual`, `fn_trim_referencia_backups`). (Fonte: `database/rpc.md`)
- **4 triggers:** retenção de jobs (365 dias), auditoria de mudança manual de `is_ativa`, retenção de backups de sync (12 meses) e criação de perfil no sign-up (`on_auth_user_created`). Os triggers de normalização de nome e de limpeza de favoritos foram eliminados na ENH-0004. (Fonte: `database/triggers.md`)

### Auth (Supabase Auth)

- **Google OAuth:** `signInWithOAuth({ provider: "google", redirectTo: /dashboard })`; a identidade de todas as policies é `auth.uid()`. (Fonte: `security/security-model.md` seção 1; verificado em: `src/react-app/hooks/useUser.ts`)
- **Perfil criado por trigger** (`handle_new_user`) no primeiro acesso, com `role = 'user'`, timezone `America/Sao_Paulo` e limite diário 500 mg (default da coluna). (Fonte: FEAT-0001 - Autenticação; `database/triggers.md`)
- **Ator Sistema** (`sistema@meufenil.local`): identidade real no Supabase Auth (conta banida, sem sessão), autora das criações/arquivamentos automáticos da sincronização — provisionada por `scripts/provisionar-ator-sistema.js`. (Fonte: FEAT-0017; `security/security-model.md` seção 10)

### Edge Functions (Deno)

| Função | Papel | Acesso privilegiado |
|---|---|---|
| `delegar-acesso` | conceder/revogar/assumir delegações (login-as) | service role + validação do Bearer |
| `delete-account` | exclusão de conta (registros → usuarios → auth) | service role + validação do Bearer (`verify_jwt = true`) |

(Fonte: `backend/overview.md` — inventário; `backend/edge-function-delegar-acesso.md`, `backend/edge-function-delete-account.md`)

## Vercel (keepalive + sincronização)

- **`api/keepalive.ts`** (serverless Node) — cron diário `0 12 * * *` UTC (≈09:00 em `America/Sao_Paulo` no horário normal). (Fonte: `backend/api-keepalive.md`; verificado em: `vercel.json`)
  - Fluxo: **dois alvos por execução** (independente de `VERCEL_ENV`): prod (`meufenil`) e dev (`meufenil-dev`) — cada um com as próprias credenciais service role (`KEEPALIVE_*`; o alvo dev exige `KEEPALIVE_DEV_*` obrigatórias, sem fallback — DEBT-0006). Ping `SELECT id FROM usuarios LIMIT 1` por alvo em `Promise.allSettled` → persistência por alvo no banco de cada alvo via `src/shared/background-jobs.ts` (`job_key = "keepalive"`, mesmo `run_id` para os dois, status success/failure, tempos, details). Resposta `200` apenas se os dois alvos ok; `500` se qualquer alvo falhou. (Fonte: `backend/api-keepalive.md`; FEAT-0013)
  - Retenção: trigger remove execuções com mais de 365 dias a cada INSERT. (Fonte: `database/triggers.md`)
- **`api/referencias-sync.ts`** (serverless Node) — cron semanal `0 12 * * 1` UTC (segunda-feira), FEAT-0017. (Fonte: `backend/api-referencias-sync.md`; verificado em: `vercel.json`)
  - Executa a sincronização do conjunto **global** de referências com a origem ANVISA/Power BI em 8 estágios (claim single-flight → extração → validação → snapshot → backup → comparação → aplicação → conclusão), gravando no banco do **deployment em que a rota roda** — `environment` derivado de `VERCEL_ENV` via `ambienteAlvo()` (`production` → `prod`; `preview`/`development`, incl. `vercel dev`, → `dev`; revisão R4-1, 2026-09-08). A execução **manual** (POST, admin) está disponível em **dev e prod**; o **cron** (GET) só dispara no deployment de produção → alvo sempre `prod`. Extração/validação em `src/shared/powerbi/`; motor puro de comparação em `src/shared/referencias-sync/`; aplicação via RPC `aplicar_sync_referencias` (service role, transação única); divergências viram pendências de curadoria decididas por admin; conclui `success` ou `pending_review`. GET (cron) exige `CRON_SECRET`; POST manual exige JWT de admin. (Fonte: `backend/api-referencias-sync.md`; `security/secrets-and-environments.md`; FEAT-0017)

## Fluxos de dados

| Fluxo | Caminho | Fonte |
|---|---|---|
| Autenticação | Browser → Supabase Auth (OAuth Google) → trigger cria perfil em `usuarios` | FEAT-0001; `architecture/overview.md` |
| Registro de consumo | UI calcula fenilalanina → PostgREST INSERT (RLS dono/delegado + referência ativa) | FEAT-0003; `database/registros.md` |
| Referências | UI → PostgREST (CRUD) / RPCs `ativar_referencia` e `remover_ou_desativar_referencia` (globais sempre arquivam desde a ENH-0004) | FEAT-0008; `database/rpc.md` |
| Exames PKU | UI → PostgREST (RLS dono/delegado) | FEAT-0009; `database/exames_pku.md` |
| Delegação (login-as) | UI → edge function `delegar-acesso` (Bearer + service role) → `delegacoes_acesso`; autorização por RLS | FEAT-0011; `security/security-model.md` seção 9 |
| Painel admin | UI → PostgREST/RPC `get_estatisticas_admin` + leitura admin-only das tabelas de sync | FEAT-0012; `database/rpc.md` |
| Keepalive | Vercel Cron diário → service role → ping nos 2 bancos (prod e dev) + persistência por alvo em `background_job_executions` | FEAT-0013; `backend/api-keepalive.md` |
| Sincronização de referências | Vercel Cron semanal (prod) ou POST manual de admin (dev e prod) → `api/referencias-sync` (service role) → extração `src/shared/powerbi/` + motor `src/shared/referencias-sync/` → RPC `aplicar_sync_referencias` → cria/arquiva globais (ator Sistema) + pendências de curadoria; admin decide via `decidir_pendencia_referencia`; recuperação excepcional via `reverter_sync_referencias`/`restaurar_referencias_de_backup` | FEAT-0017; `backend/api-referencias-sync.md`; `database/rpc.md` |
| Exclusão de conta | UI → edge function `delete-account` (registros → usuarios → auth) | FEAT-0010; `backend/edge-function-delete-account.md` |

## Autenticação e autorização

- **Autenticação:** Google OAuth via Supabase Auth; sessão gerenciada pelo SDK (`getSession()` + `onAuthStateChange`); identidade = `auth.uid()`. (Fonte: `security/security-model.md` seção 1)
- **Autorização (modelo RLS):** papéis `user`/`admin` em `usuarios.role`; ownership por coluna de dono; delegação via `delegacoes_acesso` ativa (`revoked_at IS NULL`) consumida por 15 policies e 2 RPCs; admin via `is_admin_user` (ou claim JWT em policies de `referencias`); recuperação de sync exige admin **E** `usuarios.pode_recuperacao` (helper `pode_operar_recuperacao` — M5). (Fonte: `security/security-model.md` seções 1–3)
- **Login-as NÃO troca token:** "assumir perfil" é estado de UI em `sessionStorage` (`meufenil:login-as`); a autorização do usuário assumido é exercida pelas policies/RPCs via `delegacoes_acesso` — sem impersonação de JWT (ADR-0005). (Fonte: `security/security-model.md` seção 1; `backend/edge-function-delegar-acesso.md`)
- **RPCs sensíveis:** `SECURITY DEFINER` com verificação interna dono/delegado/admin (ADR-0010). RPCs de sync com grants seletivos: `aplicar_sync_referencias` exclusiva `service_role`; curadoria e recuperação exclusivas de `authenticated` com guardas internas (admin / admin + flag). (Fonte: `database/rpc.md`; `security/security-model.md` seção 10)
- **Service role:** bypass de RLS somente server-side (edge functions, rotas Vercel e CLI com flags explícitas); a chave nunca fica no bundle do browser. (Fonte: `architecture/overview.md` — runtime boundaries; `security/secrets-and-environments.md`)

## Fronteiras de execução (runtime boundaries)

| Fronteira | Natureza | Enforcement |
|---|---|---|
| Browser × servidor | sem app server — tudo server-side é BaaS/edge | — |
| Não autenticado × autenticado | RLS (anon vê só referências globais) | banco |
| Usuário × Admin | `usuarios.role` + `is_admin_user`/claim JWT | banco + gate de UI |
| Dono × Delegado | `delegacoes_acesso` ativa | banco (15 policies + 2 RPCs) |
| Usuário × Ator Sistema | ator Sistema é conta banida, sem sessão — usado apenas pelas escritas automáticas da sync | banco (RPCs service_role) |
| Admin × recuperação | `usuarios.pode_recuperacao` (admin E flag; concedida manualmente) | banco (RPCs M5) |
| anon/authenticated × service_role | bypass de RLS apenas server-side | segredo service role fora do browser |
| Supabase × Vercel | rotas Vercel (keepalive, referencias-sync) → Supabase via service role | envs Vercel |
| DEV × PROD | bancos distintos; keepalive pinga os dois por execução; sync grava no banco do deployment (`ambienteAlvo()`/`VERCEL_ENV`; cron prod-only); labels `dev`/`prod` | envs |

(Fonte: `architecture/overview.md` — runtime boundaries; `security/security-model.md`)

## Decisões arquiteturais (ADRs)

As decisões formais estão em `.ai/specs/decisions/` (Fonte: `architecture/overview.md` — índice arquitetural):

| ADR | Decisão |
|---|---|
| ADR-0001 / ADR-0008 | Supabase como BaaS; sem servidor de aplicação próprio |
| ADR-0002 | SPA React + Vite + Tailwind |
| ADR-0003 | Google OAuth |
| ADR-0004 | RLS como enforcement de autorização |
| ADR-0005 | Delegação login-as sem troca de token |
| ADR-0006 | Soft delete de referências via `is_ativa` (desde a ENH-0004: globais sempre arquivadas, favoritos preservados) |
| ADR-0007 | Keepalive cron com persistência própria |
| ADR-0009 | Migrations via Supabase CLI |
| ADR-0010 | RPCs SECURITY DEFINER para operações sensíveis |
| ADR-0011 | Testes de segurança com autenticação real (Abordagem B) |
| ADR-0012 | Spec-driven + operações GitHub (Spec → Issue → PR → Release) |
| ADR-0013 | Fluxos automáticos determinísticos sem IA (resposta estática de issues externas W3; gate de produção W7) |

**Padrões observados** (sem ADR formal): camadas hooks→services no frontend; soft delete via coluna de estado; background job com persistência própria; job de sincronização com tabela própria (`referencia_syncs`), fora do trim de 365 dias da BR-027. (Fonte: `architecture/overview.md` — architectural patterns; FEAT-0013)
