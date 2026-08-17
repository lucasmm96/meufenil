# DEBT-0003 — Atualizar README (documentation drift)

**Type:** DEBT
**Status:** IMPLEMENTED
**Issue:** #8
**Implemented Through:** `README.md` corrigido em 2026-08-15 (keepalive 1 alvo por execução; favoritos como funcionalidade implementada; funcionalidades implementadas faltantes adicionadas; env `VITE_APP_ENVIRONMENT` documentado) · specs atualizadas: `current/backend/api-keepalive.md`, `current/backend/overview.md`, `current/features/FEAT-0013-background-jobs.md`, `current/security/secrets-and-environments.md`
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
**Decision:** A — corrigir os dois pontos + revisão das demais seções contra as specs (conforme Proposed State); decidido pelo solicitante via pedido explícito de resolução (2026-08-15)

## Open Questions

Nenhuma relevante.

## Acceptance Criteria

- [x] README consistente com o código nas seções citadas — "Keepalive diário" agora descreve 1 alvo por execução (alinhado a `api/keepalive.ts:46-72,158-203` e aos 4 cenários de `api/keepalive.test.ts`); favoritos movidos de "planejadas" para implementadas (FEAT-0008)
- [x] Demais seções revisadas contra as specs — adicionadas funcionalidades implementadas ausentes (catálogo de referências com favoritos, delegação de acesso, painel administrativo); env `VITE_APP_ENVIRONMENT` documentado no Setup (inventário em `secrets-and-environments.md`); demais seções verificadas sem drift
- [x] Drift registrado encerrado — specs que registravam a divergência atualizadas (`api-keepalive.md`, `backend/overview.md`, `FEAT-0013`, `secrets-and-environments.md`); ADR-0007 mantido como registro histórico (precedente ADR-0009/DEBT-0001)

## Evidence / References

`.ai/.temp/analyses/20-documentacao-backend.md` (drift); `.ai/.temp/analyses/23-documentacao-product-domain.md` (Documentation Drift)
