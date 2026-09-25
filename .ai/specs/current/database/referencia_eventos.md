# Tabela public.referencia_eventos

**Última verificação:** 2026-09-25 (ENH-0011 — `detalhes` dos eventos `referencia_arquivada`/`referencia_deletada` gerados por `aplicar_sync_referencias` passam a incluir `motivo` ('ausencia'|'substituicao'|'sweep'); campo opcional — eventos históricos sem motivo coexistem. Antes: 2026-09-24 — ENH-0009 — `referencia_deletada` adicionado ao enum; FK `pendencia_id` removida; seed `pre_sync_inativa` removido)
**DDL versionado em:** `supabase/migrations/20260905000000_referencias_sync_tabelas.sql` (tabela, linhas 131–155) e `20260905010000_referencias_sync_auditoria_is_ativa.sql` (trigger de auditoria manual)

## Propósito

Auditoria única da infraestrutura de sincronização e de mudanças de `is_ativa` em `referencias` (FEAT-0017 B7): trilha mínima de eventos — da sync iniciada à restauração — com vínculos para sync, pendência e referência e identidade textual preservada em `detalhes` quando a linha referenciada é removida. Fronteira OQ4: operações manuais atuais fora do sync (remoção/ativação/criação/edição por admin) NÃO ganham infra própria — a auditoria cobre a mudança de `is_ativa` manual e o fluxo de sync.

## Colunas

`[CONFIRMED: migration 20260905000000:131-140]`

| coluna | tipo | default | nullable | constraint | notas |
|---|---|---|---|---|---|
| `id` | uuid | `gen_random_uuid()` | NO | PK | |
| `sync_id` | uuid | — | YES | FK `referencia_syncs(id)` ON DELETE RESTRICT | sync do evento (NULL p/ `restore` e manuais) |
| `pendencia_id` | uuid | — | YES | ~~FK `referencia_sync_pendencias(id)` ON DELETE RESTRICT~~ (ENH-0009: tabela dropped, FK removida) | histórico de pendência decidida/cancelada (coluna permanece para registros legados) |
| `referencia_id` | uuid | — | YES | FK `referencias(id)` ON DELETE SET NULL | referência afetada — trilha preservada se removida |
| `tipo` | `sync_evento_tipo` (enum) | — | NO | — | 14 valores (abaixo) |
| `actor_id` | uuid | — | YES | FK `usuarios(id)` ON DELETE SET NULL | admin, Sistema ou NULL (seed pré-auditoria) |
| `detalhes` | jsonb | `'{}'::jsonb` | NO | — | contexto do evento (identidade, motivo, ids) |
| `created_at` | timestamp with time zone | `now()` | NO | — | |

Enum `sync_evento_tipo` = (`sync_started`, `extraction`, `validation`, `snapshot_created`, `backup_created`, `referencia_criada`, `referencia_arquivada`, **`referencia_deletada`**, `mudanca_aprovada`, `mudanca_rejeitada`, `is_ativa_manual`, `rollback`, `restore`, `pendencia_cancelada`, `pre_sync_inativa`) — criado na migration 20260905000000; `referencia_deletada` adicionado pela ENH-0009 (migration 20260923000000) `[CONFIRMED: migration]`. Nota: `mudanca_aprovada`/`mudanca_rejeitada`/`pendencia_cancelada`/`rollback`/`pre_sync_inativa` permanecem no enum como histórico mas não são gerados ativamente (ENH-0009 removeu curadoria, reverter e seed).

## Constraints e índices

`[CONFIRMED: migration 20260905000000:131-155]`

- `referencia_eventos_pkey` — PRIMARY KEY (`id`)
- `referencia_eventos_sync_id_idx` — btree (`sync_id`)
- `referencia_eventos_pendencia_id_idx` — btree (`pendencia_id`)
- `referencia_eventos_referencia_id_idx` — btree (`referencia_id`)
- `referencia_eventos_tipo_idx` — btree (`tipo`)
- `referencia_eventos_created_at_idx` — btree (`created_at` DESC)

## Relacionamentos (FKs)

- `sync_id` → `referencia_syncs(id)` ON DELETE RESTRICT (nullable)
- `pendencia_id` — FK para `referencia_sync_pendencias(id)` **removida pelo ENH-0009** (tabela dropped na migration 20260923000000); coluna permanece para registros históricos legados, sem FK ativa
- `referencia_id` → `referencias(id)` ON DELETE SET NULL — exclusão de conta (BR-026) e DELETE físico (ENH-0009) não órfã a trilha; identidade preservada em `detalhes`
- `actor_id` → `usuarios(id)` ON DELETE SET NULL

## Políticas RLS desta tabela

`[CONFIRMED: migration 20260905000000:218-223]`

| política | comando | alvo | USING / WITH CHECK | evidência |
|---|---|---|---|---|
| `admin_select_referencia_eventos` | SELECT | authenticated | USING: `is_admin_user(auth.uid())` | migration 20260905000000 (linhas 218–223) |

