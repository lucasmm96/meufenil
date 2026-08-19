# DEBT-0002 — Limite diário default duplicado (500 × 150)

**Type:** DEBT
**Status:** IMPLEMENTED
**Issue:** #7
**Implemented Through:** migration `supabase/migrations/20260815000000_limite_diario_default_500.sql` (aplicada em dev e prod em 2026-08-15 — commit `5e6467b`) · specs atualizadas: `current/domain/business-rules.md` (BR-025), `current/domain/domain-model.md`, `current/features/FEAT-0001-autenticacao.md`, `current/features/FEAT-0004-limite-diario.md`, `current/database/usuarios.md`, `current/database/triggers.md`, `current/database/rpc.md`, `current/database/overview.md`, `current/product/glossary.md`, `current/product/overview.md`
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
**Decision:** B — padronizar em 500; decidido pelo solicitante em 2026-08-15

## Open Questions

Resolvida pela decisão B (2026-08-15) — U-7.3 tornou-se irrelevante: o valor 150 deixou de existir no sign-up.

## Acceptance Criteria

- [x] Valor único definido (500 — decisão B, 2026-08-15)
- [x] Coluna e trigger alinhados — `handle_new_user` sem `limite_diario_mg` no INSERT; default da coluna vale (migration 20260815000000; verificado em dev: `pg_get_functiondef` sem 150 e usuário de teste criado com limite 500)
- [x] BR-025 e specs atualizadas (business-rules, domain-model, FEAT-0001/0004, database/usuarios·triggers·rpc·overview, product/glossary·overview)
- [x] Migration criada e aplicada em dev e prod (2026-08-15; prod verificado read-only via `pg_get_functiondef`)

## Evidence / References

`.ai/.temp/analyses/23-documentacao-product-domain.md` (R-002, U-7.3)
