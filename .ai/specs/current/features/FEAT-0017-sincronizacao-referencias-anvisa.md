# Feature Spec: Sincronização controlada de referências com a fonte ANVISA/Power BI

**ID:** FEAT-0017
**Tipo:** Current
**Status:** Implementada
**Última verificação:** 2026-09-25 (ENH-0011: `motivo` adicionado a `detalhes` dos eventos de remoção na RPC e surfaçado como campo separado no audit JSON; ENH-0009: curadoria/rollback/bootstrap/seed removidos; ENH-0010: estágio audit adicionado após o apply)

## Purpose

Mecanismo recorrente, controlado e auditável de sincronização do conjunto `is_global = true` de `referencias` com a origem (relatório Power BI associado à ANVISA): extrai, valida, compara, aplica mudanças automaticamente (substituições auto-aplicadas, deleção física integrada, sweep retroativo), tira snapshot/backup por execução e permite restauração excepcional auditada. Entregue nos marcos M1–M6: schema (M1), extração/validação/snapshot/backup (M2), motor puro (M3), aplicação (M4), restauração (M5), UI admin (M6). ENH-0009 eliminou curadoria, rollback seletivo e bootstrap.

## Actors

- Vercel Cron (produtor agendado — semanal); Admin (UI de sincronizações/recuperação)
- Ator Sistema (`sistema@meufenil.local` — identidade real no Supabase Auth, provisionada por `scripts/provisionar-ator-sistema.js`): autor das criações/arquivamentos automáticos
- service_role (rota `/api/referencias-sync`)

## Preconditions

- Modelo canônico do ENH-0004 aplicado (coluna `marca`; identidade `nome+marca+fenil_mg_por_100g`) `[CONFIRMED: migrations, código]`
- Ator Sistema provisionado no ambiente antes da 1ª sync com criações `[CONFIRMED: migration 20260906000000 — fail-high]`

## Main Flow

1. Gatilho: cron semanal (`vercel.json` — `/api/referencias-sync`, `0 12 * * 1`) ou execução manual sob demanda; rota registra a sync como linha `running` em `referencia_syncs` (single-flight: segunda simultânea viola índice parcial e responde 409) + evento `sync_started` `[CONFIRMED: configuration — vercel.json; migration 20260905000000:90-92]`.
2. Extração (estágio 2): decode/extract da origem em `src/shared/powerbi/` (módulos portados do `powerbi-export` — B1) `[CONFIRMED: code]`.
3. Validação (estágio 3): checks estruturais/tipos/duplicidades. Estrutura inesperada ou nenhuma linha válida restante → abort, status `origin_invalid`, nada aplicado. Anomalias de campo/tipo são rejeições **individuais**: a linha sai do payload (reportada com linha/nome/motivo no evento `validation`) e o sync segue com as válidas; marca nula = produto sem marca declarada → entra como `''`. Duplicidade conflitante (mesmo nome+marca, fenil divergente — BR-044 revisada 2026-09-14) rejeita **todas as linhas do grupo** (par inteiro — nenhum valor arbitrário vence; o produto fica fora até a origem estabilizar); não invalida a sync `[CONFIRMED: code — validate.ts; migration — rota]`.
4. Snapshot (estágio 4): payload decodificado **das linhas válidas** gravado em `referencia_snapshots` com sha256 e contagem + evento `snapshot_created` `[CONFIRMED: code]`.
5. Backup (estágio 5): estado pré-aplicação de `referencias` (globais) em `referencia_backups` com sha256 e contagem + evento `backup_created` `[CONFIRMED: code]`.
6. Comparação (estágio 6, motor M3 — simplificado pelo ENH-0009): `canonical.ts`/`compare.ts` (matching determinístico; consulta ativas e arquivadas globais) geram o plano `{ versao, criacoes, arquivamentos }` — `arquivamentos[].motivo: "ausencia"|"substituicao"`; substituições auto-aplicadas `[CONFIRMED: code — compare.ts; migration 20260923000000 (ENH-0009)]`.
7. Aplicação (estágio 7, RPC M4 — reescrita pelo ENH-0009/ENH-0011): `aplicar_sync_referencias` (RPC, service_role): criações, arquivamentos e **deleção física** (FK violation → degradação a arquivamento), **sweep retroativo** de até 100 globais inativas sem relacionamentos — tudo na mesma transação; guardas de estado (23505 → rollback total). **ENH-0011:** eventos de remoção têm `detalhes = {nome, marca, fenil_mg_por_100g, motivo}` (`ausencia`|`substituicao`|`sweep`). Retorna `{ sync_id, equivalentes, criadas, arquivadas, deletadas }` `[CONFIRMED: code; migration 20260923000000 (ENH-0009); migration 20260925000000 (ENH-0011)]`.
7.5. Audit (ENH-0010/ENH-0011): quando `arquivadas > 0 || deletadas > 0`, a rota lê `referencia_eventos` para o sync atual (`tipo IN ('referencia_deletada', 'referencia_arquivada')`) e adiciona `{ estagio: 'audit', status: 'ok', alteracoes: [{ tipo, referencia_id, identidade, motivo }] }` em `details.estagios`; **ENH-0011:** `motivo` extraído de `ev.detalhes` como campo separado de `identidade = {nome, marca, fenil_mg_por_100g}` (eventos históricos: `motivo: null`); isolado em try/catch — falha não impede conclusão `[CONFIRMED: code — api/referencias-sync.ts; migration 20260925000000]`.
8. Conclusão (estágio 8 — simplificado pelo ENH-0009): rota finaliza a sync sempre como `success` (sem pendências/curadoria); `failure` apenas em erro técnico `[CONFIRMED: code — rota]`.

