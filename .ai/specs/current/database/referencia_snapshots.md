# Tabela public.referencia_snapshots

**Última verificação:** 2026-09-07 (FEAT-0017 M1–M6)
**DDL versionado em:** `supabase/migrations/20260905000000_referencias_sync_tabelas.sql` (completo, linhas 162–175)

## Propósito

Snapshot da extração da origem (FEAT-0017 B3): o payload decodificado e VALIDADO da origem, com hash sha256 e contagem — uma por execução de sync (estágio 4). Base de rastreio do que a origem dizia em cada execução; distinto do backup (`referencia_backups`), que registra o estado de `referencias` pré-aplicação.

## Colunas

`[CONFIRMED: migration 20260905000000:162-169]`

| coluna | tipo | default | nullable | constraint | notas |
|---|---|---|---|---|---|
| `id` | uuid | `gen_random_uuid()` | NO | PK | |
| `sync_id` | uuid | — | NO | FK `referencia_syncs(id)` ON DELETE RESTRICT | sync da extração |
| `payload` | jsonb | — | NO | — | payload decodificado exato da origem |
| `payload_sha256` | text | — | NO | — | hash de integridade do payload |
| `contagem` | integer | — | NO | — | itens do payload |
| `created_at` | timestamp with time zone | `now()` | NO | — | |

## Constraints e índices

`[CONFIRMED: migration 20260905000000:162-175]`

- `referencia_snapshots_pkey` — PRIMARY KEY (`id`)
- `referencia_snapshots_sync_id_idx` — btree (`sync_id`)
- `referencia_snapshots_created_at_idx` — btree (`created_at` DESC)
- Nenhum CHECK, nenhuma UNIQUE além da PK `[CONFIRMED: migration]`.

## Relacionamentos (FKs)

- `sync_id` → `referencia_syncs(id)` ON DELETE RESTRICT — snapshot pertence à sync e não é apagável com ela

## Políticas RLS desta tabela

`[CONFIRMED: migration 20260905000000:225-230]`

| política | comando | alvo | USING / WITH CHECK | evidência |
|---|---|---|---|---|
| `admin_select_referencia_snapshots` | SELECT | authenticated | USING: `is_admin_user(auth.uid())` | migration 20260905000000 (linhas 225–230) |

Notas factuais:
- Única política da tabela. NÃO há políticas de escrita — INSERT pela rota `api/referencias-sync.ts` (service_role) no estágio 4 `[CONFIRMED: migration, code]`.
- Grants explícitos de SELECT para `authenticated` e `service_role` (linhas 248–249) `[CONFIRMED: migration]`.

## Regras de negócio associadas

- Snapshot gravado somente de extração válida (estágio de validação passou — sync não confiável aborta antes, BR-039/BR-044) `[CONFIRMED: code, migration — rota]`.
- Sem trim automático (retenção de snapshots não definida — decisão em aberto no design, fora do escopo M1–M7); contraste com `referencia_backups`, que tem retenção própria de 12 meses (BR-046) `[CONFIRMED: migration]`.
- Sincronização controla apenas o conjunto global (BR-038).

## Lifecycle

- **Criação:** rota `api/referencias-sync.ts` — estágio 4, após a validação da extração; evento `snapshot_created` em `referencia_eventos` `[CONFIRMED: code]`.
- **Atualização/exclusão:** não suportadas (sem política; sem canal) `[CONFIRMED: database]`.
- **Leitura:** admin (RLS) `[CONFIRMED: database]`.

## RPCs e triggers que tocam esta tabela

- Nenhum — escrita direta da rota com `service_role` (evento associado em `referencia_eventos` via rota)

## Testes que cobrem esta tabela

- `api/referencias-sync.test.ts` — REAL: estágio 4 grava snapshot com payload/sha256/contagem de extração validada `[CONFIRMED: test]`

## Evidências

- E1 — DDL, índices e RLS: migration 20260905000000 `[CONFIRMED: migration]`
- E2 — Chamadores no código: ~12 ocorrências de `referencia_snapshots` em `src/`, `api/` e `supabase/functions/` (grep, 2026-09-07 — inclui arquivos de teste) `[CONFIRMED: code]`

## Veja também

- [referencia_syncs.md](referencia_syncs.md), [referencia_backups.md](referencia_backups.md)
- [../security/security-model.md](../security/security-model.md) (§11)
- `../domain/business-rules.md` (BR-038/039/044)
