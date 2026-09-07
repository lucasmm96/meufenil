# Tabela public.referencia_syncs

**Última verificação:** 2026-09-07 (FEAT-0017 M1–M6)
**DDL versionado em:** `supabase/migrations/20260905000000_referencias_sync_tabelas.sql` (completo, linhas 58–92) — migrations posteriores da FEAT-0017 evoluem os RPCs que a tocam (20260906000000, 20260906010000, 20260907000000)

## Propósito

A sync como unidade (FEAT-0017 — sincronização do conjunto global de referências com a origem ANVISA/Power BI): uma linha por execução, com environment, origem do gatilho, status, contadores e o log estruturado `alteracoes`. Contada no inventário como tabela de sincronização do FEAT-0017 M1 (dev; prod aguarda release).

## Colunas

`[CONFIRMED: migration 20260905000000:58-77]`

| coluna | tipo | default | nullable | constraint | notas |
|---|---|---|---|---|---|
| `id` | uuid | `gen_random_uuid()` | NO | PK | |
| `environment` | text | — | NO | — | ambiente (`dev`/`prod`) — base do single-flight |
| `trigger_source` | text | — | NO | — | origem do gatilho (ex.: rota / Vercel cron) |
| `requested_by` | uuid | — | YES | FK `usuarios(id)` ON DELETE SET NULL | quem pediu a sync |
| `bootstrap` | boolean | `false` | NO | — | 1ª sync confiável do environment — modo `bootstrap` do plano |
| `status` | `sync_status` (enum) | `'running'` | NO | — | `running` / `success` / `pending_review` / `failure` / `origin_invalid` / `reverted` |
| `started_at` | timestamp with time zone | `now()` | NO | CHECK `finished_at >= started_at` | |
| `finished_at` | timestamp with time zone | — | YES | CHECK `finished_at >= started_at` | |
| `total_origem` | integer | — | YES | — | itens da extração |
| `equivalentes` | integer | — | YES | — | sem divergência (resumo do plano — matching é do motor) |
| `criadas` | integer | — | YES | — | criadas automaticamente pela aplicação |
| `arquivadas` | integer | — | YES | — | arquivadas automaticamente pela aplicação |
| `divergencias` | integer | — | YES | — | pendências abertas |
| `message` | text | — | YES | — | resumo legível (falha/reversão) |
| `details` | jsonb | `'{}'::jsonb` | NO | — | metadados (ex.: erros de validação) |
| `alteracoes` | jsonb | `'[]'::jsonb` | NO | — | log estruturado por operação (`op`, `referencia_id`, `antes`/`depois`) — base do rollback seletivo |
| `created_at` | timestamp with time zone | `now()` | NO | — | |

## Constraints e índices

`[CONFIRMED: migration 20260905000000:58-92]`

- `referencia_syncs_pkey` — PRIMARY KEY (`id`)
- `referencia_syncs_finished_at_check` — CHECK (`finished_at >= started_at`)
- `referencia_syncs_created_at_idx` — btree (`created_at` DESC)
- `referencia_syncs_status_idx` — btree (`status`)
- `referencia_syncs_bootstrap_idx` — btree (`bootstrap`)
- `referencia_syncs_single_flight_running_unique` — UNIQUE parcial (`environment`) WHERE `status = 'running'` — single-flight (B10): no máximo UMA sync running por environment; segunda simultânea viola 23505 e a rota responde 409 sem registrar linha

## Relacionamentos (FKs)

- `requested_by` → `usuarios(id)` ON DELETE SET NULL `[CONFIRMED: migration]`
- FKs de FILHOS (todas `ON DELETE RESTRICT`): `referencia_sync_pendencias.sync_id`, `referencia_eventos.sync_id` (nullable — evento `restore` não pertence a sync), `referencia_snapshots.sync_id`, `referencia_backups.sync_id` — sync com filhos não é apagável; histórico é imutável

## Políticas RLS desta tabela

`[CONFIRMED: migration 20260905000000:198-252 — padrão background_job_executions/DEBT-0001]`

| política | comando | alvo | USING / WITH CHECK | evidência |
|---|---|---|---|---|
| `admin_select_referencia_syncs` | SELECT | authenticated | USING: `is_admin_user(auth.uid())` | migration 20260905000000 (linhas 204–209) |

