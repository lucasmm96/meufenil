# ENH-0011 — Motivo de remoção no evento e no audit JSON

**Type:** ENH
**Status:** IMPLEMENTED
**Decision:** Alternativa B — Motivo como campo separado na `LinhaEventoRemocao`.
**Approved by:** Lucas Martins Menezes
**Approved on:** 2026-09-25
**Title:** Motivo de remoção no evento e no audit JSON
**Issue:** #95
**Created on:** 2026-09-25
**Implemented Through:** migration `20260925000000_enh_0011_motivo_remocao_audit.sql` + `api/referencias-sync.ts` (audit stage) — dev 2026-09-25, PR #97

## Problem

O audit JSON do sync (`details.estagios[].alteracoes[]`) lista referências removidas com `tipo` e `identidade`, mas não informa o **motivo** da remoção: se foi por ausência na origem (`ausencia`), substituição por nova identidade (`substituicao`) ou limpeza retroativa de referência inativa (`sweep`). Um admin que abre o detalhe de uma sync e vê "referencia_deletada" para uma referência não sabe por que ela foi removida.

## Current State

`[CONFIRMED: migrations 20260923000000, 20260924000000, 20260924010000; api/referencias-sync.ts:755–791]`

- `aplicar_sync_referencias` (RPC) usa `v_motivo` (`ausencia` | `substituicao`) para guiar a lógica de archive/delete na seção C do plano, e usa deleção direta sem motivo para o sweep retroativo (seção D). O valor de `v_motivo` não é persistido.
- `referencia_eventos.detalhes` armazena apenas `{nome, marca, fenil_mg_por_100g}` — a identidade da referência. Sem campo de motivo.
- ENH-0010 (audit stage): lê `referencia_eventos` e mapeia `ev.detalhes → identidade` na struct `LinhaEventoRemocao`. O motivo não aparece no JSON resultante.
- O `tipo` do evento (`referencia_arquivada` vs `referencia_deletada`) distingue archive de delete físico, mas não informa o motivo dentro de cada tipo.

## Proposed State

Adicionar `motivo` ao JSONB `referencia_eventos.detalhes` nos eventos de remoção gerados pela RPC `aplicar_sync_referencias`:

| Origem | tipo evento | motivo proposto |
|---|---|---|
| Plano — ausência na origem | `referencia_deletada` ou `referencia_arquivada` | `"ausencia"` |
| Plano — substituição por nova identidade | `referencia_arquivada` | `"substituicao"` |
| Sweep retroativo | `referencia_deletada` | `"sweep"` |

O audit stage (ENH-0010) é atualizado para surfaçar `motivo` como campo separado na struct `LinhaEventoRemocao`. Resultado no JSON da sync:
```json
{ "tipo": "referencia_deletada", "referencia_id": "...", "identidade": { "nome": "...", "marca": "...", "fenil_mg_por_100g": 100 }, "motivo": "ausencia" }
```

## Scope

- Nova migration que reescreve `aplicar_sync_referencias` (RPC):
  - Seção C: acrescenta `'motivo', v_motivo` ao `jsonb_build_object` de `v_identidade`.
  - Seção D (sweep): acrescenta `'motivo', 'sweep'` ao `jsonb_build_object` do evento `referencia_deletada`.
- Ajuste em `api/referencias-sync.ts`: `LinhaEventoRemocao` ganha campo `motivo: string | null` separado de `identidade`.
- Atualização de specs afetadas: [rpc.md](Specs-Current-Database-Rpc), [api-referencias-sync.md](Specs-Current-Backend-Api-Referencias-Sync), [referencia_eventos.md](Specs-Current-Database-Referencia_eventos).
- Atualização de testes: `rpc-referencias-sync.test.ts`, `api/referencias-sync.test.ts`.

## Out of Scope

- Retroativo: eventos já gravados em `referencia_eventos` sem `motivo` não serão atualizados.
- Eventos de outros tipos (`referencia_criada`, `restore`, etc.) — sem alteração.

## Impacted Features

- [FEAT-0017 — Sincronização de referências ANVISA](Specs-Archive-Implemented-Features-FEAT-0017-Sincronizacao-Referencias-Anvisa): estágio 7 (apply) e 7.5 (audit).

## Acceptance Criteria

- [x] Migration que reescreve `aplicar_sync_referencias`: seção C inclui `'motivo', v_motivo`; seção D inclui `'motivo', 'sweep'`.
- [x] Eventos `referencia_arquivada` e `referencia_deletada` gerados após a migration têm `detalhes.motivo` preenchido.
- [x] Eventos históricos sem `motivo` tratados como `null`/`undefined`.
- [x] `LinhaEventoRemocao` em `api/referencias-sync.ts` tem `motivo: string | null` como campo separado de `identidade`.
- [x] Audit JSON de sync tem `{ tipo, referencia_id, identidade: {nome, marca, fenil_mg_por_100g}, motivo }`.
- [x] `rpc-referencias-sync.test.ts` verifica `detalhes.motivo` nos eventos de archive/delete.
- [x] Specs atualizadas: `rpc.md`, `api-referencias-sync.md`, `referencia_eventos.md`, `FEAT-0017`.