## Alternative Flows

- **Sync com extração/validação inválida aborta** (BR-039): origem inválida ou zero linhas válidas → status `origin_invalid`, nada aplicado `[CONFIRMED: code — compare.ts; api/referencias-sync.ts]`.
- **Arquivada-pela-origem reaparece** (BR-042): tratada como referência NOVA — criada automaticamente `[CONFIRMED: code — compare.ts]`.
- **Bloqueio manual preservado** (BR-042): global inativa sem evento de arquivamento por sync → presença na origem é silêncio (ENH-0009 removeu seed `pre_sync_inativa` e `derivarModoSync`/bootstrap) `[CONFIRMED: code; migration 20260923000000]`.
- **Restauração excepcional** (BR-046): `restaurar_referencias_de_backup` reverte o catálogo global a um backup com verificação sha256; flips auditados como `restore`, nunca `is_ativa_manual`; `pendencias_canceladas` sempre 0 (ENH-0009 — sem pendências) `[CONFIRMED: migration 20260906010000; 20260923000000]`.

## Error Flows

- Origem inválida/não confiável → `origin_invalid`/`failure` antes de efeito (B9 — sem retry) `[CONFIRMED: migration, code]`
- Estado mudou durante a sync (23505/linha alterada) → exceção → sync `failure` (retry limpo na próxima) `[CONFIRMED: migration 20260923000000]`
- Ator Sistema ausente e plano com criações → fail-high (`raise exception` orienta `scripts/provisionar-ator-sistema.js`) `[CONFIRMED: migration 20260923000000]`
- Sync simultânea → 409 single-flight sem registrar linha `[CONFIRMED: migration 20260905000000; teste REAL]`
- Chamadas sem autorização (RPCs de recuperação sem `pode_operar_recuperacao`, aplicar fora de service_role) → permissão negada `[CONFIRMED: migrations 20260906010000/20260923000000]`
- Restauração com payload corrompido → sha256 não confere → aborta antes de qualquer efeito `[CONFIRMED: migration 20260906010000]`

## Business Rules

