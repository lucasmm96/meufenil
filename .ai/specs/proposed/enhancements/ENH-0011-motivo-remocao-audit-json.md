# ENH-0011 — Motivo de remoção no evento e no audit JSON

**Type:** ENH
**Status:** ACCEPTED
**Title:** Motivo de remoção no evento e no audit JSON
**Issue:** #95
**Created on:** 2026-09-25

## Problem

O audit JSON do sync (`details.estagios[].alteracoes[]`) lista referências removidas com `tipo` e `identidade`, mas não informa o **motivo** da remoção: se foi por ausência na origem (`ausencia`), substituição por nova identidade (`substituicao`) ou limpeza retroativa de referência inativa (`sweep`). Um admin que abre o detalhe de uma sync e vê "referencia_deletada" para uma referência não sabe por que ela foi removida.

## Current State

`[CONFIRMED: migrations 20260923000000, 20260924000000, 20260924010000; api/referencias-sync.ts:755–791]`

- `aplicar_sync_referencias` (RPC) usa `v_motivo` (`ausencia` | `substituicao`) para guiar a lógica de archive/delete na seção C do plano, e usa deleção direta sem motivo para o sweep retroativo (seção D). O valor de `v_motivo` não é persistido.
- `referencia_eventos.detalhes` armazena apenas `{nome, marca, fenil_mg_por_100g}` — a identidade da referência. Sem campo de motivo.
- ENH-0010 (audit stage): lê `referencia_eventos` e mapeia `ev.detalhes → identidade` na struct `LinhaEventoRemocao`. O motivo não aparece no JSON resultante.
- O `tipo` do evento (`referencia_arquivada` vs `referencia_deletada`) distingue archive de delete físico, mas não informa o motivo dentro de cada tipo.

Ver: [api-referencias-sync.md](../../current/backend/api-referencias-sync.md), [rpc.md](../../current/database/rpc.md) (`aplicar_sync_referencias`), [referencia_eventos.md](../../current/database/referencia_eventos.md).

## Proposed State

Adicionar `motivo` ao JSONB `referencia_eventos.detalhes` nos eventos de remoção gerados pela RPC `aplicar_sync_referencias`:

| Origem | tipo evento | motivo proposto |
|---|---|---|
| Plano — ausência na origem | `referencia_deletada` ou `referencia_arquivada` | `"ausencia"` |
| Plano — substituição por nova identidade | `referencia_arquivada` | `"substituicao"` |
| Sweep retroativo | `referencia_deletada` | `"sweep"` |

`detalhes` passaria a ser `{nome, marca, fenil_mg_por_100g, motivo}` para estes eventos.

O audit stage (ENH-0010) é atualizado para surfaçar `motivo` como campo separado na struct `LinhaEventoRemocao`, alinhado ao padrão histórico de `mudanca_rejeitada` (campo de primeiro nível em `detalhes`). Resultado no JSON da sync:
```json
{ "tipo": "referencia_deletada", "referencia_id": "...", "identidade": { "nome": "...", "marca": "...", "fenil_mg_por_100g": 100 }, "motivo": "ausencia" }
```

## Motivation

`[FACTUAL]` O `v_motivo` já existe na RPC como valor local que guia a lógica de deleção/arquivamento (seção C). Persisti-lo em `detalhes` é um acréscimo pontual ao `jsonb_build_object` sem impacto no fluxo de controle.

`[FACTUAL]` O sweep retroativo (seção D) não tem motivo associado atualmente; um valor canônico `"sweep"` distingue essas deleções das deleções do plano corrente.

`[FACTUAL]` A informação de motivo tem valor de rastreabilidade: um admin pode determinar se uma referência foi removida porque sumiu da origem, porque foi substituída por versão diferente, ou porque era resíduo de syncs anteriores — distinções operacionalmente relevantes para diagnóstico.

## Evidence

- Gap identificado na sessão meuFenil018 (2026-09-25), durante a revisão D-4 de ENH-0009/ENH-0010: `v_motivo` guia a RPC mas não é persistido. Discussão: "implementamos pro json tbm refletir o motivo da remoção".
- `supabase/migrations/20260924010000_enh_0009_correcao2_sweep_mensagem.sql` — seção D (sweep) usa `jsonb_build_object('nome', ..., 'marca', ..., 'fenil_mg_por_100g', ...)` sem motivo.
- `api/referencias-sync.ts:755–791` — audit stage mapeia `ev.detalhes` diretamente para `identidade`.

## Scope

- Nova migration que reescreve `aplicar_sync_referencias`:
  - Seção C: acrescenta `'motivo', v_motivo` ao `jsonb_build_object` de `v_identidade` para eventos `referencia_arquivada`/`referencia_deletada`.
  - Seção D (sweep): acrescenta `'motivo', 'sweep'` ao `jsonb_build_object` do evento `referencia_deletada`.
