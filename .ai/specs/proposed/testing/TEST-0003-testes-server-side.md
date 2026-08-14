# TEST-0003 — Testes server-side (edge functions, triggers, CLI)

**Type:** TEST
**Status:** PROPOSED
**Title:** Testes server-side (edge functions, triggers, CLI)

## Problem

Componentes server-side não têm testes: edge functions `delegar-acesso` e `delete-account` (incluindo o fluxo de exclusão em 3 passos), os triggers do banco (normalização de nome, retenção 365d, limpeza de favoritos) e o CLI/script de migrations.

## Current State

Fatos da Fase 6: GAP-005 (edge functions), GAP-008 (triggers), GAP-006 (CLI) `[CONFIRMED: test]`.

## Proposed State

Iniciativas de teste para esses componentes (estratégia TBD — ex.: testes de unidade das edge functions com mocks; testes de trigger contra banco de teste).

## Motivation

- **FACTUAL:** ausências confirmadas; `delete-account` é operação destrutiva não transacional (fato da Fase 4) — teste seria especialmente relevante.

## Evidence

GAP-005/006/008; `.ai/specs/current/backend/` (specs).

## Scope

Edge functions; triggers; CLI (menor prioridade — TBD).

## Out of Scope

E2E completo.

## Impacted Backend / Database / Tests

backend/*; database/triggers.md; testing-strategy.md

## Dependencies

DEBT-0001 (facilita teste de triggers com DDL versionado — não bloqueia).

## Risks

Testes de edge functions exigem ambiente Deno/mocks; testes de trigger exigem banco de teste dedicado (hoje usa-se o dev).

## Alternatives

A — testes unitários com mocks (Deno/vitest) · B — testes de integração das edge functions contra Supabase real · C — manter status quo
**Decision:** TBD

## Open Questions

Como executar testes Deno no fluxo atual (vitest)? Banco de teste dedicado ou dev?

## Acceptance Criteria

Edge functions com testes de fluxos principais e erros; triggers com testes de efeito; GAP-005/006/008 atualizados.

## Evidence / References

`.ai/.temp/analyses/22-auditoria-testes.md` (GAP-005/006/008)
