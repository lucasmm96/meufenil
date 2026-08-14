# ENH-0001 — PWA offline / service worker

**Type:** ENH
**Status:** PROPOSED
**Title:** PWA offline / service worker

## Problem

A capacidade PWA limita-se à instalação (manifest/ícones); não há service worker, cache ou offline no repositório.

## Current State

Manifest completo (standalone, ícones 192/512/maskable, pt-BR); sem service worker; comportamento de cache da plataforma Vercel não verificado (U-5.2) `[CONFIRMED: configuration, filesystem — FEAT-0014]`.

## Proposed State

Avaliar a adição de cache/offline (ex.: service worker com cache estático e/ou dados limitados) — decisão TBD.

## Motivation

- **FACTUAL:** gap documentado (FEAT-0014 "sem offline").
- **ASSUMPTION:** offline beneficiaria uso contínuo da dieta em contextos sem rede (hipótese — não validada com usuários).

## Evidence

FEAT-0014 (spec); U-5.2; Fase 5 (PWA).

## Scope

Service worker, estratégia de cache, comportamento offline mínimo.

## Out of Scope

Sincronização offline de escrita (complexa — fora de escopo inicial).

## Impacted Features

[FEAT-0014 PWA](../../current/features/FEAT-0014-pwa.md)

## Impacted Frontend

Vite/PWA config; `public/`

## Impacted Tests

NONE hoje (FEAT-0014) — testes de build/installabilidade seriam necessários

## Dependencies

Nenhuma.

## Risks

Cache desatualizado de dados clínicos (ex.: referências); complexidade de invalidação.

## Alternatives

A — service worker com cache estático · B — cache estático + dados de leitura · C — manter status quo
**Decision:** TBD

## Open Questions

Quais dados podem ser cacheados sem risco? Necessidade real de offline para o público?

## Acceptance Criteria

TBD: PWA com cache definido; sem regressão de atualização de dados; testes.

## Evidence / References

`.ai/specs/current/features/FEAT-0014-pwa.md`; `.ai/.temp/analyses/21-documentacao-frontend.md`