- Ajuste em `api/referencias-sync.ts`: `LinhaEventoRemocao` ganha campo `motivo: string | null` separado de `identidade`; mapeamento no audit stage lê `ev.detalhes.motivo` e `ev.detalhes` (sem `motivo`) separadamente.
- Atualização de specs afetadas: `rpc.md`, `api-referencias-sync.md`, `referencia_eventos.md`.
- Atualização de testes: `rpc-referencias-sync.test.ts` (verificar que `detalhes` do evento inclui `motivo`).

## Out of Scope

- Retroativo: eventos já gravados em `referencia_eventos` sem `motivo` não serão atualizados.
- Eventos de outros tipos (`referencia_criada`, `restore`, etc.) — sem alteração.
- Mudança no schema da coluna `detalhes` (já é JSONB, sem constraint).
- Alteração da lógica de negócio de archive/delete (apenas persistência de dado já computado).

## Impacted Features

- [FEAT-0017 — Sincronização de referências ANVISA](../../current/features/FEAT-0017-sincronizacao-referencias-anvisa.md): estágio 7 (apply) e 7.5 (audit).

## Impacted Business Rules

- BR-040, BR-042 — regras de archive/delete; a mudança não altera a lógica, apenas a rastreabilidade do evento.

## Impacted Architecture

N/A (sem nova decisão arquitetural).

## Impacted Frontend / Backend / Database / Security / Tests

- **Frontend:** N/A — o `JsonCodeBlock` do Admin exibe `selecionada.details` como JSON bruto; `motivo` aparecerá como campo de primeiro nível em cada entrada de `alteracoes[]`.
- **Backend:** `api/referencias-sync.ts` — `LinhaEventoRemocao` ganha `motivo: string | null`; mapeamento do audit stage lê `ev.detalhes.motivo` e constrói `identidade` sem o campo `motivo`.
- **Database:** `aplicar_sync_referencias` (RPC) — nova migration que altera o `jsonb_build_object` em dois pontos; sem mudança de schema.
- **Security:** N/A — sem alteração de RLS, ACL ou SECURITY DEFINER.
- **Tests:** `rpc-referencias-sync.test.ts` — asserts sobre `detalhes` dos eventos de remoção precisam incluir `motivo`.

## Dependencies

Nenhuma.

## Risks

`[FACTUAL]` Eventos históricos sem `motivo` coexistirão com eventos novos que têm `motivo`. Código que lê `referencia_eventos.detalhes` deve tratar `motivo` como campo opcional.

`[ASSUMPTION]` O volume de eventos retroativos sem `motivo` não é um problema operacional (sync é ocasional; o campo é informativo).

## Alternatives

**A — Motivo dentro de `identidade`:** Acrescenta `motivo` ao `jsonb_build_object` existente. Sem mudança no TypeScript. No JSON de audit, `motivo` aparece em `identidade.motivo` — semanticamente misto (identidade + razão de remoção no mesmo objeto). Não escolhida.

**B — Motivo como campo separado na `LinhaEventoRemocao` (escolhida):** Além da mudança na RPC, atualiza `LinhaEventoRemocao` para `{ tipo, referencia_id, identidade: {nome, marca, fenil}, motivo: string | null }` e ajusta o mapeamento no audit stage. Separação semântica limpa; padrão consistente com `mudanca_rejeitada` histórico (campo de primeiro nível em `detalhes`). Exige mudança em TypeScript + testes de integração.

**C — Não implementar:** Manter o estado atual. Não escolhida.

**Decision:** Alternativa B — **Approved by:** Lucas Martins Menezes — **Approved on:** 2026-09-25

## Open Questions

Nenhuma — decisão registrada (Alternativa B; valores `ausencia`/`substituicao`/`sweep` confirmados).

## Acceptance Criteria

- [ ] Migration que reescreve `aplicar_sync_referencias`: seção C inclui `'motivo', v_motivo` em `detalhes` dos eventos `referencia_arquivada`/`referencia_deletada`; seção D inclui `'motivo', 'sweep'` no evento `referencia_deletada`.
- [ ] Eventos `referencia_arquivada` e `referencia_deletada` gerados após a migration têm `detalhes.motivo` preenchido (`ausencia`, `substituicao` ou `sweep`).
- [ ] Eventos históricos sem `motivo` tratados como `null`/`undefined` (não quebram leitores).
- [ ] `LinhaEventoRemocao` em `api/referencias-sync.ts` tem `motivo: string | null` como campo separado de `identidade`.
- [ ] Audit JSON de sync tem `{ tipo, referencia_id, identidade: {nome, marca, fenil_mg_por_100g}, motivo }` (motivo de primeiro nível em cada entrada de `alteracoes[]`).
- [ ] `rpc-referencias-sync.test.ts` verifica `detalhes.motivo` nos eventos de archive/delete.
- [ ] Specs atualizadas: `rpc.md`, `api-referencias-sync.md`, `referencia_eventos.md`, `FEAT-0017`.

## References

- [api-referencias-sync.md](../../current/backend/api-referencias-sync.md) — step 7 e 7.5
- [rpc.md](../../current/database/rpc.md) — `aplicar_sync_referencias` (Efeitos ENH-0009)
- [referencia_eventos.md](../../current/database/referencia_eventos.md)
- Sessão meuFenil018 (2026-09-25) — gap identificado na revisão D-4
