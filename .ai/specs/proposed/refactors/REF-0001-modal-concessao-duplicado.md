# REF-0001 — Consolidar modal de concessão duplicado

**Type:** REF
**Status:** PROPOSED
**Issue:** #12
**Title:** Consolidar modal de concessão duplicado

## Problem

Dois componentes de concessão de acesso coexistem: `ModalConcederAcesso` (usado pelo Perfil) e `ConcederAcessoModal` (sem consumidor identificado) — divergência Fase 5.

## Current State

`Perfil.tsx` importa apenas `ModalConcederAcesso` (linhas 11 e 263) e o renderiza; `ConcederAcessoModal` tem validação e textos próprios e nenhum consumidor identificado `[CONFIRMED: code — grep; Perfil.tsx inalterado desde af63c41 (2026-03-22)]`.

## Proposed State

Consolidar em um único modal de concessão (remoção do órfão ou unificação dos comportamentos) — decisão TBD.

## Motivation

- **FACTUAL:** duplicação e órfão documentados (divergência 1 da Fase 5).
- **ASSUMPTION:** consolidar reduz manutenção e ambiguidade (hipótese razoável, não medida).

## Evidence

`.ai/specs/current/frontend/components/login-as.md`; `Perfil.tsx:11,263`; grep de consumidores (Fase 5); análise 35 (divergência factual corrigida no retrofit F8).

## Scope

Componentes de concessão de acesso.

## Out of Scope

Redesenho do fluxo de delegação.

## Impacted Features

[FEAT-0011 Delegação](../../current/features/FEAT-0011-delegacao-acesso.md)

## Impacted Frontend

login-as/, Perfil

## Impacted Tests

Nenhum teste de componente hoje (TEST-0001 relacionado)

## Dependencies

TEST-0001 (testar o modal consolidado)

## Risks

Baixo (UI); regressão de textos/validações ao unificar.

## Alternatives

A — remover `ConcederAcessoModal` (órfão) · B — unificar os dois em um componente · C — manter status quo documentado
**Decision:** TBD

## Open Questions

Qual dos dois comportamentos (erro inline vs. validação própria) é o desejado?

## Acceptance Criteria

Um único modal em uso; sem consumidor órfão; specs atualizadas.

## Evidence / References

`.ai/.temp/analyses/21-documentacao-frontend.md` (divergência 1)
