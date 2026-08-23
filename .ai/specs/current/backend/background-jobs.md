# Background Jobs — Infraestrutura de execução

**Última verificação:** 2026-08-23 (DEBT-0006)
**Código:** `src/shared/background-jobs.ts` (+ tipos em `src/react-app/services/dtos/background-jobs.dto.ts`)

## Propósito

Infraestrutura reutilizável para registrar execuções de rotinas em background com persistência centralizada em `public.background_job_executions` — hoje usada exclusivamente pelo keepalive (o único job implementado).

## Componentes do mecanismo

| Peça | Onde | Papel |
|---|---|---|
| `recordBackgroundJobExecution(client, input)` | `src/shared/background-jobs.ts` | INSERT na tabela de execuções com mapeamento camelCase → snake_case |
| `BACKGROUND_JOB_STATUSES` / `BackgroundJobStatus` | idem | union `"success" | "failure" | "partial"` (espelha o enum do banco) |
| `BackgroundJobExecutionInput` | idem | contrato de entrada: `runId`, `jobKey`, `environment`, `status`, `startedAt`, `finishedAt`, `durationMs`, `message`, `details?` |
| `public.background_job_executions` | banco | persistência (ver [../database/background_job_executions.md](../database/background_job_executions.md)) |
| `api/keepalive.ts` | Vercel | único produtor atual ([api-keepalive.md](api-keepalive.md)) |
| `background-jobs.service.ts` + `useBackgroundJobsAdmin` | frontend | leitura admin (Fase 5) |

## Lifecycle de uma execução

1. **Início:** o produtor gera `runId` (`crypto.randomUUID()` no keepalive) e mede `startedAt` `[CONFIRMED: code]`.
2. **Execução:** a rotina roda seu trabalho (no keepalive: ping ao banco) `[CONFIRMED: code]`.
3. **Persistência:** `recordBackgroundJobExecution` insere a linha; erro no INSERT lança `Error(message)` para o chamador decidir o tratamento (o keepalive loga e não bloqueia) `[CONFIRMED: code — background-jobs.ts:34-37; api/keepalive.ts]`. No keepalive, uma execução gera **uma linha por alvo** (prod e dev), cada uma no banco do próprio alvo, com o mesmo `run_id` `[CONFIRMED: code — api/keepalive.ts]`.
4. **Status:** `success` | `failure` | `partial` — o keepalive usa apenas success/failure; `partial` existe no enum/contrato mas sem produtor atual que o use `[CONFIRMED: code]`.
5. **Retenção:** trigger `trg_trim_background_job_executions` remove linhas com mais de 365 dias a cada INSERT `[CONFIRMED: migration — ../database/triggers.md]`.
6. **Consulta:** painel admin lê via RLS admin-only (Fase 5) `[CONFIRMED: database, code]`.

## Environment

- O campo `environment` da linha (`prod`/`dev`) é informado pelo produtor — no keepalive, cada execução cobre os DOIS ambientes (uma linha por alvo, mesmo `run_id`) `[CONFIRMED: code — api/keepalive.ts]`.
- No frontend, o rótulo vem de `VITE_APP_ENVIRONMENT`/`import.meta.env.DEV` (`src/react-app/lib/app-environment.ts`) — usado para exibição/consultas `[CONFIRMED: code]`.

## Erros e observabilidade

- O helper não loga nem engole erros: apenas lança `Error(error.message)` do Supabase `[CONFIRMED: code]`.
- Observabilidade efetiva: linhas persistidas (job_key, run_id, status, tempos, message, details jsonb) + logs `console` do produtor (ver [api-keepalive.md](api-keepalive.md)) `[CONFIRMED: code, database]`.

## Testes

- `src/shared/background-jobs.test.ts` — unitário do helper `[CONFIRMED: test]`.
- `api/keepalive.test.ts` — cobre o produtor com o helper mockado `[CONFIRMED: test]`.
- `src/react-app/hooks/useBackgroundJobsAdmin.test.tsx` e `background-jobs.service.test.ts` — lado leitor (Fase 5) `[CONFIRMED: test]`.

## Evidências

- E1 — `src/shared/background-jobs.ts` completo `[CONFIRMED: code]`
- E2 — Tabela/trigger: `../database/background_job_executions.md`, `../database/triggers.md` `[CONFIRMED: database, migration]`
- E3 — Único produtor: grep de `recordBackgroundJobExecution` (2026-08-13) → `api/keepalive.ts` apenas `[CONFIRMED: code]`
- E4 — Testes: `background-jobs.test.ts`, `api/keepalive.test.ts` `[CONFIRMED: test]`

## Veja também

- [api-keepalive.md](api-keepalive.md), [overview.md](overview.md)
- [../database/background_job_executions.md](../database/background_job_executions.md)
- [../security/secrets-and-environments.md](../security/secrets-and-environments.md)
