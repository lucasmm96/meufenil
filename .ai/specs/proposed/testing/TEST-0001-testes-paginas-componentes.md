# TEST-0001 — Cobertura de testes de páginas e componentes

**Type:** TEST
**Status:** IMPLEMENTED
**Issue:** #15
**Title:** Cobertura de testes de páginas e componentes
**Implemented Through:** `current/testing/testing-strategy.md` (seções 2, 3, 5, 6, 7), `current/frontend/pages/{perfil,referencias,dashboard}.md`, `current/frontend/components/{adicionar-registro,consentimento-lgpd}.md` — testes em `src/react-app/pages/{Perfil,Referencias,Dashboard}.test.tsx` e `src/react-app/components/{AdicionarRegistro,ConsentimentoLGPD}.test.tsx` (69 testes novos; suíte 128 → 197)

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
**Decision:** A — testes por página com mocks de hooks (aprovado pelo autor em 2026-08-15)

## Open Questions

**Resolvidas em 2026-08-15 (decisão do autor):**
- Ordem de prioridade: ordem da proposta — Perfil/destrutivos → Referencias → Dashboard → AdicionarRegistro → ConsentimentoLGPD.
- Nível de mocking: mocks de hooks, seguindo o padrão existente em `src/react-app/pages/Admin.test.tsx`.

## Acceptance Criteria

Páginas/componentes-chave com testes de estados (loading/empty/error/auth) e interações; gaps Fase 6 atualizados.

## Evidence / References

`.ai/.temp/analyses/22-auditoria-testes.md` (GAP-001/002/003/010)
