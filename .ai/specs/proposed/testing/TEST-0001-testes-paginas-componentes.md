# TEST-0001 — Cobertura de testes de páginas e componentes

**Type:** TEST
**Status:** PROPOSED
**Title:** Cobertura de testes de páginas e componentes

## Problem

Apenas 1 das 9 páginas (Admin, com 5 módulos mockados) e NENHUM dos 10 componentes têm testes; AuthContext não tem teste direto; fluxos destrutivos (excluir conta, revogar acesso, desativar referência) não têm teste de UI.

## Current State

Fatos da Fase 6: GAP-001 (8 páginas), GAP-002 (10 componentes), GAP-003 (AuthContext só mockado), GAP-010 (fluxos destrutivos) `[CONFIRMED: test — testing-strategy.md]`.

## Proposed State

Iniciativa COERENTE de testes de UI (componentes/páginas), priorizando comportamento sobre cobertura percentual — decisão de escopo/prioridade TBD.

## Motivation

- **FACTUAL:** gaps confirmados com evidência (Fase 6).
- **ASSUMPTION:** testes de UI reduziriam regressões visuais/fluxos (hipótese padrão — não medida).

## Evidence

GAP-001/002/003/010; `.ai/specs/current/testing/testing-strategy.md` (seção 7).

## Scope

Páginas e componentes (escopo exato e ordem TBD — sugestão de partida: Perfil/destrutivos, Referencias, Dashboard, AdicionarRegistro, ConsentimentoLGPD).

## Out of Scope

Suítes de segurança (TEST-0002); determinismo (TEST-0005).

## Impacted Features

Todas as FEATs com UI (0001–0012)

## Impacted Tests

testing-strategy.md (atualizar limitações)

## Dependencies

Nenhuma obrigatória.

## Risks

Custo de manutenção de testes de UI; risco de testes quebradiços com mocks excessivos (observação da Fase 6 sobre Admin.test).

## Alternatives

A — testes por página com mocks de hooks · B — testes de componentes isolados primeiro · C — coverage-driven (a partir de linhas) · D — manter status quo
**Decision:** TBD

## Open Questions

Qual ordem de prioridade? Qual nível de mocking aceitável?

## Acceptance Criteria

Páginas/componentes-chave com testes de estados (loading/empty/error/auth) e interações; gaps Fase 6 atualizados.

## Evidence / References

`.ai/.temp/analyses/22-auditoria-testes.md` (GAP-001/002/003/010)
