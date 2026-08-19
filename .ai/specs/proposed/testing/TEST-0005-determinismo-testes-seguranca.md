# TEST-0005 — Determinismo dos testes de segurança

**Type:** TEST
**Status:** PROPOSED
**Issue:** #19
**Title:** Determinismo dos testes de segurança

## Problem

Os testes de segurança apresentam não-determinismo sob paralelismo: `uniqueTestEmail()` usa `Date.now()` + contador POR PROCESSO; suítes paralelas (rpc-ativar × rpc-remover) podem colidir no mesmo email → 422 "already been registered". Confirmado em 2 de 3 execuções (Fase 6).

## Current State

Fato confirmado: GAP-011 (Fase 6) + O-004 (Fase 9) + consequence do ADR-0011 `[CONFIRMED: runtime behavior — testing-strategy.md seção 5]`.

## Proposed State

Tornar a geração de identidades de teste imune a paralelismo (ex.: `crypto.randomUUID()` ou contador compartilhado) — decisão de implementação TBD.

## Motivation

- **FACTUAL:** falhas transitórias documentadas em execuções reais (não é hipótese).

## Evidence

GAP-011; O-004; ADR-0011 (Consequences item 3); `test-helpers.ts:112-118`.

## Scope

`uniqueTestEmail()` (e dados de teste derivados).

## Out of Scope

Reescrever as suítes; mudar Abordagem B.

## Impacted Tests

testing-strategy.md (seção 5); src/shared/security/test-helpers.ts

## Dependencies

Nenhuma.

## Risks

Baixo; atenção a compatibilidade com o domínio de email do Supabase test (`@meufenil-test.local`).

## Alternatives

A — `crypto.randomUUID()` no email · B — contador/processo compartilhado (ex.: arquivo/global) · C — sequencializar as suítes de segurança (vitest pool options) · D — manter status quo
**Decision:** TBD

## Open Questions

Nenhuma relevante.

## Acceptance Criteria

N execuções consecutivas (ex.: 5) sem colisão/falha transitória nas suítes de segurança; GAP-011 encerrado.

## Evidence / References

`.ai/.temp/analyses/22-auditoria-testes.md` (GAP-011); `.ai/.temp/analyses/25-documentacao-architecture-adrs.md` (O-004)
