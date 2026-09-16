# Template — Proposta (Proposed)

**Uso:** itens de `proposed/`, com prefixo por categoria e numeração independente por categoria:

| Categoria | Prefixo | Diretório | Quando usar |
|---|---|---|---|
| `proposed/features/` | `FEAT-NNNN-*` | features/ | capability NOVA |
| `proposed/enhancements/` | `ENH-NNNN-*` | enhancements/ | melhoria de capability existente |
| `proposed/refactors/` | `REF-NNNN-*` | refactors/ | reestruturação sem mudança de comportamento |
| `proposed/technical-debt/` | `DEBT-NNNN-*` | technical-debt/ | dívida técnica/inconsistência/drift |
| `proposed/security/` | `SEC-NNNN-*` | security/ | melhoria de segurança com evidência de risco/inconsistência |
| `proposed/testing/` | `TEST-NNNN-*` | testing/ | melhoria de testes/cobertura/confiabilidade |

**Regras:** propostas NUNCA descrevem comportamento atual além do necessário para contextualizar — com link para `current/` em "Current State". Status inicial SEMPRE `PROPOSED`; uma proposta não é aprovada, priorizada ou comprometida por existir. Nada em `proposed/` é implementado sem decisão humana. Seções sem conteúdo recebem **N/A** ou **TBD**.

**Status possíveis (lifecycle — `CONVENTIONS.md` §8):** `PROPOSED` → `ACCEPTED` → `IMPLEMENTATION` → `IMPLEMENTED`; também `REJECTED` e `SUPERSEDED`. Estados terminais movem o arquivo para `archive/{implemented,rejected,superseded}/<categoria>/` no mesmo commit, com `proposed/index.md` atualizado (nunca apagar linha — ADR-0012). Campos obrigatórios por estado: `Decision:` + `Approved by/on:` (ACCEPTED) · `Implemented Through:` (IMPLEMENTED) · `Rejected on:` + razão (REJECTED) · `Superseded by:` (SUPERSEDED).

---

# <FEAT|ENH|REF|DEBT|SEC|TEST>-NNNN — <Título>

**Type:** FEAT | ENH | REF | DEBT | SEC | TEST
**Status:** PROPOSED
**Title:** <Título>
**Issue:** #N (GitHub — preenchido no mesmo fluxo de criação, via github-manager)
**Created on:** YYYY-MM-DD

## Problem

[Preencher — o problema/oportunidade em uma frase]

## Current State

[Preencher — o estado ATUAL que motiva a proposta, com link para `current/`; nunca julgamento ("está errado")]

## Proposed State

[Preencher — o possível futuro; não decidir automaticamente]

## Motivation

[Preencher — separar FACTUAL (evidência) de ASSUMPTION (hipótese, marcada como tal)]

## Evidence

[Preencher — origem da proposta: GAP-XXX, O-XXX, R-XXX, U-X.X, ADR-NNNN, drift documentado...]

## Scope

[Preencher — o que a proposta cobre]

## Out of Scope

[Preencher — o que fica de fora]

## Impacted Features

[Preencher — links para `current/features/`; N/A]

## Impacted Business Rules

[Preencher — BR-NNN; N/A]

## Impacted Architecture

[Preencher — links para architecture/ADRs; N/A]

## Impacted Frontend / Backend / Database / Security / Tests

[Preencher — links para as camadas afetadas; N/A por camada]

## Dependencies

[Preencher — dependências entre propostas; "Nenhuma"]

## Risks

[Preencher — riscos factuais/hipóteses marcadas]

## Alternatives

[Preencher — alternativas razoáveis SEM escolher. **Decision:** TBD — a escolha é humana e é obrigatória para ACCEPTED/IMPLEMENTED; na aprovação registrar **Approved by:** e **Approved on:**]

## Open Questions

[Preencher — perguntas que exigem decisão humana; não responder automaticamente]

## Acceptance Criteria

[Preencher — como validar que a proposta foi implementada corretamente; cobrir as alternativas com chance real de decisão, ou permanecer TBD até a decisão]

## References

[Preencher — links para análises/specs que originaram a proposta]