Notas factuais:
- Única política da tabela. NÃO há políticas de INSERT/UPDATE/DELETE — escrita exclusiva de canais `service_role` (rota `api/referencias-sync.ts`) e RPCs SECURITY DEFINER `[CONFIRMED: migration, code]`.
- Grants explícitos de SELECT para `authenticated` e `service_role` (linhas 239–240); o default privileges do Supabase também confere privilégios amplos às roles — a restrição efetiva é o RLS (ver `overview.md`) `[CONFIRMED: migration, database]`.

## Regras de negócio associadas

- Sync é unidade com ID único rastreando eventos, pendências, snapshots e backups (BR-045) `[CONFIRMED: migration — ver business-rules.md]`.
- No máximo uma sync `running` por environment (single-flight, BR-045) `[CONFIRMED: migration — índice parcial]`.
- `bootstrap = true` registra a 1ª sync confiável do environment; modo derivado no motor (`derivarModoSync`) a partir do histórico de `success`/`pending_review` — BR-039 `[CONFIRMED: migration, code — compare.ts:117-122]`.
- Transições de status somente via RPC/rota: a rota finaliza no estágio 8; `decidir_pendencia_referencia` marca `success` ao decidir a última pendência open; `reverter_sync_referencias` marca `reverted` — BR-043/BR-046 `[CONFIRMED: migrations 20260906000000/20260906010000]`.
- Sincronização controla apenas referências globais — BR-038.

## Lifecycle

- **Criação:** rota `api/referencias-sync.ts` (service_role) — linha `running` no início da execução, finalizada no estágio 8 conforme o resumo retornado por `aplicar_sync_referencias` `[CONFIRMED: code, migration]`.
- **Atualização:** RPCs SECURITY DEFINER — `aplicar_sync_referencias` grava contadores e `alteracoes`; `decidir_pendencia_referencia` fecha com `success`; `reverter_sync_referencias` fecha com `reverted`; falha/validação fecha com `failure`/`origin_invalid` via rota `[CONFIRMED: migrations 20260906000000/20260906010000]`.
- **Exclusão:** não suportada — filhos com FK RESTRICT e nenhum canal de DELETE `[CONFIRMED: database]`.
- **Leitura:** painel administrativo (admin), restrita por RLS `[CONFIRMED: database]`.

## RPCs e triggers que tocam esta tabela

- RPC `aplicar_sync_referencias` — [rpc.md](rpc.md)
- RPC `decidir_pendencia_referencia` — [rpc.md](rpc.md)
- RPC `reverter_sync_referencias` — [rpc.md](rpc.md)
- Rota `api/referencias-sync.ts` — [../backend/api-referencias-sync.md](../backend/api-referencias-sync.md)

## Testes que cobrem esta tabela

- `src/shared/security/rpc-referencias-sync.test.ts` — REAL: single-flight (segunda `running` → 23505), transições de status, contadores `[CONFIRMED: test]`
- `api/referencias-sync.test.ts` — REAL: rota completa (estágios 1–8) `[CONFIRMED: test]`
- `src/shared/security/rpc-referencias-sync-rollback.test.ts` — REAL: reversão marca `reverted` `[CONFIRMED: test]`

## Evidências

- E1 — DDL, índices e RLS: migration 20260905000000 `[CONFIRMED: migration]`
- E2 — Evoluções (CREATE OR REPLACE de RPCs e seed): migrations 20260906000000, 20260906010000, 20260907000000 `[CONFIRMED: migration]`
- E3 — Chamadores no código: ~78 ocorrências de `referencia_syncs` em `src/`, `api/` e `supabase/functions/` (grep, 2026-09-07 — inclui arquivos de teste) `[CONFIRMED: code]`

## Veja também

- [referencia_sync_pendencias.md](referencia_sync_pendencias.md), [referencia_eventos.md](referencia_eventos.md), [referencia_snapshots.md](referencia_snapshots.md), [referencia_backups.md](referencia_backups.md)
- [rpc.md](rpc.md), [../security/security-model.md](../security/security-model.md) (§11)
- `../domain/business-rules.md` (BR-038/039/043/045/046)