Notas factuais:
- Única política da tabela. NÃO há políticas de escrita — eventos gravados por RPCs SECURITY DEFINER, pelo trigger de auditoria e pela rota (service_role) `[CONFIRMED: migration, code]`.
- Grants explícitos de SELECT para `authenticated` e `service_role` (linhas 245–246) `[CONFIRMED: migration]`.

## Regras de negócio associadas

- Auditoria mínima de sync/curadoria e de alteração manual de `is_ativa` (BR-047) `[CONFIRMED: migrations]`.
- Trigger `trg_auditar_is_ativa_manual` (AFTER UPDATE OF `is_ativa` WHEN `auth.uid()` não-nulo) grava evento `is_ativa_manual`; suprime quando o GUC `app.audit_origin = 'curadoria'` — as RPCs de rollback/restauração já registram evento próprio (`rollback`/`restore`) e os flips de reativação NÃO viram `is_ativa_manual` (BR-042/BR-047) `[CONFIRMED: migration 20260905010000; testes REAL]`.
- Reativações fora de `ativar_referencia` só por rollback/restauração, com evento `rollback`/`restore` — nunca `ativar`/`is_ativa_manual` (BR-042) `[CONFIRMED: migration 20260906010000]`.
- Criações automáticas usam o ator Sistema (`sistema@meufenil.local` — resolução por email, ausente → fail-high); **ENH-0009 removeu** o seed de globais inativas legadas (actor NULL, `pre_sync_inativa`) — BR-047 `[CONFIRMED: migrations 20260906000000/20260923000000]`.
- Derivação do tipo de inativação (arquivada-pela-origem vs bloqueio manual) é feita pelos eventos (B8) — BR-042 `[CONFIRMED: code — compare.ts; migration 20260907000000]`.
- Sem trim automático (retenção não definida para eventos).

## Lifecycle

- **Criação (ENH-0009/ENH-0011):** rota `api/referencias-sync.ts` (service_role) — `sync_started`, `extraction`, `validation`, `snapshot_created`, `backup_created`; RPCs SECURITY DEFINER — `aplicar_sync_referencias` (`referencia_criada`/`referencia_arquivada`/`referencia_deletada` com actor Sistema; sem `pre_sync_inativa` — seed removido; **ENH-0011:** `detalhes` dos eventos de remoção incluem `motivo`), `restaurar_referencias_de_backup` (`restore`); trigger `trg_auditar_is_ativa_manual` (`is_ativa_manual` por admin autenticado). **ENH-0009 removeu:** `decidir_pendencia_referencia` (`mudanca_aprovada`/`mudanca_rejeitada`), `reverter_sync_referencias` (`rollback`/`pendencia_cancelada`) `[CONFIRMED: migrations 20260905000000/20260905010000/20260906000000/20260906010000/20260923000000/20260925000000]`.
- **Atualização/exclusão:** não suportadas — trilha imutável (sem política; sem canal) `[CONFIRMED: database]`.
- **Leitura:** admin (RLS); UI do Admin (M6) exibe a linha do tempo `[CONFIRMED: code]`.

## RPCs e triggers que tocam esta tabela

- Trigger `trg_auditar_is_ativa_manual` — função `fn_auditar_is_ativa_manual` — [triggers.md](triggers.md)
- RPCs `aplicar_sync_referencias`, `restaurar_referencias_de_backup` — [rpc.md](rpc.md)

## Testes que cobrem esta tabela

- `src/shared/security/rpc-referencias-sync.test.ts` — REAL: eventos de aplicação/curadoria, ator Sistema, GUC `app.audit_origin` `[CONFIRMED: test]`
- `src/shared/security/rpc-referencias-sync-seed.test.ts` — REAL ENH-0009: 1 teste negativo — global inativa + plano vazio → zero `pre_sync_inativa` (seed removido) `[CONFIRMED: test]`
- `src/shared/security/rpc-referencias-sync-rollback.test.ts` — REAL: eventos `rollback`/`restore`/`pendencia_cancelada`; flips não viram `is_ativa_manual` `[CONFIRMED: test]`
- `api/referencias-sync.test.ts` — REAL: eventos de estágio da rota `[CONFIRMED: test]`

## Evidências

- E1 — DDL, enum, índices e RLS: migration 20260905000000 `[CONFIRMED: migration]`
- E2 — Trigger de auditoria manual + GUC: migration 20260905010000 `[CONFIRMED: migration]`
- E3 — Escritas pelos RPCs e seed: migrations 20260906000000/20260906010000/20260907000000; ENH-0009: migration 20260923000000 (`referencia_deletada`; FK `pendencia_id` removida; seed suprimido); ENH-0011: migration 20260925000000 (`motivo` em `detalhes` dos eventos de remoção gerados pela RPC) `[CONFIRMED: migration]`

## Veja também

- [referencia_syncs.md](referencia_syncs.md) (~~[referencia_sync_pendencias.md](referencia_sync_pendencias.md)~~ — tabela dropped pelo ENH-0009)
- [rpc.md](rpc.md), [triggers.md](triggers.md), [../security/security-model.md](../security/security-model.md) (§11)
- `../domain/business-rules.md` (BR-042/047)
