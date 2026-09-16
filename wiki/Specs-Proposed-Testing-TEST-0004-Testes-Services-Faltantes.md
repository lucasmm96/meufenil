# TEST-0004 — Completar testes de services faltantes

**Type:** TEST
**Status:** PROPOSED
**Issue:** #18
**Title:** Completar testes de services faltantes

## Problem

`delegacoesAcesso.service.ts` é o ÚNICO service sem teste (listar/conceder/revogar/assumir/sair); `referencias.service.ts` tem 48% de linhas — operações update/activate/deleteOrDeactivate/toggleFavorito sem teste de service (as RPCs subjacentes têm suítes reais, mas o mapeamento/erros do service não).

## Current State

Fatos da Fase 6: GAP-004 e GAP-009 `[CONFIRMED: test — testing-strategy.md]`.

## Proposed State

Completar os testes de service faltantes (cobrindo sucesso, erro e mapeamento de AppError).

## Motivation

- **FACTUAL:** gaps confirmados; operações mutacionais (revogar, desativar, favoritar) sem cobertura na camada de service.

## Evidence

GAP-004/009; cobertura: referencias.service 48.23% (Fase 6).

## Scope

delegacoesAcesso.service (5 operações); referencias.service (4 operações faltantes).

## Out of Scope

Testes de UI (TEST-0001).

## Impacted Tests

testing-strategy.md (atualizar cobertura)

## Dependencies

Nenhuma.

## Risks

Baixo.

## Alternatives

A — testes por operação (padrão atual dos services) · B — manter status quo
**Decision:** TBD

## Open Questions

Nenhuma relevante.

## Acceptance Criteria

Operações faltantes com testes de sucesso/erro; GAP-004/009 encerrados; cobertura de services atualizada.

## Evidence / References

`.ai/.temp/analyses/22-auditoria-testes.md` (GAP-004/009)
