# REF-0002 — Destino das RPCs órfãs de dashboard

**Type:** REF
**Status:** PROPOSED
**Title:** Destino das RPCs órfãs `dashboard_hoje` e `dashboard_ultimos_dias`

## Problem

Duas funções SQL SECURITY DEFINER (baseline) não possuem chamadores conhecidos no código atual — o dashboard agrega no cliente.

## Current State

`dashboard_hoje(uid)` e `dashboard_ultimos_dias(uid, dias)` existem no banco, têm grants EXECUTE amplos, não têm `search_path` configurado e não têm verificação interna de autorização; grep 2026-08-13: zero chamadores `[CONFIRMED: database, code — Fase 4; rpc.md]`.

## Proposed State

Definir explicitamente o destino das funções (remover, reutilizar ou manter) — decisão TBD, sem remoção automática.

## Motivation

- **FACTUAL:** código morto server-side documentado (Fase 4; ADR-0008 consequence).
- **ASSUMPTION:** código morto com SECURITY DEFINER é superfície desnecessária (hipótese de segurança — SEC-0001 relacionado).

## Evidence

`.ai/specs/current/database/rpc.md`; `.ai/specs/current/architecture/overview.md` (ADR-0008); O-003 (análise 25).

## Scope

As 2 funções + referências em specs.

## Out of Scope

Outras funções/RPCs.

## Impacted Features

[FEAT-0005 Dashboard](../../current/features/FEAT-0005-dashboard.md)

## Impacted Database / Security

database/rpc.md; security-model.md (SECURITY DEFINER); SEC-0001

## Impacted Tests

GAP-012 (testes condicionados ao destino)

## Dependencies

SEC-0001 (avaliação conjunta das funções sem verificação interna); TEST-0002 (condicionado)

## Risks

Remoção exige migration; reutilização exige reavaliar agregação client-side (ADR-0008).

## Alternatives

A — remover (migration) · B — reutilizar no dashboard (mover agregação para o banco) · C — manter como está (documentado)
**Decision:** TBD

## Open Questions

Há intenção futura de usar RPCs no dashboard? (motivação histórica não determinada — ADR-0008)

## Acceptance Criteria

Destino definido e executado; specs (rpc.md, ADR-0008, FEAT-0005) atualizadas; testes conforme destino.

## Evidence / References

`.ai/.temp/analyses/20-documentacao-backend.md`; `.ai/.temp/analyses/25-documentacao-architecture-adrs.md` (O-003)
