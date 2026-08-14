# DEBT-0001 — Versionar objetos sem DDL versionado

**Type:** DEBT
**Status:** PROPOSED
**Title:** Versionar objetos sem DDL versionado

## Problem

Parte do schema real não possui DDL em nenhuma migration: tabelas `referencias_favoritas` e `delegacoes_acesso`, coluna `referencias.is_ativa`, trigger/função de favoritos e ~20 políticas consolidadas — aplicadas por canal não-versionado.

## Current State

Objetos presentes idênticos em dev e prod; ausentes de todas as migrations (raiz e supabase/migrations); DDL recuperado por catálogo na Fase 2 `[CONFIRMED: database × migration — database/overview.md]`.

## Proposed State

AVALIAR o versionamento dos objetos (ex.: migration de baseline refletindo o estado real) — não é decidir que o estado atual "está errado".

## Motivation

- **FACTUAL:** drift migrations × banco documentado (Fase 2; ADR-0009 consequence).
- **ASSUMPTION:** versionar reduz risco de reconstrução de ambiente e drift futuro (hipótese razoável, não medida).

## Evidence

`.ai/specs/current/database/overview.md` (objetos sem DDL); O-002 (análise 25); ADR-0009.

## Scope

Objetos listados acima (2 tabelas + coluna + trigger/função + policies).

## Out of Scope

Reescrever histórico de migrations; alterar o banco.

## Impacted Database

database/* (6 specs afetadas)

## Impacted Security

Policies consolidadas (security-model aponta para elas)

## Dependencies

Nenhuma obrigatória (TEST-0003 de triggers é facilitada por isso, mas não depende).

## Risks

Migration de baseline incorreta poderia divergir dos ambientes — exige conferência com catálogo (Fase 2 fornece o material).

## Alternatives

A — migration de baseline com o estado real · B — manter status quo documentado (specs já cobrem o estado real) · C — reconstruir histórico completo (inviável — UNKNOWN de origem)
**Decision:** TBD

## Open Questions

Gerar 1 migration agregada ou 1 por objeto? Aplicar em dev e prod?

## Acceptance Criteria

DDL versionado consistente com o catálogo; aplicação em dev/prod; specs de database atualizadas (campo "DDL versionado em").

## Evidence / References

`.ai/.temp/analyses/18-documentacao-database.md`; `.ai/.temp/analyses/25-documentacao-architecture-adrs.md` (O-002)
