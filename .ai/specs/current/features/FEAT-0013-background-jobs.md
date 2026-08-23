# Feature Spec: Background jobs (keepalive + infraestrutura)

**ID:** FEAT-0013
**Tipo:** Current
**Status:** Implementada
**Última verificação:** 2026-08-23 (DEBT-0006)

## Purpose

Infraestrutura server-side de rotinas em background com persistência centralizada de execuções: o único job implementado é o keepalive diário dos projetos Supabase (evita pausa do plano gratuito), monitorado no painel admin.

## Actors

- Vercel Cron (produtor); Admin (consulta)

## Preconditions

- Variáveis de ambiente dos dois alvos (URL + service role) configuradas — prod com fallback, dev obrigatórias `[CONFIRMED: code — api/keepalive.ts]`

## Main Flow

1. Cron `0 12 * * *` UTC aciona `/api/keepalive` (GET/HEAD) `[CONFIRMED: configuration — vercel.json]`.
2. DOIS alvos por execução, independente de `VERCEL_ENV`: prod (`meufenil`) e dev (`meufenil-dev`) `[CONFIRMED: code]`.
3. Ping por alvo (service role, `SELECT id FROM usuarios LIMIT 1`, mede duração) em `Promise.allSettled` — falha de um alvo não impede o outro `[CONFIRMED: code]`.
4. Persistência via `recordBackgroundJobExecution` por alvo (`job_key="keepalive"`, run_id MESMO para os dois, environment, status, tempos, message, details) — falha de persistência loga e NÃO altera a resposta `[CONFIRMED: code]`.
5. Resposta 200 (ambos ok) / 500 (qualquer falha) com `{ok, runId, durationMs, projects:[prod, dev]}` `[CONFIRMED: code; decisão OQ-1 do DEBT-0006]`.
6. Retenção: trigger remove execuções com mais de 365 dias a cada INSERT `[CONFIRMED: migration]`.

## Alternative Flows

- Falha no ping de um alvo → status 500 (se qualquer alvo falhou), persistência do alvo que falhou com `status='failure'` — o outro alvo continua `success` `[CONFIRMED: code]`.
- Status `partial` existe no enum/contrato mas nenhum produtor o usa (fato) `[CONFIRMED: code]`.

## Error Flows

- Env ausente (inclui `KEEPALIVE_DEV_*` faltando) → 500 `{ok:false, error}`; método inválido → 405 `[CONFIRMED: code]`.

## Business Rules

- [BR-027](../domain/business-rules.md)

## Frontend

- N/A (a CONSULTA das execuções vive no painel admin — FEAT-0012) `[CONFIRMED: architecture]`

## Backend

- [api-keepalive](../backend/api-keepalive.md), [background-jobs](../backend/background-jobs.md)

## Database

- [background_job_executions](../database/background_job_executions.md), [triggers](../database/triggers.md)

## Security

- [security-model](../security/security-model.md) (leitura admin-only; escrita service role; sem policies de INSERT)

## Tests

- `api/keepalive.test.ts` (5), `src/shared/background-jobs.test.ts` (3)
- **Coverage status:** PARTIALLY TESTED (trigger de retenção sem teste; execução real não verificada em E2E)

## Dependencies

- Vercel (cron), Supabase (service role)

## Related Features

- [FEAT-0012 Admin](FEAT-0012-painel-administrativo.md) (monitoramento)

## Evidence

- E1 — `api/keepalive.ts`, `src/shared/background-jobs.ts` `[CONFIRMED: code]`
- E2 — Migration 20260807 + vercel.json `[CONFIRMED: migration, configuration]`
- E3 — Regressão "1 alvo por execução" (`879a6c0`, 2026-08-11) corrigida — DEBT-0006 (2026-08-23) restaurou o multi-alvo; o DEBT-0003 (2026-08-15) havia codificado o drift 1-alvo na documentação `[CONFIRMED: git, code × documentation]`

## Unknowns

- Configuração real do painel Vercel (U-3.3).
