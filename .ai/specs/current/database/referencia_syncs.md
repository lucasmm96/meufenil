# Tabela public.referencia_syncs

**Última verificação:** 2026-09-25 (ENH-0009 — migration 20260923000000: colunas `bootstrap`/`divergencias` dropadas, `deletadas` adicionada; `referencia_sync_pendencias` DROPPED; `alteracoes` sempre `[]` (rollback removido). Antes: 2026-09-07 FEAT-0017 M1–M6)
**DDL versionado em:** `supabase/migrations/20260905000000_referencias_sync_tabelas.sql` (completo, linhas 58–92) — migrations posteriores evoluem RPCs e schema: 20260906000000/20260906010000/20260907000000; ENH-0009: 20260923000000

## Propósito

A sync como unidade (FEAT-0017 — sincronização do conjunto global de referências com a origem ANVISA/Power BI): uma linha por execução, com environment, origem do gatilho, status, contadores (criadas/arquivadas/deletadas — ENH-0009) e log estruturado de estágios em `details.estagios`. Contada no inventário como tabela de sincronização do FEAT-0017 M1 (dev e prod desde a release v1.11.0, 2026-09-10). ENH-0009: a sync sempre conclui `success` (sem `pending_review`) — `alteracoes` sempre `[]` (rollback removido).

## Colunas

`[CONFIRMED: migration 20260905000000:58-77]`

| coluna | tipo | default | nullable | constraint | notas |
|---|---|---|---|---|---|
| `id` | uuid | `gen_random_uuid()` | NO | PK | |
| `environment` | text | — | NO | — | ambiente (`dev`/`prod`) — base do single-flight |
| `trigger_source` | text | — | NO | — | origem do gatilho (ex.: rota / Vercel cron) |
| `requested_by` | uuid | — | YES | FK `usuarios(id)` ON DELETE SET NULL | quem pediu a sync |
| ~~`bootstrap`~~ | — | — | — | — | **DROPPED (ENH-0009 migration 20260923000000)** — derivarModoSync removido |
| `status` | `sync_status` (enum) | `'running'` | NO | — | `running` / `success` / `failure` / `origin_invalid` — `pending_review`/`reverted` existem no enum mas são estados unreachable pós-ENH-0009 |
| `started_at` | timestamp with time zone | `now()` | NO | CHECK `finished_at >= started_at` | |
| `finished_at` | timestamp with time zone | — | YES | CHECK `finished_at >= started_at` | |
| `total_origem` | integer | — | YES | — | itens da extração |
| `equivalentes` | integer | — | YES | — | sem divergência (resumo do plano — matching é do motor) |
| `criadas` | integer | — | YES | — | criadas automaticamente pela aplicação |
| `arquivadas` | integer | — | YES | — | arquivadas automaticamente (soft-archive ou quando FK violation impede deleção física) |
| ~~`divergencias`~~ | — | — | — | — | **DROPPED (ENH-0009 migration 20260923000000)** — curadoria/pendências removidas |
| `deletadas` | integer | — | YES | — | **ADICIONADO ENH-0009** — deleções físicas confirmadas pelo apply |
| `message` | text | — | YES | — | resumo legível (ex.: falha) |
| `details` | jsonb | `'{}'::jsonb` | NO | — | log estruturado de estágios em `details.estagios[]`; estágio `audit` adicionado por ENH-0010 |
| `alteracoes` | jsonb | `'[]'::jsonb` | NO | — | sempre `[]` pós-ENH-0009 (rollback seletivo removido; coluna mantida no schema) |
| `created_at` | timestamp with time zone | `now()` | NO | — | |

## Constraints e índices

`[CONFIRMED: migration 20260905000000:58-92]`

- `referencia_syncs_pkey` — PRIMARY KEY (`id`)
- `referencia_syncs_finished_at_check` — CHECK (`finished_at >= started_at`)
- `referencia_syncs_created_at_idx` — btree (`created_at` DESC)
- `referencia_syncs_status_idx` — btree (`status`)
- ~~`referencia_syncs_bootstrap_idx`~~ — **DROPPED (ENH-0009)** (coluna `bootstrap` removida)
- `referencia_syncs_single_flight_running_unique` — UNIQUE parcial (`environment`) WHERE `status = 'running'` — single-flight (B10): no máximo UMA sync running por environment; segunda simultânea viola 23505 e a rota responde 409 sem registrar linha

## Relacionamentos (FKs)

- `requested_by` → `usuarios(id)` ON DELETE SET NULL `[CONFIRMED: migration]`
- FKs de FILHOS (todas `ON DELETE RESTRICT`): ~~`referencia_sync_pendencias.sync_id`~~ (tabela DROPPED — ENH-0009), `referencia_eventos.sync_id` (nullable — evento `restore` não pertence a sync), `referencia_snapshots.sync_id`, `referencia_backups.sync_id` — sync com filhos não é apagável; histórico é imutável

