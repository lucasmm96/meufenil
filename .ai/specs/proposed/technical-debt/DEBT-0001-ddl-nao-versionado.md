# DEBT-0001 — Versionar objetos sem DDL versionado

**Type:** DEBT
**Status:** IMPLEMENTED
**Implemented Through:** `supabase/migrations/20260814000000_baseline_objetos_nao_versionados.sql` (migration agregada idempotente, aplicada em dev e prod em 2026-08-14) · specs `current/database/*` e `current/security/security-model.md` atualizadas
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
**Decision:** A — decidido pelo solicitante em 2026-08-14

## Open Questions

Resolvidas em 2026-08-14: 1 migration AGREGADA (uma por objeto seria ordenação artificial); aplicar em dev E prod (fecha o drift também para o Supabase CLI).

## Acceptance Criteria

DDL versionado consistente com o catálogo; aplicação em dev/prod; specs de database atualizadas (campo "DDL versionado em").
- [x] DDL versionado consistente com o catálogo — migration conferida contra pg_policies/pg_constraint/pg_indexes/pg_get_functiondef/pg_get_triggerdef de dev e prod (2026-08-14; dev × prod idênticos no escopo)
- [x] Aplicação em dev/prod — via `scripts/apply-supabase-migrations.sh`; verificação pós-aplicação: estado idêntico ao pré-aplicação (única diferença: line-endings CRLF→LF no corpo de `fn_remover_favoritos_referencia_inativa`, semântica idêntica; trigger validado por teste transacional com ROLLBACK; 28/28 testes de segurança passando em dev)
- [x] Specs de database atualizadas — campo "DDL versionado em" em delegacoes_acesso, referencias_favoritas, referencias, registros, exames_pku, usuarios; rpc.md, triggers.md, overview.md e security-model.md

## Evidence / References

`.ai/.temp/analyses/18-documentacao-database.md`; `.ai/.temp/analyses/25-documentacao-architecture-adrs.md` (O-002)