- [BR-038](../domain/business-rules.md) — sincronização controla apenas globais
- [BR-039](../domain/business-rules.md) — sync com extração/validação inválida aborta sem efeito
- [BR-040](../domain/business-rules.md) — mudança substantiva = arquivar + criar, auto-aplicada (ENH-0009)
- [BR-041](../domain/business-rules.md) — matching determinístico decide identidade
- [BR-042](../domain/business-rules.md) — arquivada não reativa; reaparição = nova; bloqueio manual preservado
- ~~[BR-043](../domain/business-rules.md) — curadoria~~ REVOGADO pelo ENH-0009
- [BR-044](../domain/business-rules.md) — duplicidade conflitante rejeita o par inteiro
- [BR-045](../domain/business-rules.md) — sync é unidade com ID único; single-flight
- [BR-046](../domain/business-rules.md) — backup pré-aplicação, retenção 12m; restauração excepcional com sha256
- [BR-047](../domain/business-rules.md) — auditoria de sync e de `is_ativa` manual; ator Sistema; fronteira OQ4

Afetadas (ressalvas em [business-rules.md](../domain/business-rules.md)): BR-023, BR-024, BR-026, BR-027 (exceção dos backups de 12m).

## Frontend

- [pages/admin.md](../frontend/pages/admin.md) (M6) — seções de sincronizações/curadoria/recuperação no painel admin (padrão FEAT-0012/ENH-0003)
- `src/react-app/services/referencias-sync.service.ts` + testes

## Backend

- [api-referencias-sync](../backend/api-referencias-sync.md) — rota `/api/referencias-sync` (estágios 1–8; cron semanal em `vercel.json`)
- `src/shared/referencias-sync/` — `canonical.ts`, `compare.ts` (matching/comparação/modo), `engine.ts` (execução dos estágios), `types.ts` (motor puro — sem banco)
- `src/shared/powerbi/` — `decode.ts`, `extract.ts`, `query-payload.ts`, `types.ts`, `validate.ts` (extração/validação — módulos portados do `powerbi-export`, B1)

## Database

- [referencia_syncs](../database/referencia_syncs.md), ~~referencia_sync_pendencias~~ (DROPPED — ENH-0009), [referencia_eventos](../database/referencia_eventos.md), [referencia_snapshots](../database/referencia_snapshots.md), [referencia_backups](../database/referencia_backups.md)
- [rpc](../database/rpc.md) — `aplicar_sync_referencias` (reescrita ENH-0009), ~~`decidir_pendencia_referencia`~~ (ELIMINADA ENH-0009), `pode_operar_recuperacao`, ~~`reverter_sync_referencias`~~ (ELIMINADA ENH-0009), `restaurar_referencias_de_backup` (reescrita ENH-0009), `fn_auditar_is_ativa_manual`, `fn_trim_referencia_backups`
- [triggers](../database/triggers.md) — `trg_auditar_is_ativa_manual`, `trg_trim_referencia_backups`; [referencias](../database/referencias.md), [usuarios](../database/usuarios.md) (`pode_recuperacao`)
- Migrations M1–M6: 20260905000000 (schema/enums/RLS/single-flight/trim), 20260905010000 (auditoria manual), 20260905020000 (R4-3 — ativar global só admin), 20260906000000 (aplicar/decidir), 20260906010000 (restauração + `pode_recuperacao`), 20260907000000 (seed `pre_sync_inativa`)
- Migração de precisão decimal (2026-09-11): 20260911000000 — `fenil_mg_por_100g` → `numeric(10,2)`; aplicada em dev e prod (release v1.11.0)
- ENH-0009 (2026-09-24): 20260923000000 — deleção física integrada ao sync; curadoria/rollback/bootstrap/seed removidos; `referencia_sync_pendencias` DROPPED; colunas `bootstrap`/`divergencias` removidas de `referencia_syncs`, `deletadas` adicionada; aplicada em dev (release v1.15.0) e prod

## Security

- [security-model](../security/security-model.md) (§11 tabelas de sync; §12 operações de recuperação) — RLS admin-only SELECT ×4 (referencia_sync_pendencias DROPPED), sem policies de escrita; escritas via service_role/RPCs SECURITY DEFINER; aplicação exclusiva service_role; restauração exige `pode_operar_recuperacao` (admin E flag); ator Sistema real no Auth; GUC `app.audit_origin` suprime trigger onde a RPC registra evento específico (ENH-0009 removeu GUC para curadoria)

