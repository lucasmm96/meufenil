# DEBT-0003 — Atualizar README (documentation drift)

**Type:** DEBT
**Status:** PROPOSED
**Title:** Atualizar README (documentation drift)

## Problem

O README diverge do estado atual em pelo menos dois pontos: descreve o keepalive acessando os DOIS bancos por execução (código: 1 alvo) e lista favoritos como "funcionalidades planejadas" (implementados).

## Current State

Drifts documentados nas Fases 4 e 7: README.md (seções "Keepalive diário" e "Funcionalidades planejadas") × código atual `[CONFIRMED: documentation × code]`.

## Proposed State

Atualizar o README para refletir o estado atual (1 alvo por execução; favoritos como funcionalidade implementada; revisar demais seções contra as specs).

## Motivation

- **FACTUAL:** drift registrado (a implementação é a fonte da verdade; o README está desatualizado).

## Evidence

`api/keepalive.ts:158-166` × README.md; favoritos implementados (Fase 2) × README "planejadas".

## Scope

README.md (visão de usuário — as specs continuam sendo a fonte canônica de detalhes).

## Out of Scope

Reescrever o README além da correção de drift.

## Impacted Features

FEAT-0008 (favoritos), FEAT-0013 (keepalive)

## Dependencies

Nenhuma.

## Risks

Baixo; exige cuidado para não reintroduzir informações desatualizadas.

## Alternatives

A — corrigir os dois pontos · B — revisão completa do README contra as specs · C — manter status quo
**Decision:** TBD

## Open Questions

Nenhuma relevante.

## Acceptance Criteria

README consistente com o código nas seções citadas; drift registrado encerrado.

## Evidence / References

`.ai/.temp/analyses/20-documentacao-backend.md` (drift); `.ai/.temp/analyses/23-documentacao-product-domain.md` (Documentation Drift)
