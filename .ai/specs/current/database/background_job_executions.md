# Tabela public.background_job_executions

**Última verificação:** 2026-08-13 (commit 6323664)
**DDL versionado em:** `supabase/migrations/20260807000000_background_job_executions.sql` (completo) — grants de SELECT na migration `20260810000000_background_job_monitoring.sql`

## Propósito

Registro de execuções de jobs em background (ex.: keepalive diário dos projetos Supabase): identifica o job, o ambiente, a duração e o resultado de cada execução. Persistência centralizada da infraestrutura de jobs (ver `src/shared/background-jobs.ts`).

## Colunas

`[CONFIRMED: database — information_schema.columns dev e prod, 2026-08-13]`

| coluna | tipo | default | nullable | constraint | notas |
|---|---|---|---|---|---|
| `id` | uuid | `gen_random_uuid()` | NO | PK | |
| `run_id` | uuid | `gen_random_uuid()` | NO | — | agrupa eventos da mesma execução |
| `job_key` | text | — | NO | — | identifica o job (ex.: `keepalive`) |
| `environment` | text | — | NO | — | ambiente do registro (`prod`/`dev`) |
| `status` | `background_job_status` (enum) | — | NO | — | `success` / `failure` / `partial` |
| `started_at` | timestamp with time zone | — | NO | CHECK `finished_at >= started_at` | |
| `finished_at` | timestamp with time zone | — | NO | CHECK `finished_at >= started_at` | |
| `duration_ms` | integer | — | NO | CHECK `duration_ms >= 0` | |
| `message` | text | — | NO | — | resumo legível da execução |
| `details` | jsonb | `'{}'::jsonb` | NO | — | metadados adicionais |
| `created_at` | timestamp with time zone | `now()` | NO | — | |

Enum `background_job_status` = (`success`, `failure`, `partial`) — criado na migration 20260807, confirmado no catálogo `[CONFIRMED: migration, database]`.

## Constraints e índices

`[CONFIRMED: database — pg_constraint e pg_indexes, 2026-08-13]`

- `background_job_executions_pkey` — PRIMARY KEY (`id`)
- `background_job_executions_duration_ms_check` — CHECK (`duration_ms >= 0`)
- `background_job_executions_time_check` — CHECK (`finished_at >= started_at`)
- `background_job_executions_job_key_environment_created_at_idx` — btree (`job_key`, `environment`, `created_at` DESC)
- `background_job_executions_run_id_idx` — btree (`run_id`)
- `background_job_executions_created_at_idx` — btree (`created_at` DESC)
- Nenhuma FK `[CONFIRMED: database]`.

## Relacionamentos (FKs)

- Nenhuma FK — tabela isolada do domínio `[CONFIRMED: database]`.

## Políticas RLS desta tabela

`[CONFIRMED: database — pg_policies dev e prod, 2026-08-13]`

| política | comando | alvo | USING / WITH CHECK | evidência |
|---|---|---|---|---|
| `admin_can_select_background_job_executions` | SELECT | authenticated | USING: `is_admin_user(auth.uid())` | migration 20260810 (linhas 20–26) e catálogo |

Notas factuais:
- Única política da tabela. NÃO há políticas de INSERT/UPDATE/DELETE — a escrita é feita por canais com `service_role` (rota `/api/keepalive` e helper `background-jobs.ts`) `[CONFIRMED: database, code]`.
- Grants explícitos de SELECT para `authenticated` e `service_role` na migration 20260810; os default privileges do baseline também conferem privilégios amplos às roles (ver `overview.md`) `[CONFIRMED: migration, database]`.

## Regras de negócio associadas

- Retenção de 365 dias: registros mais antigos são removidos pelo trigger `trg_trim_background_job_executions` a cada INSERT `[CONFIRMED: migration — ver triggers.md]`.
- `run_id` agrupa eventos da mesma execução; `status = partial` indica execução parcialmente bem-sucedida `[CONFIRMED: migration, README.md]`.

## Lifecycle

- **Criação:** INSERT via `recordBackgroundJobExecution` (`src/shared/background-jobs.ts`) usando service role, chamado pela rota `/api/keepalive` (Vercel cron diário) `[CONFIRMED: code — api/keepalive.ts, src/shared/background-jobs.ts]`.
- **Atualização/exclusão:** não suportadas pela aplicação (sem políticas; sem código) `[CONFIRMED: database, code]`.
- **Remoção automática:** trigger de retenção (365 dias) `[CONFIRMED: migration]`.
- **Leitura:** painel administrativo (`useBackgroundJobsAdmin` / `admin.service`), restrita a admins pelo RLS `[CONFIRMED: code, database]`.

## RPCs e triggers que tocam esta tabela

- Trigger `trg_trim_background_job_executions` (AFTER INSERT) — função `fn_trim_background_job_executions` — [triggers.md](triggers.md)

## Testes que cobrem esta tabela

- `src/shared/background-jobs.test.ts` — helper `background-jobs.ts` `[CONFIRMED: test]`
- `src/react-app/hooks/useBackgroundJobsAdmin.test.tsx` — hook do painel admin `[CONFIRMED: test]`
- `src/react-app/services/background-jobs.service.test.ts` — serviço `background-jobs.service` `[CONFIRMED: test]`
- `api/keepalive.test.ts` — rota keepalive `[CONFIRMED: test]`

## Evidências

- E1 — Colunas, enum, constraints, índices, RLS e política: catálogo dev e prod (2026-08-13) `[CONFIRMED: database]`
- E2 — DDL completo: migrations 20260807 e 20260810 `[CONFIRMED: migration]`
- E3 — Chamadores no código: 3 referências `.from("background_job_executions")` em `src/`; escrita via service role em `api/keepalive.ts` `[CONFIRMED: code]`
- E4 — Contagens: dev = 6, prod = 8 (2026-08-13) `[CONFIRMED: database]`

## Veja também

- [triggers.md](triggers.md), [rpc.md](rpc.md) (`is_admin_user`, `fn_trim_background_job_executions`)
- `../backend/api-keepalive.md` (Fase 4)
- `../frontend/pages/admin.md` (Fase 5)
