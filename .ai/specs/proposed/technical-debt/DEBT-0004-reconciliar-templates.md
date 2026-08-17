# DEBT-0004 — Reconciliar templates e convenções do Specification System

**Type:** DEBT
**Status:** IMPLEMENTED
**Issue:** #9
**Implemented Through:** `templates/feature-spec.md` (T4 alinhado à prática real) · `templates/adr-template.md` (T5 com Origin DOCUMENTED/RECONSTRUCTED/UNKNOWN) · `templates/proposal-template.md` (T6 com estrutura da Fase 10 + categorias SEC/TEST) · `templates/component-spec.md` (novo) · `templates/business-rule.md` (novo) · `CONVENTIONS.md` (consolidado — Fase 12)
**Title:** Reconciliar templates e convenções do Specification System

## Problem

Quatro desalinhamentos acumulados entre templates/convenções e a prática das fases: (1) T4 (feature-spec) não prevê ID/Status/Actors/Flows usados nas 14 feature specs; (2) T5 (ADR) prevê Origin Historical/Reverse-engineered/Contemporary enquanto a Fase 9 usou DOCUMENTED/RECONSTRUCTED/UNKNOWN; (3) não existe template de business-rule (formato BR-XXX criado ad hoc na Fase 7); (4) CONVENTIONS.md (seção 2) não lista as categorias SEC e TEST introduzidas na Fase 10.

## Current State

Templates e CONVENTIONS intactos desde a Fase 1; adaptações registradas nos relatórios 23/24/25 (sem alteração silenciosa) `[CONFIRMED: filesystem, análises]`.

## Proposed State

Reconciliar templates (T4, T5), criar template de business-rule e atualizar CONVENTIONS.md (categorias de proposta) — após aprovação, seguindo o protocolo de alteração de specs.

## Motivation

- **FACTUAL:** divergências registradas entre template e prática (análises 23–25).

## Evidence

O-001 (análise 25); R-004 (análise 23); R-001 (análise 24); templates atuais em `.ai/specs/templates/`.

## Scope

templates/ (T4, T5, novo business-rule) + CONVENTIONS.md (seção 2) + referências.

## Out of Scope

Alterações em current/ de conteúdo.

## Dependencies

Nenhuma.

## Risks

Baixo; exige revisão humana (protocolo da seção 16 do CONVENTIONS).

## Alternatives

A — atualizar tudo de uma vez · B — atualizar apenas T4+T5 (mínimo) · C — manter status quo
**Decision:** TBD

## Open Questions

Adotar os valores Origin da Fase 9 (DOCUMENTED/RECONSTRUCTED/UNKNOWN) como padrão definitivo do template?

## Acceptance Criteria

Templates alinhados com a prática; template de business-rule criado; CONVENTIONS atualizado; sem contradição entre template e specs existentes.

## Evidence / References

`.ai/.temp/analyses/23/24/25` (R-004, R-001, O-001); `.ai/specs/templates/`
