# API Route — /api/keepalive

**Última verificação:** 2026-08-23 (DEBT-0006)
**Código:** `api/keepalive.ts` — função Vercel serverless (Node)

## Propósito

Manter os projetos Supabase gratuitos fora do estado de pausa por inatividade: executada diariamente, faz uma leitura mínima na tabela `public.usuarios` dos **dois** bancos (produção e dev) por execução e persiste o resultado de cada alvo em `background_job_executions` do respectivo banco.

## Trigger e cron

- Vercel Cron: `0 12 * * *` UTC (≈09:00 America/Sao_Paulo em horário normal) — declarado em `vercel.json` `[CONFIRMED: configuration — vercel.json]`.
- Handler Node-style (`(req, res) => void`), export default `[CONFIRMED: code — api/keepalive.ts]`.

## Ambientes e alvos

- **Dois alvos por execução** (independente de `VERCEL_ENV`):
  - prod → label `meufenil`, env `prod` (credenciais: `KEEPALIVE_SUPABASE_URL`/`KEEPALIVE_SUPABASE_SERVICE_ROLE_KEY`, fallback `VITE_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_URL`)
  - dev → label `meufenil-dev`, env `dev` (credenciais: `KEEPALIVE_DEV_SUPABASE_URL`/`KEEPALIVE_DEV_SUPABASE_SERVICE_ROLE_KEY` — **obrigatórias, sem fallback**; ver "Endurecimento" abaixo) `[CONFIRMED: code — api/keepalive.ts resolveKeepaliveTargets]`
- **Endurecimento (DEBT-0006, 2026-08-23):** o alvo dev exige as próprias variáveis — o fallback histórico apontaria para `VITE_SUPABASE_URL`/`SUPABASE_URL` (banco de PRODUÇÃO) e gravaria linhas `environment = 'dev'` no banco errado; env dev ausente → `500` explícito `[CONFIRMED: code — api/keepalive.ts]`.
- **Histórico:** `879a6c0` (2026-08-11, release v1.6.0) trocou o multi-alvo por alvo único resolvido por `VERCEL_ENV` — regressão que deixou o ambiente dev sem keepalive; DEBT-0006 (2026-08-23) restaurou o multi-alvo `[CONFIRMED: git — api/keepalive.ts@879a6c0, api/keepalive.ts@879a6c0^]`.

## Sequência de execução

1. Método: apenas `GET` e `HEAD`; caso contrário `405` + `Allow: GET, HEAD` `[CONFIRMED: code]`.
2. Gera `runId = crypto.randomUUID()` e resolve os DOIS alvos (prod + dev) `[CONFIRMED: code]`.
3. `pingProject(target)` por alvo em `Promise.allSettled`: cria cliente supabase-js com **service role** (`autoRefreshToken: false`, `persistSession: false`), executa `SELECT id FROM usuarios LIMIT 1`, mede `elapsedMs` — falha de um alvo não impede o outro `[CONFIRMED: code — api/keepalive.ts]`.
4. `persistProjectExecution` por alvo no **banco do próprio alvo** (mesmo `runId`): grava em `background_job_executions` via [background-jobs.md](background-jobs.md) (`job_key = "keepalive"`, `status = success|failure`, `details = { target, table: "usuarios", operation: "select", limit: 1 }`). **Falha na persistência é logada e NÃO altera a resposta** (o resultado do ping manda) `[CONFIRMED: code — api/keepalive.ts]`.
5. Resposta: `200` apenas se os DOIS alvos ok; `500` se qualquer alvo falhou (`projects.every`) — corpo `{ ok, runId, durationMs, projects: [prod, dev] }`, `Cache-Control: no-store` `[CONFIRMED: code; decisão OQ-1 do DEBT-0006]`.
6. Falha inesperada (ex.: env dev ausente): `500` com `{ ok: false, error: mensagem }` `[CONFIRMED: code]`.

## Autenticação / autorização

- Nenhuma autenticação na rota em si (não valida Bearer nem signature de cron) `[CONFIRMED: code]`.
- Acesso aos bancos via service role (bypassa RLS) — leitura de 1 linha de `usuarios` e INSERT em `background_job_executions` em cada banco `[CONFIRMED: code, database]`.
- RLS de `background_job_executions` não possui policies de INSERT — apenas o canal service role grava (ver [../database/background_job_executions.md](../database/background_job_executions.md)) `[CONFIRMED: database]`.

## Tratamento de erros

- Erro no ping de um alvo → resultado `{ ok: false, error: message }` para aquele alvo e status `500` (se qualquer alvo falhou) `[CONFIRMED: code]`.
- Erro na persistência → `console.error` `[keepalive] failed to persist ...` e execução continua `[CONFIRMED: code]`.
- Env ausente (inclui `KEEPALIVE_DEV_*` faltando) → exceção `Missing environment variable: ...` → `500` `[CONFIRMED: code]`.
- Não há retries nem timeout explícitos no código `[CONFIRMED: ausência — code]`.

## Logging

- `console.info`: início de execução, início/fim de cada ping com `elapsedMs`, fim da execução com status `[CONFIRMED: code]`.
- `console.error`: falha de ping, falha de persistência, falha inesperada `[CONFIRMED: code]`.
- Persistência estruturada em `background_job_executions` (ver [background-jobs.md](background-jobs.md)).

## Relação com background_job_executions

Cada execução gera DUAS linhas — uma por alvo, no banco de cada alvo — com `job_key = "keepalive"`, `environment = prod|dev`, MESMO `run_id` (agrupa a execução), status e tempos próprios — a coluna `status` usa o enum `background_job_status` (`success`/`failure`/`partial`; o keepalive só usa success/failure) `[CONFIRMED: code, database]`. Retenção de 365 dias via trigger `[CONFIRMED: migration]`.

## Testes

`api/keepalive.test.ts` — unitário com mocks de `createClient` e `recordBackgroundJobExecution`; 5 cenários: dois alvos pingados/persistidos com mesmo runId, env dev ausente → 500, falha parcial (persistência por alvo + 500), falha de persistência não bloqueia, todos os alvos falham `[CONFIRMED: test — api/keepalive.test.ts]`.

## Evidências

- E1 — Código completo: `api/keepalive.ts` `[CONFIRMED: code]`
- E2 — Teste: `api/keepalive.test.ts` `[CONFIRMED: test]`
- E3 — Cron e rewrite: `vercel.json` `[CONFIRMED: configuration]`
- E4 — Histórico: `c9a385c` (implementação), `87aa0ff` (logging), `879a6c0` (regressão 1 alvo), `930de1b` (testes), DEBT-0006 (restauração multi-alvo) `[CONFIRMED: git history]`
- E5 — Decisões DEBT-0006: OQ-1 (500 se qualquer alvo falhar) e endurecimento do alvo dev `[CONFIRMED: spec — archive/implemented/technical-debt/DEBT-0006]`

## Veja também

- [background-jobs.md](background-jobs.md), [overview.md](overview.md)
- [../database/background_job_executions.md](../database/background_job_executions.md), [../database/triggers.md](../database/triggers.md)
- [../security/secrets-and-environments.md](../security/secrets-and-environments.md)
- [ADR-0007](../../decisions/ADR-0007-keepalive-cron-jobs.md)
