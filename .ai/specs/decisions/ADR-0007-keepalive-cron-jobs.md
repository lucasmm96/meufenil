# ADR-0007 — Keepalive diário via Vercel Cron + persistência de execuções

**Status:** Accepted
**Origin:** DOCUMENTED
**Data da decisão:** 2026-08-03 (commit `c9a385c` "feat(keepalive): implement daily keepalive route for Supabase projects"); jobs em 2026-08-06 (`87aa0ff`)
**Reconstruída por engenharia reversa em:** — (não se aplica — DOCUMENTED)

## Context

Para evitar a pausa por inatividade dos projetos Supabase gratuitos, existe a rota `/api/keepalive` (função Vercel) acionada pelo Vercel Cron (`0 12 * * *` UTC), que faz leitura mínima em `usuarios` com service role e persiste cada execução em `background_job_executions` (job_key, run_id, environment, status, tempos, message, details), com retenção de 365 dias por trigger `[CONFIRMED: code, configuration, migration]`. O README documenta o keepalive e a infraestrutura de jobs em seções próprias `[CONFIRMED: documentation]`.

## Decision

Executar o keepalive como função serverless Vercel agendada por cron, com persistência estruturada e reutilizável de execuções de jobs em tabela dedicada.

## Origin

DOCUMENTED — README.md ("Keepalive diário" e "Infraestrutura de jobs") + commits `c9a385c`, `87aa0ff`, `879a6c0`, `930de1b`.

## Evidence

- `README.md` `[CONFIRMED: documentation]`
- `vercel.json` (cron) `[CONFIRMED: configuration]`
- `api/keepalive.ts`, `src/shared/background-jobs.ts` `[CONFIRMED: code]`
- Migrations 20260807/20260810 `[CONFIRMED: migration]`

## Consequences (OBSERVED)

1. Cada execução mantém os DOIS alvos (prod e dev) com o mesmo `run_id` — comportamento original, restaurado pelo DEBT-0006 (2026-08-23) após a regressão `879a6c0` (2026-08-11, release v1.6.0) ter limitado a 1 alvo por execução `[CONFIRMED: code — api/keepalive.ts; git]`.
2. Falha de persistência não bloqueia a resposta do keepalive `[CONFIRMED: code]`.
3. Leitura das execuções restrita a admins (RLS) `[CONFIRMED: database]`.
4. Retenção automática de 365 dias a cada INSERT `[CONFIRMED: migration]`.
5. Contrato reutilizável (`recordBackgroundJobExecution`) usado por apenas UM produtor hoje `[CONFIRMED: code]`.

## Alternatives

Não determinadas a partir das evidências disponíveis.

## Related Specs

- [../current/backend/api-keepalive.md](../current/backend/api-keepalive.md), [../current/backend/background-jobs.md](../current/backend/background-jobs.md), [../current/database/background_job_executions.md](../current/database/background_job_executions.md), [../current/features/FEAT-0013-background-jobs.md](../current/features/FEAT-0013-background-jobs.md)
- [DEBT-0006 — Restaurar keepalive do ambiente dev (regressão 879a6c0)](../../proposed/technical-debt/DEBT-0006-restaurar-keepalive-dev.md)
