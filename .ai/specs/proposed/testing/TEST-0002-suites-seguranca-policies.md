# TEST-0002 — Suítes de segurança para policies não cobertas

**Type:** TEST
**Status:** PROPOSED
**Title:** Suítes de segurança para policies não cobertas

## Problem

As suítes de segurança reais (Abordagem B) cobrem apenas `usuarios` (RLS) e os 2 RPCs de referências; as policies de `registros`, `exames_pku`, `referencias_favoritas` e `delegacoes_acesso` (incluindo a família "dono ou delegado" e "referência ativa") não têm suíte; `get_estatisticas_admin` e as funções dashboard_* também não têm teste de autorização real.

## Current State

Fatos da Fase 6: GAP-007 e GAP-012 `[CONFIRMED: test — testing-strategy.md seção 7]`.

## Proposed State

Estender as suítes de segurança (padrão T1–T3: dono/delegado/admin/negação) para as policies/funções restantes — escopo e ordem TBD.

## Motivation

- **FACTUAL:** políticas vigentes sem verificação automatizada (a auditoria de segurança v1.6.1 cobriu os objetos que corrigiu — fato histórico, não limitação nova).

## Evidence

GAP-007/012; security-model.md (matrizes).

## Scope

Suítes para registros, exames_pku, referencias_favoritas, delegacoes_acesso; autorização de get_estatisticas_admin (e dashboard_* conforme REF-0002).

## Out of Scope

Correção de policies; auditoria nova.

## Impacted Security / Tests

security-model.md (seção 12); testing-strategy.md

## Dependencies

REF-0002 (dashboard_*), SEC-0001 (decisão de autorização pode mudar o que testar).

## Risks

Mesmos riscos das suítes atuais (banco dev real; TEST-0005).

## Alternatives

A — uma suíte por tabela (espelho de T1) · B — suíte única parametrizada · C — manter status quo
**Decision:** TBD

## Open Questions

Priorizar por criticidade ou por ordem de tabela?

## Acceptance Criteria

Cada policy relevante com cenário positivo/negativo real; GAP-007/012 atualizados.

## Evidence / References

`.ai/.temp/analyses/22-auditoria-testes.md` (GAP-007/012)
