# Feature Spec: PWA / multi-dispositivo

**ID:** FEAT-0014
**Tipo:** Current
**Status:** Implementada (parcial — instalação; sem offline)
**Última verificação:** 2026-08-13 (commit 6323664)

## Purpose

Permitir instalação da aplicação como PWA em dispositivos móveis/desktop, com identidade visual de app (ícones, cor de tema, orientação).

## Actors

- Usuário (instalação)

## Preconditions

- Navegador compatível com PWA

## Main Flow

1. Servidor serve `manifest.json` (`display: standalone`, `orientation: portrait-primary`, tema `#6366f1`, ícones 192/512/maskable, `lang: pt-BR`) `[CONFIRMED: configuration — public/manifest.json]`.
2. `index.html` referencia o manifest, theme-color, apple-touch-icon e metas OG/Twitter `[CONFIRMED: code — index.html]`.

## Alternative Flows

- N/A

## Error Flows

- N/A

## Business Rules

- NOT APPLICABLE (capability de plataforma; sem regras de negócio)

## Frontend

- [overview](../frontend/overview.md) (seção PWA); assets em `public/` (manifest, ícones)

## Backend

- N/A

## Database

- N/A

## Security

- N/A

## Tests

- NONE `[CONFIRMED: ausência — Fase 6]`
- **Coverage status:** CONFIRMED + UNTESTED

## Dependencies

- Hospedagem Vercel (serving dos assets)

## Related Features

- N/A

## Evidence

- E1 — `public/manifest.json`, `index.html`, `public/icons/` `[CONFIRMED: configuration, filesystem]`
- E2 — Ausência de service worker no repositório (sem cache/offline) `[CONFIRMED: ausência — filesystem]`

## Unknowns

- Comportamento de cache/service worker na plataforma Vercel (não implementado no repo — U-5.2).