## Tests

- Unit (motor/extração): `canonical.test.ts`, `compare.test.ts`, `engine.test.ts`, `src/shared/powerbi/validate.test.ts`, `decode.test.ts`, `extract.test.ts`
- REAL (banco): `api/referencias-sync.test.ts` (rota/estágios — inclui cenários ENH-0009/ENH-0010), `src/shared/security/rpc-referencias-sync.test.ts` (ENH-0009 — 9 testes: aplicação + guardas + state-changed rollback), `rpc-referencias-sync-rollback.test.ts` (ENH-0009 — 6 testes: restauração por backup), `rpc-referencias-sync-seed.test.ts` (ENH-0009 — 1 teste: seed removido → zero pre_sync_inativa), `src/react-app/services/referencias-sync.service.test.ts`, `Admin.test.tsx` (UI M6)
- **Coverage status:** TESTED — suítes do motor e REAL M1–M6 + ENH-0009/ENH-0010; lacunas conhecidas: calibração de margens de validação com a 1ª extração real e E2E do cron Vercel (ver Unknowns)

## Dependencies

- Vercel (cron semanal), Supabase (service_role; RLS), origem externa Power BI/ANVISA (payload via `query-payload.ts`)
- ENH-0004 (modelo canônico — base do matching), ator Sistema provisionado (`scripts/provisionar-ator-sistema.js`)

## Related Features

- [FEAT-0012 Painel administrativo](FEAT-0012-painel-administrativo.md) — UI do Admin estendida (sincronizações/curadoria/recuperação)
- [FEAT-0013 Background jobs](FEAT-0013-background-jobs.md) — infraestrutura Vercel cron reutilizada (B2; job usa a tabela própria de syncs — B6, fora do trim 365d da BR-027)
- [FEAT-0008 Referências alimentares](FEAT-0008-referencias-alimentares.md) — conjunto global, lifecycle e identidade (ENH-0004)

## Evidence

- E1 — Migrations M1–M6 (20260905000000 → 20260907000000) `[CONFIRMED: migration]`
- E2 — `vercel.json` (cron `0 12 * * 1`) + `api/referencias-sync.ts` `[CONFIRMED: configuration, code]`
- E3 — Motor puro: `src/shared/referencias-sync/*.ts`; extração: `src/shared/powerbi/*.ts` `[CONFIRMED: code]`
- E4 — Merges em development: M1 `5b1ed18` (PR #57), M2 `7ec0bf5` (PR #58), M3 `dd631d6` (PR #59), M4 `6e7d3e5` (PR #60), M5 `cb5d776` (PR #61), M6 `cb1123d` (PR #62) `[CONFIRMED: git]`
- E5 — Suítes REAL M1–M6 executadas contra dev; M1–M6 em prod desde a release v1.11.0 (2026-09-10) `[CONFIRMED: database — catálogo prod 2026-09-11]`
- E6 — ENH-0009: migration 20260923000000 (deleção física + simplificação — dev 2026-09-24, prod release v1.15.0) `[CONFIRMED: migration]`
- E7 — ENH-0010: `api/referencias-sync.ts` (estágio audit) — dev 2026-09-25, prod release v1.15.1 `[CONFIRMED: code]`
- E8 — ENH-0011: migration 20260925000000 + `api/referencias-sync.ts` (audit stage motivo) — dev 2026-09-25 `[CONFIRMED: migration, code]`

## Unknowns

- 1ª extração real com volume completo em produção (contagem/tamanho/variabilidade da origem) — calibração de margens do B9 (ver proposta arquivada)
- Retenção de snapshots — decisão em aberto (B3; sem trim automático hoje)
- Regra "toda global rastreia à origem" (OQ2): transição pós-bootstrap — aguarda a 1ª sync confiável validar o matching em produção
- E2E do cron Vercel (disparo real em produção — pós-release)
