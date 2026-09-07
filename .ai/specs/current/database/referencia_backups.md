# Tabela public.referencia_backups

**Última verificação:** 2026-09-07 (FEAT-0017 M1–M6)
**DDL versionado em:** `supabase/migrations/20260905000000_referencias_sync_tabelas.sql` (tabela, linhas 177–190; trigger de retenção, linhas 260–279) — consumo pelas RPCs da `20260906010000_referencias_sync_rollback_restauracao.sql`

## Propósito

Backup pré-aplicação da sincronização (FEAT-0017 B3): linhas completas de `referencias` (globais) no estado anterior à aplicação do plano — payload + sha256 + contagem. Base da recuperação excepcional: `reverter_sync_referencias` usa as `alteracoes` da sync; `restaurar_referencias_de_backup` devolve o conjunto global a refletir um backup (integridade verificada por sha256 antes de qualquer efeito). Retenção própria: 12 meses.

## Colunas

`[CONFIRMED: migration 20260905000000:177-184]`

| coluna | tipo | default | nullable | constraint | notas |
|---|---|---|---|---|---|
| `id` | uuid | `gen_random_uuid()` | NO | PK | |
| `sync_id` | uuid | — | NO | FK `referencia_syncs(id)` ON DELETE RESTRICT | sync pré-aplicação do backup |
| `payload` | jsonb | — | NO | — | linhas completas de referências (globais) |
| `payload_sha256` | text | — | NO | — | hash de integridade — verificado na restauração |
| `contagem` | integer | — | NO | — | total de linhas no payload |
| `created_at` | timestamp with time zone | `now()` | NO | — | |

## Constraints e índices

`[CONFIRMED: migration 20260905000000:177-190]`

- `referencia_backups_pkey` — PRIMARY KEY (`id`)
- `referencia_backups_sync_id_idx` — btree (`sync_id`)
- `referencia_backups_created_at_idx` — btree (`created_at` DESC)

## Relacionamentos (FKs)

- `sync_id` → `referencia_syncs(id)` ON DELETE RESTRICT

## Políticas RLS desta tabela

`[CONFIRMED: migration 20260905000000:232-237]`

| política | comando | alvo | USING / WITH CHECK | evidência |
|---|---|---|---|---|
| `admin_select_referencia_backups` | SELECT | authenticated | USING: `is_admin_user(auth.uid())` | migration 20260905000000 (linhas 232–237) |

Notas factuais:
- Única política da tabela. NÃO há políticas de escrita — INSERT pela rota `api/referencias-sync.ts` (service_role) no estágio 5; leitura pela RPC `restaurar_referencias_de_backup` (SECURITY DEFINER) `[CONFIRMED: migration, code]`.
- Grants explícitos de SELECT para `authenticated` e `service_role` (linhas 251–252) `[CONFIRMED: migration]`.

## Regras de negócio associadas

- Backup gravado para TODA extração válida, antes da aplicação (estágio 5) — base do rollback seletivo e da restauração (BR-046) `[CONFIRMED: migration 20260906010000]`.
- Retenção FIXADA de 12 meses via trigger `trg_trim_referencia_backups` (AFTER INSERT, FOR EACH STATEMENT, padrão `trg_trim_background_job_executions`) — exceção à BR-027 (o trim de 365 dias vale só para `background_job_executions`) (BR-046/BR-027) `[CONFIRMED: migration 20260905000000:260-279]`.
- Restauração verifica o sha256 do payload (`extensions.digest`) antes de qualquer efeito; nunca DELETE; não toca referências pessoais; syncs históricas intactas (BR-046) `[CONFIRMED: migration 20260906010000]`.

## Lifecycle

- **Criação:** rota `api/referencias-sync.ts` — estágio 5, imediatamente antes da aplicação; evento `backup_created` em `referencia_eventos` `[CONFIRMED: code]`.
- **Remoção automática:** trigger de retenção (12 meses) a cada INSERT `[CONFIRMED: migration]`.
- **Consumo:** RPC `restaurar_referencias_de_backup` (admin com `pode_recuperacao`) — payload decodificado validado por hash, depois o conjunto global volta a refletir o backup `[CONFIRMED: migration 20260906010000]`.
- **Exclusão manual:** não suportada `[CONFIRMED: database]`.
- **Leitura:** admin (RLS) `[CONFIRMED: database]`.

## RPCs e triggers que tocam esta tabela

- Trigger `trg_trim_referencia_backups` (AFTER INSERT) — função `fn_trim_referencia_backups` — [triggers.md](triggers.md)
- RPC `restaurar_referencias_de_backup` — [rpc.md](rpc.md)

## Testes que cobrem esta tabela

- `api/referencias-sync.test.ts` — REAL: estágio 5 grava backup com payload/sha256/contagem pré-aplicação `[CONFIRMED: test]`
- `src/shared/security/rpc-referencias-sync-rollback.test.ts` — REAL: restauração a partir do backup (6 testes — integridade sha256, cancelamento de pendências, pessoais intocadas, evento `restore`) `[CONFIRMED: test]`

## Evidências

- E1 — DDL, índices, RLS e trigger de retenção: migration 20260905000000 `[CONFIRMED: migration]`
- E2 — Consumo pela restauração: migration 20260906010000 `[CONFIRMED: migration]`
- E3 — Chamadores no código: ~16 ocorrências de `referencia_backups` em `src/`, `api/` e `supabase/functions/` (grep, 2026-09-07 — inclui arquivos de teste) `[CONFIRMED: code]`

## Veja também

- [referencia_syncs.md](referencia_syncs.md), [referencia_snapshots.md](referencia_snapshots.md)
- [triggers.md](triggers.md), [rpc.md](rpc.md), [../security/security-model.md](../security/security-model.md) (§11)
- `../domain/business-rules.md` (BR-027/046)
