# ENH-0011 — Motivo de remoção no evento e no audit JSON

**Type:** ENH
**Status:** PROPOSED
**Title:** Motivo de remoção no evento e no audit JSON
**Issue:** TBD
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

O audit stage (ENH-0010) lê `ev.detalhes` e o expõe como `identidade` — `motivo` apareceria naturalmente em `identidade.motivo` no JSON da sync **sem alterar o TypeScript**, a menos que se prefira surfacear `motivo` como campo separado na struct (ver Alternativas).

## Motivation

`[FACTUAL]` O `v_motivo` já existe na RPC como valor local que guia a lógica de deleção/arquivamento (seção C). Persisti-lo em `detalhes` é um acréscimo pontual ao `jsonb_build_object` sem impacto no fluxo de controle.

`[FACTUAL]` O sweep retroativo (seção D) não tem motivo associado atualmente; um valor canônico `"sweep"` distingue essas deleções das deleções do plano corrente.

`[FACTUAL]` A informação de motivo tem valor de rastreabilidade: um admin pode determinar se uma referência foi removida porque sumiu da origem, porque foi substituída por versão diferente, ou porque era resíduo de syncs anteriores — distinções operacionalmente relevantes para diagnóstico.

`[ASSUMPTION]` O campo `motivo` dentro de `identidade` no JSON de audit é suficientemente claro; não é necessário reestruturar a `LinhaEventoRemocao` para surfaçá-lo como campo de primeiro nível (depende de decisão de UX).

## Evidence

- Gap identificado na sessão meuFenil018 (2026-09-25), durante a revisão D-4 de ENH-0009/ENH-0010: `v_motivo` guia a RPC mas não é persistido. Discussão: "implementamos pro json tbm refletir o motivo da remoção".
- `supabase/migrations/20260924010000_enh_0009_correcao2_sweep_mensagem.sql` — seção D (sweep) usa `jsonb_build_object('nome', ..., 'marca', ..., 'fenil_mg_por_100g', ...)` sem motivo.
- `api/referencias-sync.ts:755–791` — audit stage mapeia `ev.detalhes` diretamente para `identidade`.

## Scope

- Nova migration que reescreve `aplicar_sync_referencias`:
  - Seção C: acrescenta `'motivo', v_motivo` ao `jsonb_build_object` de `v_identidade` para eventos `referencia_arquivada`/`referencia_deletada`.
  - Seção D (sweep): acrescenta `'motivo', 'sweep'` ao `jsonb_build_object` do evento `referencia_deletada`.
- (Opcional — depende de decisão de UX) Ajuste em `api/referencias-sync.ts` (`LinhaEventoRemocao`) para surfaçar `motivo` como campo separado em vez de deixá-lo dentro de `identidade`.
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

- **Frontend:** N/A — o `JsonCodeBlock` do Admin exibe `selecionada.details` como JSON bruto; `motivo` aparecerá automaticamente em `identidade.motivo`.
- **Backend:** `api/referencias-sync.ts` — `LinhaEventoRemocao` e mapeamento do audit stage, se opção B for escolhida (ver Alternativas).
- **Database:** `aplicar_sync_referencias` (RPC) — nova migration que altera o `jsonb_build_object` em dois pontos; sem mudança de schema.
- **Security:** N/A — sem alteração de RLS, ACL ou SECURITY DEFINER.
- **Tests:** `rpc-referencias-sync.test.ts` — asserts sobre `detalhes` dos eventos de remoção precisam incluir `motivo`.

## Dependencies

Nenhuma.

## Risks

`[FACTUAL]` Eventos históricos sem `motivo` coexistirão com eventos novos que têm `motivo`. Código que lê `referencia_eventos.detalhes` deve tratar `motivo` como campo opcional.

`[ASSUMPTION]` O volume de eventos retroativos sem `motivo` não é um problema operacional (sync é ocasional; o campo é informativo).

## Alternatives

**A — Motivo dentro de `identidade` (proposta principal):** Acrescenta `motivo` ao `jsonb_build_object` existente. Sem mudança no TypeScript. No JSON de audit, `motivo` aparece em `identidade.motivo` — semanticamente misto (identidade + razão de remoção no mesmo objeto), mas simples de implementar.

**B — Motivo como campo separado na `LinhaEventoRemocao`:** Além da mudança na RPC, atualiza `LinhaEventoRemocao` para `{ tipo, referencia_id, identidade: {nome, marca, fenil}, motivo: string | null }` e ajusta o mapeamento no audit stage. Separação semântica mais limpa; exige mudança em TypeScript + testes de integração.

**C — Não implementar:** Manter o estado atual; `tipo` do evento distingue archive de delete; motivo fica implícito nos dados do plano (não auditável no JSON de sync). Custo zero.

**Decision:** TBD — **Approved by:** — **Approved on:** —

## Open Questions

1. A opção A (motivo dentro de `identidade`) é suficiente, ou a separação semântica da opção B justifica o custo adicional em TypeScript/testes?
2. O valor `"sweep"` para deleções retroativas é claro suficiente, ou seria melhor `"sweep_retroativo"` / `"inativa_retroativa"`?

## Acceptance Criteria

*(Condicionais à alternativa escolhida)*

**Comum às opções A e B:**
- [ ] Migration que reescreve `aplicar_sync_referencias`: seção C inclui `motivo` (`ausencia`/`substituicao`) em `detalhes` do evento; seção D inclui `motivo: 'sweep'`.
- [ ] Eventos `referencia_arquivada` e `referencia_deletada` gerados após a migration têm `detalhes.motivo` preenchido.
- [ ] Eventos históricos sem `motivo` tratados como `null`/`undefined` (não quebram leitores).
- [ ] `rpc-referencias-sync.test.ts` verifica `detalhes.motivo` nos eventos de archive/delete.
- [ ] Specs atualizadas: `rpc.md`, `api-referencias-sync.md`, `referencia_eventos.md`.

**Se opção B (adicional):**
- [ ] `LinhaEventoRemocao` em `api/referencias-sync.ts` tem campo `motivo` separado de `identidade`.
- [ ] Audit JSON de sync tem `{ tipo, referencia_id, identidade: {nome, marca, fenil}, motivo }` (motivo de primeiro nível).

## References

- [api-referencias-sync.md](../../current/backend/api-referencias-sync.md) — step 7 e 7.5
- [rpc.md](../../current/database/rpc.md) — `aplicar_sync_referencias` (Efeitos ENH-0009)
- [referencia_eventos.md](../../current/database/referencia_eventos.md)
- Sessão meuFenil018 (2026-09-25) — gap identificado na revisão D-4
