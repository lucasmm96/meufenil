# Tabela public.referencia_sync_pendencias

**Última verificação:** 2026-09-07 (FEAT-0017 M1–M6)
**DDL versionado em:** `supabase/migrations/20260905000000_referencias_sync_tabelas.sql` (completo, linhas 98–124) — escrita e decisão pelos RPCs da 20260906000000; cancelamento pelos RPCs da 20260906010000

## Propósito

Curadoria da sincronização (FEAT-0017): divergências entre origem e catálogo que exigem decisão humana — a pendência carrega o tipo, a referência afetada, a proposta e o diff estruturado da divergência. Decidida por admin (aprovar/rejeitar); cancelada por rollback/restauração.

## Colunas

`[CONFIRMED: migration 20260905000000:98-112]`

| coluna | tipo | default | nullable | constraint | notas |
|---|---|---|---|---|---|
| `id` | uuid | `gen_random_uuid()` | NO | PK | |
| `sync_id` | uuid | — | NO | FK `referencia_syncs(id)` ON DELETE RESTRICT | sync de origem da pendência |
| `tipo` | `sync_pendencia_tipo` (enum) | — | NO | — | `substitution` / `absence` / `new_item` |
| `referencia_id` | uuid | — | YES | FK `referencias(id)` ON DELETE RESTRICT | afetada (ausente em `new_item`) |
| `proposta` | jsonb | — | YES | — | identidade proposta (origem) para aprovação |
| `diff` | jsonb | — | YES | — | divergência estruturada comparando antes/depois |
| `status` | `sync_pendencia_status` (enum) | `'open'` | NO | — | `open` / `approved` / `rejected` / `cancelled` |
| `motivo` | text | — | YES | CHECK `status <> 'rejected' or motivo is not null` | OBRIGATÓRIO na rejeição |
| `created_at` | timestamp with time zone | `now()` | NO | — | |
| `decided_at` | timestamp with time zone | — | YES | — | decisão/cancelamento |
| `decided_by` | uuid | — | YES | FK `usuarios(id)` ON DELETE SET NULL | admin que decidiu |

Enum `sync_pendencia_tipo` = (`substitution`, `absence`, `new_item`): substitution = global ativa com mudança substantiva na origem (nome/marca/fenil) → arquivar + criar; absence = global ativa ausente da origem; new_item = presente na origem, fora do catálogo ativo. Enum `sync_pendencia_status` = (`open`, `approved`, `rejected`, `cancelled`) — criados na migration 20260905000000 `[CONFIRMED: migration]`.

## Constraints e índices

`[CONFIRMED: migration 20260905000000:98-124]`

- `referencia_sync_pendencias_pkey` — PRIMARY KEY (`id`)
- `referencia_sync_pendencias_motivo_rejeicao_check` — CHECK (`status <> 'rejected' or motivo is not null`)
- `referencia_sync_pendencias_sync_id_idx` — btree (`sync_id`)
- `referencia_sync_pendencias_status_idx` — btree (`status`)
- `referencia_sync_pendencias_referencia_id_idx` — btree (`referencia_id`)
- `referencia_sync_pendencias_created_at_idx` — btree (`created_at` DESC)

## Relacionamentos (FKs)

- `sync_id` → `referencia_syncs(id)` ON DELETE RESTRICT
- `referencia_id` → `referencias(id)` ON DELETE RESTRICT
- `decided_by` → `usuarios(id)` ON DELETE SET NULL

## Políticas RLS desta tabela

`[CONFIRMED: migration 20260905000000:211-216]`

| política | comando | alvo | USING / WITH CHECK | evidência |
|---|---|---|---|---|
| `admin_select_referencia_sync_pendencias` | SELECT | authenticated | USING: `is_admin_user(auth.uid())` | migration 20260905000000 (linhas 211–216) |

Notas factuais:
- Única política da tabela. NÃO há políticas de escrita — decisão exclusivamente via RPC `decidir_pendencia_referencia` (SECURITY DEFINER com guarda interna de admin) `[CONFIRMED: migration, code]`.
- Grants explícitos de SELECT para `authenticated` e `service_role` (linhas 242–243) `[CONFIRMED: migration]`.

## Regras de negócio associadas

- Mudança substantiva na origem NUNCA é UPDATE in-place — vira pendência `substitution`; aprovar = arquivar + criar via curadoria (BR-040) `[CONFIRMED: migration 20260906000000]`.
- Curadoria independente por sync; rejeição exige motivo; decisão vale só para a sync da pendência; pendência terminal não recebe nova decisão; última open decidida → sync `success` (BR-043) `[CONFIRMED: migration 20260906000000:226-450]`.
- Pendências canceladas (rollback/restauração) permanecem no histórico como `cancelled` e nunca recebem nova decisão (BR-045) `[CONFIRMED: migration 20260906010000]`.

## Lifecycle

- **Criação:** `aplicar_sync_referencias` insere as pendências 1:1 do plano (estágio 6 — incluindo o bootstrap, em que TODO o diff vira pendência) `[CONFIRMED: migration 20260906000000]`.
- **Decisão:** `decidir_pendencia_referencia` (admin) — aprovar executa a mudança por tipo com ator adequado; rejeitar só registra (motivo obrigatório); decisão com lock de linha `[CONFIRMED: migration 20260906000000:226-450]`.
- **Cancelamento:** `reverter_sync_referencias`/`restaurar_referencias_de_backup` cancelam as pendências `open` com evento `pendencia_cancelada` — nunca DELETE `[CONFIRMED: migration 20260906010000]`.
- **Exclusão:** não suportada pela aplicação (FK RESTRICT; sem canal) `[CONFIRMED: database]`.
- **Leitura:** admin (RLS); a UI do Admin (M6) lista e decide `[CONFIRMED: code]`.

## RPCs e triggers que tocam esta tabela

- RPC `aplicar_sync_referencias` (criação) — [rpc.md](rpc.md)
- RPC `decidir_pendencia_referencia` (decisão) — [rpc.md](rpc.md)
- RPCs `reverter_sync_referencias` / `restaurar_referencias_de_backup` (cancelamento) — [rpc.md](rpc.md)

## Testes que cobrem esta tabela

- `src/shared/security/rpc-referencias-sync.test.ts` — REAL: aprovar por tipo (substitution arquiva+cria / absence arquiva / new_item cria), rejeitar exige motivo, pendência terminal não redecide `[CONFIRMED: test]`
- `src/shared/security/rpc-referencias-sync-rollback.test.ts` — REAL: cancelamento em rollback/restauração, sem nova decisão após cancelada `[CONFIRMED: test]`
- `src/react-app/services/referencias-sync.service.test.ts` — serviço da UI (M6) `[CONFIRMED: test]`

## Evidências

- E1 — DDL, CHECK e índices: migration 20260905000000 `[CONFIRMED: migration]`
- E2 — Criação/decisão: migration 20260906000000 `[CONFIRMED: migration]`
- E3 — Cancelamento: migration 20260906010000 `[CONFIRMED: migration]`

## Veja também

- [referencia_syncs.md](referencia_syncs.md), [referencia_eventos.md](referencia_eventos.md)
- [rpc.md](rpc.md), [../security/security-model.md](../security/security-model.md) (§11)
- `../domain/business-rules.md` (BR-040/043/045)