## Políticas RLS desta tabela

`[CONFIRMED: migration 20260905000000:198-252 — padrão background_job_executions/DEBT-0001]`

| política | comando | alvo | USING / WITH CHECK | evidência |
|---|---|---|---|---|
| `admin_select_referencia_syncs` | SELECT | authenticated | USING: `is_admin_user(auth.uid())` | migration 20260905000000 (linhas 204–209) |

Notas factuais:
- Única política da tabela. NÃO há políticas de INSERT/UPDATE/DELETE — escrita exclusiva de canais `service_role` (rota `api/referencias-sync.ts`) e RPCs SECURITY DEFINER `[CONFIRMED: migration, code]`.
- Grants explícitos de SELECT para `authenticated` e `service_role` (linhas 239–240); o default privileges do Supabase também confere privilégios amplos às roles — a restrição efetiva é o RLS (ver `overview.md`) `[CONFIRMED: migration, database]`.

## Regras de negócio associadas

- Sync é unidade com ID único rastreando eventos, snapshots e backups (BR-045 — ENH-0009 removeu pendências) `[CONFIRMED: migration]`.
- No máximo uma sync `running` por environment (single-flight, BR-045) `[CONFIRMED: migration — índice parcial]`.
- ENH-0009 removeu `bootstrap` (coluna e derivação `derivarModoSync`); sync sempre aplica automaticamente (BR-039/BR-040) `[CONFIRMED: migration 20260923000000]`.
- Transições de status somente via rota: a rota finaliza no estágio 8 sempre como `success` (ou `failure`/`origin_invalid` em caso de erro) — BR-045; `pending_review`/`reverted` são estados unreachable pós-ENH-0009 `[CONFIRMED: migration 20260923000000]`.
- Sincronização controla apenas referências globais — BR-038.

## Lifecycle

- **Criação:** rota `api/referencias-sync.ts` (service_role) — linha `running` no início, finalizada no estágio 8 `[CONFIRMED: code, migration]`.
- **Atualização:** `aplicar_sync_referencias` (RPC, ENH-0009) grava contadores (`equivalentes`, `criadas`, `arquivadas`, `deletadas`) e `alteracoes = []`; rota fecha com `success` (ou `failure`/`origin_invalid` em erro) — ENH-0009 removeu `decidir_pendencia_referencia` e `reverter_sync_referencias` `[CONFIRMED: migration 20260923000000]`.
- **Exclusão:** não suportada — filhos com FK RESTRICT e nenhum canal de DELETE `[CONFIRMED: database]`.
- **Leitura:** painel administrativo (admin), restrita por RLS `[CONFIRMED: database]`.

## RPCs e triggers que tocam esta tabela

- RPC `aplicar_sync_referencias` (reescrita ENH-0009) — [rpc.md](rpc.md)
- ~~RPC `decidir_pendencia_referencia`~~ — **ELIMINADA (ENH-0009)**
- ~~RPC `reverter_sync_referencias`~~ — **ELIMINADA (ENH-0009)**
- Rota `api/referencias-sync.ts` — [../backend/api-referencias-sync.md](../backend/api-referencias-sync.md)

## Testes que cobrem esta tabela

- `src/shared/security/rpc-referencias-sync.test.ts` — REAL (ENH-0009, 9 testes): single-flight (segunda `running` → 23505), aplicação + guardas de estado, contadores `[CONFIRMED: test]`
- `api/referencias-sync.test.ts` — rota completa (estágios 1–8, ENH-0009/ENH-0010) `[CONFIRMED: test]`
- `src/shared/security/rpc-referencias-sync-rollback.test.ts` — REAL (ENH-0009, 6 testes): restauração por backup `[CONFIRMED: test]`

## Evidências

- E1 — DDL, índices e RLS: migration 20260905000000 `[CONFIRMED: migration]`
- E2 — Evoluções: migrations 20260906000000, 20260906010000, 20260907000000 `[CONFIRMED: migration]`
- E3 — ENH-0009: migration 20260923000000 (coluna `bootstrap`/`divergencias` DROP, `deletadas` ADD, pendências DROPPED) `[CONFIRMED: migration]`

## Veja também

- ~~[referencia_sync_pendencias.md](referencia_sync_pendencias.md)~~ (DROPPED — ENH-0009), [referencia_eventos.md](referencia_eventos.md), [referencia_snapshots.md](referencia_snapshots.md), [referencia_backups.md](referencia_backups.md)
- [rpc.md](rpc.md), [../security/security-model.md](../security/security-model.md) (§11)
- `../domain/business-rules.md` (BR-038/039/043/045/046)
