# DEBT-0006 — Restaurar keepalive do ambiente dev (regressão 879a6c0)

**Type:** DEBT
**Status:** IMPLEMENTED
**Title:** Restaurar keepalive do ambiente dev (regressão 879a6c0)
**Issue:** #40
**Created on:** 2026-08-23
**Approved by:** Lucas Martins Menezes
**Approved on:** 2026-08-23
**Implemented Through:** `api/keepalive.ts` multi-alvo (prod+dev, mesmo runId; alvo dev endurecido) implementado em 2026-08-23 (merge PR #41 — commit `4ac65fa`) · specs atualizadas: `current/backend/api-keepalive.md`, `current/backend/background-jobs.md`, `current/features/FEAT-0013-background-jobs.md`, `current/security/secrets-and-environments.md`, `decisions/ADR-0007` (Consequence 1), `README.md` (seção "Keepalive diário")

## Problem

O keepalive (Vercel Cron → `/api/keepalive`) deixou de registrar execuções no banco do ambiente **dev** desde 2026-08-11, deixando o projeto dev sem a proteção contra pausa por inatividade; o ambiente **prod** continua executando normalmente.

## Current State

- Infraestrutura documentada em [api-keepalive.md](../../current/backend/api-keepalive.md), [background-jobs.md](../../current/backend/background-jobs.md), [FEAT-0013](../../current/features/FEAT-0013-background-jobs.md) e [ADR-0007](../../decisions/ADR-0007-keepalive-cron-jobs.md).
- O handler resolve **um único alvo por execução** via `VERCEL_ENV`: `production` → prod (`KEEPALIVE_SUPABASE_URL`/`KEEPALIVE_SUPABASE_SERVICE_ROLE_KEY`); caso contrário → dev (`KEEPALIVE_DEV_SUPABASE_URL`/`KEEPALIVE_DEV_SUPABASE_SERVICE_ROLE_KEY`) `[CONFIRMED: code — api/keepalive.ts:46-48]`.
- Cron `0 12 * * *` UTC declarado em `vercel.json`; sem alterações no arquivo desde `c9a385c` (2026-08-03) `[CONFIRMED: configuration, git]`.
- **Antes de `879a6c0`** (até 2026-08-10), o handler pingava **os dois alvos em toda execução** (`targets = [meufenil (prod), meufenil-dev (dev)]` com `Promise.allSettled`), persistindo prod e dev com o mesmo `runId` `[CONFIRMED: git — api/keepalive.ts@879a6c0^]`.
- **`879a6c0`** (2026-08-11, "feat(jobs): add environment-aware monitoring", incluído no release v1.6.0) trocou o multi-alvo por alvo único resolvido por `VERCEL_ENV` `[CONFIRMED: git — diff api/keepalive.ts]`.
- A invocação do cron chega ao deployment de **produção** (`environment: production`, `branch: master` — logs Vercel 2026-08-23) `[CONFIRMED: logs do usuário]`; logo, `VERCEL_ENV=production` → o alvo dev é **inalcançável pelo cron** `[INFERRED — Basis: em execução de produção o código resolve sempre `prod`; a ausência de linhas dev desde 2026-08-11 corrobora que o cron não atinge o caminho dev]`.
- Banco dev sem novas linhas em `background_job_executions` (`environment = 'dev'`) desde 2026-08-11 — mesmo dia do commit `[CONFIRMED: consulta direta via CLI local em 2026-08-23 — última linha dev em 2026-08-11T12:38:35, total de 6 linhas]`.
- Sem commits em `api/keepalive.ts`, `src/shared/background-jobs.ts` ou `vercel.json` entre 2026-08-05 e 2026-08-20 `[CONFIRMED: git]`.
- Env vars dev (`KEEPALIVE_DEV_SUPABASE_URL`/`KEEPALIVE_DEV_SUPABASE_SERVICE_ROLE_KEY`) **existem e estão válidas** no painel Vercel `[CONFIRMED: usuário — 2026-08-23]` — elimina causa raiz de configuração de painel.
- Documentação atual documenta "1 alvo por execução" como comportamento vigente (README corrigido pelo [DEBT-0003](../../archive/implemented/technical-debt/DEBT-0003-atualizar-readme.md) e `api-keepalive.md`) — ou seja, codifica a regressão como especificação `[CONFIRMED: docs — README.md, current/backend/api-keepalive.md]`.

## Proposed State

O keepalive volta a manter **ambos os ambientes**: cada execução do cron (em produção) pinga e persiste em prod **e** dev, como no comportamento pré-`879a6c0`, com a documentação sincronizada e testes cobrindo o multi-alvo. Resposta `500` se qualquer alvo falhar (OQ-1); alvo dev com resolução endurecida (exige `KEEPALIVE_DEV_*`, sem fallback para vars de prod) — ver **Decision**.

## Motivation

- **FACTUAL:** `879a6c0` (2026-08-11) removeu o alvo dev da execução única — antes pingava prod+dev; depois, apenas o ambiente resolvido por `VERCEL_ENV` `[CONFIRMED: git]`.
- **FACTUAL:** o cron dispara em produção, onde o código resolve sempre `prod` `[CONFIRMED: logs do usuário 2026-08-23 — environment: production; code — api/keepalive.ts:46-48]`.
- **FACTUAL:** banco dev sem execuções desde 2026-08-11, exatamente a data do commit `[relato do usuário; datas dos commits `[CONFIRMED: git]`]`.
- **FACTUAL:** prod continua executando normalmente (200, `ok meufenil after 895ms`, persistência ok) `[CONFIRMED: logs do usuário — 2026-08-23]`.
- **ASSUMPTION:** a regressão é do código (commit) e não de configuração de painel — apoiada pela existência/validade das env vars dev e pela ausência de commits relacionados no período `[ASSUMED — não verificável pelo repositório: configurações de painel são UNKNOWN]`.
- **ASSUMPTION:** sem o keepalive dev, o projeto Supabase dev pode entrar em estado de pausa por inatividade (plano free) — risco operacional da não-correção `[ASSUMED]`.

## Evidence

- Solicitação do usuário (draft `proposed/draft/003-corrigir-keep-alive.md`, 2026-08-23) com logs da Vercel (invocação e JSON de função, prod).
- `git log` — histórico de `api/keepalive.ts`, `src/shared/background-jobs.ts`, `vercel.json` (2026-08-05 a 2026-08-20) e diff de `879a6c0`/`879a6c0^`.
- Specs `current/`: `backend/api-keepalive.md`, `backend/background-jobs.md`, `security/secrets-and-environments.md`, ADR-0007.

## Scope

- Restaurar o multi-alvo no handler `api/keepalive.ts` (ping + persistência em prod e dev por execução), conforme direção indicada pelo usuário.
- Sincronizar a documentação afetada (README, `current/backend/api-keepalive.md`, `current/backend/background-jobs.md`, `current/security/secrets-and-environments.md` §2; revisar Consequence 1 do ADR-0007).
- Testes unitários do multi-alvo em `api/keepalive.test.ts`.
- Validação observável: execuções `environment = 'dev'` retornando ao banco dev.

## Out of Scope

- Cron/disparo dedicado para deployments não-produção (depende de suporte da plataforma — ver Alternatives).
- Mudanças de schema/migrations.
- Outras capabilities ou regressões além do keepalive.

## Impacted Features

- [FEAT-0013 — Background jobs](../../current/features/FEAT-0013-background-jobs.md)

## Impacted Business Rules

- N/A

## Impacted Architecture

- [ADR-0007 — Keepalive diário via Vercel Cron](../../decisions/ADR-0007-keepalive-cron-jobs.md) (Consequence 1 — "um alvo por execução" — será revisitada caso a proposta seja aceita)
- [Architecture overview](../../current/architecture/overview.md) (infra Vercel)

## Impacted Frontend / Backend / Database / Security / Tests

- **Backend:** `api/keepalive.ts`, `src/shared/background-jobs.ts` (helper reutilizável — sem mudança prevista) — [background-jobs.md](../../current/backend/background-jobs.md), [api-keepalive.md](../../current/backend/api-keepalive.md)
- **Security:** env vars dev voltam a ser alvo real de execução — [secrets-and-environments.md](../../current/security/secrets-and-environments.md) §2 e §5
- **Database:** nenhuma mudança de schema; `background_job_executions` volta a receber linhas `environment = 'dev'`
- **Tests:** `api/keepalive.test.ts` (novos cenários multi-alvo)
- **Frontend:** N/A (painel admin apenas lê; voltará a exibir execuções dev)

## Dependencies

Nenhuma.

## Risks

- **Semântica de resposta com multi-alvo:** falha em um alvo deve ou não tornar a resposta 500? (comportamento pré-`879a6c0`: `ok = projects.every(...)` — 500 se qualquer alvo falhar) — decisão registrada em Open Questions.
- **Fallback de env perigoso (latente):** se `KEEPALIVE_DEV_*` forem removidas no futuro, o fallback (`VITE_SUPABASE_URL`/`SUPABASE_URL`) aponta para **prod** — uma execução "dev" pingaria prod e gravaria `environment = 'dev'` no banco de produção. **MITIGADO na aprovação (2026-08-23):** a resolução do alvo dev foi endurecida — exige `KEEPALIVE_DEV_*` (throw se ausentes), sem fallback para vars de prod; conseqüência: execuções em deployments sem as vars dev retornam `500` explícito em vez de poluir o banco errado.
- **Projeto Supabase dev possivelmente inativo:** sem keepalive desde 2026-08-11, o projeto dev pode ter entrado em estado de pausa por inatividade; primeira execução pós-fix pode falhar até reativação manual `[ASSUMED]`.
- **Exposição de secrets:** a execução em produção carrega as duas service role keys (prod e dev) — mesmo estado de exposição do período pré-`879a6c0`, sem agravamento `[CONFIRMED: code — api/keepalive.ts]`.

## Alternatives

1. **Multi-alvo por execução (direção indicada pelo usuário):** restaurar o comportamento pré-`879a6c0` — cada execução pinga e persiste prod e dev; mudança localizada em `api/keepalive.ts`; sem dependência de plataforma.
2. **Disparo dedicado para o deployment dev:** segundo cron/source apontando para a URL do deployment dev — depende de suporte do Vercel Cron para deployments não-produção, não confirmado `[UNKNOWN — Evidence Needed: documentação da plataforma]`.
3. **Disparo externo agendado (ex.: GitHub Actions / serviço externo) chamando a URL do deployment dev:** adiciona peça de infraestrutura fora da Vercel; o deployment dev precisa de URL estável.
4. **Manter o status quo (1 alvo por execução):** dev permanece sem keepalive — contraria o objetivo da proposta (não recomendado).

**Decision:** Alternativa 1 — multi-alvo por execução (restauração do comportamento pré-`879a6c0`, com endurecimento). Detalhes decididos na aprovação (2026-08-23): (i) OQ-1 → resposta `500` se qualquer alvo falhar (`projects.every`, comportamento pré-`879a6c0`); (ii) alvo dev exige `KEEPALIVE_DEV_SUPABASE_URL`/`KEEPALIVE_DEV_SUPABASE_SERVICE_ROLE_KEY` sem fallback para vars de prod (Risks — endurecimento). **Approved by:** Lucas Martins Menezes · **Approved on:** 2026-08-23

## Open Questions

1. **Semântica de resposta com multi-alvo:** com falha parcial (um alvo ok, outro não), a resposta deve ser 200, 500 ou com corpo indicando o estado por alvo? **RESOLVIDA (2026-08-23, autor):** `500` se qualquer alvo falhar (`projects.every` — comportamento pré-`879a6c0`); persistência por alvo permanece independente da resposta (AC-4).
2. **Estado do projeto Supabase dev:** está ativo (não pausado por inatividade)? **RESOLVIDA (2026-08-23):** projeto dev ATIVO — respondeu à consulta de leitura via CLI local (SELECT em `background_job_executions`), não está pausado.
3. **Confirmação da observação:** consulta ao banco dev (`SELECT` em `background_job_executions` com `environment = 'dev'` e `started_at >= 2026-08-11`) para evidenciar formalmente a ausência de execuções — evidência forte para a Issue/PR. **RESOLVIDA (2026-08-23):** consulta direta confirma ausência desde `2026-08-11T12:38:35` (última linha dev; tabela dev com 6 linhas no total); prod continua com execuções regulares `success` (ex.: 2026-08-23T12:14, 2026-08-22) — evidência anexada à Issue/PR.

## Acceptance Criteria

1. Cada execução do cron pinga e persiste em **prod e dev** — verificável por linhas em `background_job_executions` dos dois bancos com o mesmo `runId` por execução (comportamento pré-`879a6c0`). **Validação:** teste unitário "pinga e persiste nos dois alvos com o mesmo runId"; confirmação operacional no cron de 2026-08-24 12:00 UTC (pós-merge).
2. O banco dev volta a receber execuções regulares (`environment = 'dev'`, status `success`). **Validação:** código corrigido + evidência de base (ausência desde 2026-08-11T12:38:35 confirmada por consulta); retomada observável no cron de 2026-08-24.
3. Prod sem regressão: execuções continuam `success` e persistidas (`environment = 'prod'`), com a data/runId das execuções pós-fix registrados como evidência. **Validação:** evidência de base prod regular (2026-08-23T12:14, 2026-08-22, ...); runId pós-fix registrado no cron de 2026-08-24.
4. Falha em um alvo não impede a persistência do outro; a resposta segue a semântica decidida na Open Question 1. **Validação:** testes "falha parcial" e "falha na persistência não bloqueia" (500 se qualquer alvo falhar).
5. `api/keepalive.test.ts` cobre o multi-alvo: sucesso em ambos, falha parcial, persistência por alvo. **Validação:** 5 cenários implementados, 5/5 passando (suíte completa 324/324).
6. Documentação sincronizada no mesmo commit: README, `current/backend/api-keepalive.md`, `current/backend/background-jobs.md`, `current/security/secrets-and-environments.md`; ADR-0007 revisado conforme decisão. **Validação:** commit `57c4d68`.

## References

- Draft: `.ai/specs/proposed/draft/003-corrigir-keep-alive.md` (movido para `draft/archive/` na formalização desta spec)
- Logs Vercel fornecidos pelo usuário (2026-08-23): invocação do cron (production, branch master) e JSON de função `/api/keepalive`
- Git: `879a6c0` (environment-aware monitoring), `879a6c0^` (multi-alvo), `c9a385c` (implementação original), `930de1b` (testes), `0eb2e9b` (DEBT-0003 — docs)
- Specs `current/`: `backend/api-keepalive.md`, `backend/background-jobs.md`, `security/secrets-and-environments.md`, `features/FEAT-0013-background-jobs.md`
- [ADR-0007 — Keepalive diário via Vercel Cron](../../decisions/ADR-0007-keepalive-cron-jobs.md)
