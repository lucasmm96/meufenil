# DEBT-0002 — Limite diário default duplicado (500 × 150)

**Type:** DEBT
**Status:** PROPOSED
**Title:** Limite diário default duplicado (500 × 150)

## Problem

Dois valores padrão coexistem: a coluna `usuarios.limite_diario_mg` tem default 500; o trigger de sign-up insere 150 em novos usuários.

## Current State

Ambos são fatos vigentes (BR-025): default da COLUNA = 500; valor inserido pelo TRIGGER = 150. Nenhum dos dois é "bug" comprovado `[CONFIRMED: database, migration]`.

## Proposed State

Decidir explicitamente o valor padrão de novos usuários (produto/clínico) e alinhar coluna × trigger — decisão humana necessária.

## Motivation

- **FACTUAL:** inconsistência documentada (BR-025; divergência Fase 7).
- **ASSUMPTION:** valor único reduz ambiguidade para usuários e para quem implementa (hipótese).

## Evidence

BR-025; `.ai/specs/current/domain/business-rules.md`; R-002 (análise 23); U-7.3 (intenção do 150 desconhecida).

## Scope

Default de `limite_diario_mg` para novos usuários.

## Out of Scope

Mudanças no limite de usuários existentes.

## Impacted Features

[FEAT-0004 Limite diário](../../current/features/FEAT-0004-limite-diario.md)

## Impacted Business Rules

BR-025 (e BR-002/003/004 indiretamente)

## Impacted Database

usuarios; triggers (handle_new_user)

## Dependencies

Nenhuma.

## Risks

Decisão clínica — requer validação com especialista (fora do escopo técnico).

## Alternatives

A — padronizar em 150 · B — padronizar em 500 · C — manter os dois (documentado) com justificativa explícita
**Decision:** TBD (decisão humana/clínica)

## Open Questions

Qual valor é clinicamente recomendado como padrão? (U-7.3)

## Acceptance Criteria

Valor único definido; coluna e trigger alinhados; BR-025 e specs atualizadas; migration se necessário.

## Evidence / References

`.ai/.temp/analyses/23-documentacao-product-domain.md` (R-002, U-7.3)
