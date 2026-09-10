# DEBT-0007 — Gate de validação não cobre rotas Vercel em modo Node.js ESM

**Type:** DEBT
**Status:** PROPOSED
**Title:** Gate de validação não cobre rotas Vercel em modo Node.js ESM
**Issue:** TBD
**Created on:** 2026-09-10

## Problem

O gate local de validação (`tsc -b && vite build && npm run test:run`) não detecta erros de resolução de módulos ESM que só se manifestam no runtime do Vercel, levando bugs de deploy a passar por todos os checks automatizados.

## Current State

O gate de validação cobre três etapas (ver [testing-strategy.md](../../current/testing/testing-strategy.md)):
- `tsc -b` — type-check com `moduleResolution: Bundler` (não exige `.js` em imports relativos)
- `vite build` — compila apenas a SPA React em `src/react-app/`; não toca `api/`
- `npm run test:run` — Vitest com resolução bundler (extensões automáticas)

As funções serverless em `api/` são compiladas pelo Vercel com esbuild em **Node.js ESM estrito**, que exige extensão `.js` explícita em imports relativos. Essa compilação só ocorre no deploy — nunca localmente.

## Proposed State

Ao menos uma etapa do gate detecta imports relativos sem `.js` nos arquivos de `src/shared/` que são importados por `api/`. Opcões possíveis (decisão humana):

- **A — tsconfig dedicado para `api/`** com `"moduleResolution": "NodeNext"`, incluindo `src/shared/` no escopo. O `tsc -b` passa a exigir `.js` e falha em tempo de type-check.
- **B — lint rule** (`import/extensions` via eslint-plugin-import ou similar) aplicada a `api/` e `src/shared/`.
- **C — teste de smoke de import** em Node.js ESM puro (sem Vite/bundler) cobrindo o grafo de imports de `api/referencias-sync.ts`.

## Motivation

**FACTUAL:** Em 2026-09-10, `api/referencias-sync.ts` foi deployada com imports de `src/shared/powerbi/decode`, `query-payload`, `validate`, `canonical`, `compare` e `engine` sem extensão `.js`. O Vercel falhou em runtime com `ERR_MODULE_NOT_FOUND` no botão de sync — detectado apenas durante testes manuais pós-release, não pelo gate automatizado.

**FACTUAL:** O gate local passou completamente (build verde, 618 testes verdes) porque Vite e Vitest resolvem extensões automaticamente no modo bundler.

## Evidence

- Bug detectado em 2026-09-10 durante testes manuais de `v1.11.0` (FEAT-0017).
- Fix aplicado em `fix/esm-extensions-shared-modules` (`2ea335c`) — 6 arquivos, 12 imports corrigidos.
- Causa raiz: mismatch entre `moduleResolution: Bundler` (gate local) e Node.js ESM estrito (Vercel runtime).

## Scope

- Adicionar etapa ao gate que cubra resolução de módulos ESM em `api/` e `src/shared/`.
- A etapa deve falhar em CI (W1) quando imports relativos sem `.js` forem detectados.

## Out of Scope

- Mudar o `moduleResolution` global do projeto (afetaria `src/react-app/` desnecessariamente).
- Instalar ou configurar o Vercel CLI para testes locais de funções (melhoria separada).

## Impacted Features

- FEAT-0017 (sincronização de referências) — rota `api/referencias-sync.ts` é o único ponto de deploy afetado atualmente.

## Impacted Business Rules

N/A

## Impacted Architecture

- [testing-strategy.md](../../current/testing/testing-strategy.md) — gate W1 precisa ser estendido.
- [secrets-and-environments.md](../../current/security/secrets-and-environments.md) — ambiente de execução das rotas Vercel documentado ali.

## Impacted Frontend / Backend / Database / Security / Tests

- **Backend:** `api/` e `src/shared/` (grafo de imports das rotas Vercel).
- **Tests:** gate W1 (`tsc -b` ou lint ou smoke test).
- Frontend / Database / Security: N/A.

## Dependencies

Nenhuma.

## Risks

- **Alternativa A (tsconfig NodeNext):** pode exigir ajuste em outros imports de `src/shared/` usados por testes — baixo risco, já que Vitest ignora o tsconfig de produção.
- **Alternativa B (lint rule):** requer instalação de plugin; pode ter falsos positivos em imports de pacotes externos.
- **Alternativa C (smoke test):** mais frágil — depende de como o Node.js é invocado; pode divergir do comportamento do esbuild do Vercel.

## Alternatives

**Decision:** TBD — a escolha entre A, B e C é humana.

## Open Questions

1. Qual alternativa (A/B/C) tem melhor custo-benefício para o projeto?
2. A cobertura deve incluir apenas `api/referencias-sync.ts` ou todas as rotas futuras de `api/`?

## Acceptance Criteria

- [ ] O gate local (`npm run build` ou `npm run lint`) **falha** quando um import relativo sem `.js` é adicionado em `src/shared/` ou `api/`.
- [ ] O CI (W1) também falha na mesma condição.
- [ ] Nenhum falso positivo em imports de pacotes externos (ex.: `@supabase/supabase-js`).

## References

- Fix: `fix/esm-extensions-shared-modules`, commit `2ea335c`
- [api-referencias-sync.md](../../current/backend/api-referencias-sync.md)
- [testing-strategy.md](../../current/testing/testing-strategy.md)
