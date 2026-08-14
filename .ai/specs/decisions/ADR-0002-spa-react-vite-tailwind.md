# ADR-0002 — SPA React + TypeScript + Vite + Tailwind

**Status:** Accepted
**Origin:** DOCUMENTED
**Data da decisão:** UNKNOWN (stack documentado no README; evolução visível no git desde 2025-12-15)
**Reconstruída por engenharia reversa em:** — (não se aplica — DOCUMENTED)

## Context

O frontend é uma SPA: React 19.0.0 + TypeScript 5.8.3 (strict) + Vite 6 + Tailwind 3.4 + React Router 7 + Recharts + lucide-react + date-fns(-tz), com PWA instalável (manifest; sem service worker) `[CONFIRMED: package.json, configuration]`. O README documenta o stack `[CONFIRMED: documentation]`.

## Decision

Construir o frontend como SPA React/TypeScript compilada com Vite, estilizada com Tailwind (configuração PADRÃO — sem design system/tokens customizados), roteamento client-side com React Router.

## Origin

DOCUMENTED — README.md ("Frontend: React, TypeScript, React Router, Tailwind CSS; Build: Vite").

## Evidence

- `package.json` (dependências exatas) `[CONFIRMED: configuration]`
- `vite.config.ts`, `tsconfig.json` (strict), `tailwind.config.js` (sem theme.extend) `[CONFIRMED: configuration]`
- `src/react-app/App.tsx` (BrowserRouter, 9 rotas) `[CONFIRMED: code]`
- `public/manifest.json` (PWA) `[CONFIRMED: configuration]`

## Consequences (OBSERVED)

1. 9 rotas sem guards no router (autenticação tratada por página) `[CONFIRMED: code]`.
2. Tailwind default como único sistema de estilos — padrões visuais ad hoc documentados como "padrões observados" (sem design system formal) `[CONFIRMED: code — Fase 5]`.
3. Sem offline/service worker — a capacidade PWA limita-se à instalação `[CONFIRMED: ausência — filesystem]`.
4. Agregações de dados executadas no browser (custos e padrões client-side) `[CONFIRMED: code — Fase 4]`.

## Alternatives

Não determinadas a partir das evidências disponíveis.

## Related Specs

- [../current/frontend/overview.md](../current/frontend/overview.md), [../current/features/FEAT-0014-pwa.md](../current/features/FEAT-0014-pwa.md)
- [ADR-0008](ADR-0008-sem-servidor-de-aplicacao.md)
