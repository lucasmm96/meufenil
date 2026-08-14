# API Route — /api/keepalive

**Última verificação:** 2026-08-13 (commit 6323664)
**Código:** `api/keepalive.ts` — função Vercel serverless (Node)

## Propósito

Manter os projetos Supabase gratuitos fora do estado de pausa por inatividade: executada diariamente, faz uma leitura mínima na tabela `public.usuarios` do banco do ambiente atual e persiste o resultado da execução em `background_job_executions`.

## Trigger e cron

- Vercel Cron: `0 12 * * *` UTC (≈09:00 America/Sao_Paulo em horário normal) — declarado em `vercel.json` `[CONFIRMED: configuration — vercel.json]`.
- Handler Node-style (`(req, res) => void`), export default `[CONFIRMED: code — api/keepalive.ts:148]`.

## Ambientes e alvos

- Ambiente da execução: `VERCEL_ENV === "production"` → `prod`; caso contrário → `dev` `[CONFIRMED: code — api/keepalive.ts:46-48]`.
- **Um único alvo por execução** (o banco do ambiente atual):
  - prod → label `meufenil`, env `prod` (credenciais: `KEEPALIVE_SUPABASE_URL`/`KEEPALIVE_SUPABASE_SERVICE_ROLE_KEY`, fallback `VITE_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`)
  - dev → label `meufenil-dev`, env `dev` (credenciais: `KEEPALIVE_DEV_*`, mesmo fallback) `[CONFIRMED: code — api/keepalive.ts:50-72]`
- **Divergência factual:** o README descreve que a rota acessa os DOIS bancos por execução e que `200` indica sucesso em ambos; o código atual (e o teste) executam ping em UM único alvo por execução, respondendo com `projects: [projeto]` (array de 1 elemento) `[CONFIRMED: code — api/keepalive.ts:158-166,193; test — api/keepalive.test.ts; documentation — README.md]`.

## Sequência de execução

1. Método: apenas `GET` e `HEAD`; caso contrário `405` + `Allow: GET, HEAD` `[CONFIRMED: code]`.
2. Gera `runId = crypto.randomUUID()`.
3. `pingProject(target)`: cria cliente supabase-js com **service role** (`autoRefreshToken: false`, `persistSession: false`), executa `SELECT id FROM usuarios LIMIT 1`, mede `elapsedMs` `[CONFIRMED: code — api/keepalive.ts:83-119]`.
4. `persistProjectExecution`: grava em `background_job_executions` via [background-jobs.md](background-jobs.md) (`job_key = "keepalive"`, `status = success|failure`, `details = { target, table: "usuarios", operation: "select", limit: 1 }`). **Falha na persistência é logada e NÃO altera a resposta** (o resultado do ping manda) `[CONFIRMED: code — api/keepalive.ts:121-146,168-175]`.
5. Resposta: `200` se o ping ok, `500` se falhou — corpo `{ ok, runId, durationMs, projects: [projeto] }`, `Cache-Control: no-store` `[CONFIRMED: code]`.
6. Falha inesperada (ex.: env ausente): `500` com `{ ok: false, error: mensagem }` `[CONFIRMED: code — api/keepalive.ts:195-203]`.

## Autenticação / autorização

- Nenhuma autenticação na rota em si (não valida Bearer nem signature de cron) `[CONFIRMED: code]`.
- Acesso ao banco via service role (bypassa RLS) — leitura de 1 linha de `usuarios` e INSERT em `background_job_executions` `[CONFIRMED: code, database]`.
- RLS de `background_job_executions` não possui policies de INSERT — apenas o canal service role grava (ver [../database/background_job_executions.md](../database/background_job_executions.md)) `[CONFIRMED: database]`.

## Tratamento de erros

- Erro no ping → resultado `{ ok: false, error: message }` e status `500` `[CONFIRMED: code]`.
- Erro na persistência → `console.error` `[keepalive] failed to persist ...` e execução continua `[CONFIRMED: code]`.
- Env ausente → exceção `Missing environment variable: ...` → `500` `[CONFIRMED: code]`.
- Não há retries nem timeout explícitos no código `[CONFIRMED: ausência — code]`.

## Logging

- `console.info`: início de execução, início/fim de ping com `elapsedMs`, fim da execução com status `[CONFIRMED: code]`.
- `console.error`: falha de ping, falha de persistência, falha inesperada `[CONFIRMED: code]`.
- Persistência estruturada em `background_job_executions` (ver [background-jobs.md](background-jobs.md)).

## Relação com background_job_executions

Cada execução gera UMA linha na tabela do banco alvo, com `job_key = "keepalive"`, `environment = prod|dev`, `run_id` único, status e tempos — a coluna `status` usa o enum `background_job_status` (`success`/`failure`/`partial`; o keepalive só usa success/failure) `[CONFIRMED: code, database]`. Retenção de 365 dias via trigger `[CONFIRMED: migration]`.

## Testes

`api/keepalive.test.ts` — unitário com mocks de `createClient` e `recordBackgroundJobExecution`; 4 cenários: ambiente prod (VERCEL_ENV=production), ambiente dev, persistência falha sem bloquear, erro principal → 500 `[CONFIRMED: test — api/keepalive.test.ts:51-164]`.

## Evidências

- E1 — Código completo: `api/keepalive.ts` `[CONFIRMED: code]`
- E2 — Teste: `api/keepalive.test.ts` `[CONFIRMED: test]`
- E3 — Cron e rewrite: `vercel.json` `[CONFIRMED: configuration]`
- E4 — Histórico: `c9a385c` (implementação), `87aa0ff` (logging), `879a6c0` (environment-aware), `930de1b` (testes) `[CONFIRMED: git history]`
- E5 — Divergência README × código (1 alvo × 2 bancos) `[CONFIRMED: code × documentation]`

## Veja também

- [background-jobs.md](background-jobs.md), [overview.md](overview.md)
- [../database/background_job_executions.md](../database/background_job_executions.md), [../database/triggers.md](../database/triggers.md)
- [../security/secrets-and-environments.md](../security/secrets-and-environments.md)
