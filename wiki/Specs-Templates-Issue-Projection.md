# Template — Issue Projection (Spec → GitHub Issue)

**Uso:** formato canônico do corpo da Issue canônica de uma proposta (ligação 1:1 — `CONVENTIONS.md` §18.2/§18.3; Blueprint v1.1-final §20). A projeção é gerada pelo sync (`scripts/spec-github/`); este template define o contrato.

**Regras:**
- O bloco entre `SPEC-PROJECTION:START` e `SPEC-PROJECTION:END` é a ÚNICA região que o Claude edita/regrava. É gerado a partir da Spec (fonte de verdade).
- Conteúdo FORA do bloco — especialmente discussão humana — NUNCA é sobrescrito.
- Comentários de sincronização de Claude carregam marker `<!-- sync:<evento> -->` para deduplicação (idempotência).
- PRs linkam a Issue com `Part of #N` / `Related to #N` — **nunca** `Closes #N` (D-1).
- Fechamento da Issue segue a distinção decisão × execução mecânica (`CONVENTIONS.md` §18.6, D-12).

---

```
> **Spec:** `<ID>` · **Tipo:** <FEAT|ENH|REF|DEBT|SEC|TEST> · **Arquivo:** `.ai/specs/proposed/<categoria>/<ID>-<slug>.md`
> **Status da Spec:** <PROPOSED|ACCEPTED|IMPLEMENTATION|IMPLEMENTED|REJECTED|SUPERSEDED> · **Prioridade:** ver Project · **Milestone:** <quando houver>

<!-- SPEC-PROJECTION:START — bloco GERADO a partir da Spec. Claude atualiza esta seção; edições manuais aqui serão sobrescritas na próxima sincronização. -->
## Problema

<## Problem da Spec>

## Estado proposto

<## Proposed State da Spec>

## Critérios de aceitação

<## Acceptance Criteria da Spec>

## Decisão

<**Decision:** da Spec — ou "— (aguardando decisão humana)">

<!-- SPEC-PROJECTION:END -->

---
Discussão operacional: progresso, bloqueios, aprovações e validações. (Conteúdo humano — NUNCA sobrescrito por Claude.)
```

**Campos complementares (fora do bloco, gerenciados no GitHub):**
- Título: `[<ID>] <Título da Spec>` (Spec vence).
- Labels: `spec:<ID>` + label do tipo (`feat` · `enhancement` · `refactor` · `technical-debt` · `security` · `testing`) + `spec-driven`.
- Milestone: alvo de release (operacional; não existe na Spec).
