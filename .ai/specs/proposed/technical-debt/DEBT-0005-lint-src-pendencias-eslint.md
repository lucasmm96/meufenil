# DEBT-0005 — Pendências de lint em src/ (57 erros pré-existentes)

**Type:** DEBT
**Status:** PROPOSED
**Title:** Pendências de lint em src/ (57 erros pré-existentes)
**Issue:** #26
**Created on:** 2026-08-17

## Problem

`npm run lint` (`eslint .`) falha com 57 erros pré-existentes em `src/` (`react-hooks/rules-of-hooks`, `@typescript-eslint/no-explicit-any`, `no-unused-vars`), descobertos no primeiro run do CI W1 (F5, PR #25). O W1 ficou com lint escopado a `scripts/spec-github/**` até esta dívida ser tratada.

## Current State

- `eslint.config.js` vigente ignora apenas `.bun`, `node_modules`, `dist`; `npm run lint` = `eslint .` `[CONFIRMED: package.json, filesystem]`.
- CI W1 (`.github/workflows/ci.yml`) executa `npx eslint scripts/spec-github` em vez do lint completo, com comentário apontando para esta proposta `[CONFIRMED: workflow]`.
- Erros concentrados em: `AdicionarRegistro.tsx` (4 hooks condicionais), `any` em `AuthContext.tsx`, `Referencias.tsx`, `ConcederAcessoModal.tsx`, `ModalConcederAcesso.tsx`, testes de hooks/services/segurança, unused vars em `Home.tsx`, `Perfil.tsx`, `types.ts` e testes de segurança `[CONFIRMED: execução local e log do CI (run 32089115404), 2026-08-17]`.

## Proposed State

Lint verde no repositório inteiro: corrigir os 57 erros (ou justificar exceções pontuais com `eslint-disable` documentado) e restaurar o passo `npm run lint` completo no W1.

## Motivation

- **FACTUAL:** 57 erros / 4 warnings no `eslint .` (execução local, 2026-08-17); o W1 não pode rodar o lint completo com o estado atual.
- **ASSUMPTION:** os hooks condicionais de `AdicionarRegistro.tsx` podem indicar bugs reais de renderização — validar durante a implementação (não tratar como mero ajuste de estilo).

## Evidence

Log do CI W1 (run 32089115404, PR #25); execução local `npm run lint` (2026-08-17); `eslint.config.js`.

## Scope

Correções de lint em `src/**` (incluindo eventuais exceções documentadas no código); restauração do `npm run lint` no W1.

## Out of Scope

Novas regras de eslint; refactors de comportamento não relacionados ao lint; mudanças em `scripts/spec-github/**` (já limpo).

## Impacted Features

N/A — sem mudança de comportamento esperada; correções de comportamento reveladas pelos hooks condicionais devem ser avaliadas caso a caso com testes.

## Impacted Business Rules

N/A

## Impacted Architecture

N/A

## Impacted Frontend / Backend / Database / Security / Tests

- Frontend: `src/react-app/**` (AdicionarRegistro, AuthContext, Referencias, Home, Perfil, login-as)
- Security: `src/shared/security/*.test.ts` (unused vars)
- Tests: `any`/unused vars em testes de hooks, services e páginas
- Backend / Database: N/A

## Dependencies

Nenhuma

## Risks

- Corrigir hooks condicionais pode revelar/alterar comportamento real — exige validação com testes (não é trabalho "só de lint").
- `eslint-disable` sem justificativa documentada esconde problemas — registrar a razão em cada exceção.

## Alternatives

- **A.** Corrigir os 57 erros e restaurar o lint completo no CI (proposta).
- **B.** Manter o lint escopado indefinidamente (o CI nunca cobre `src/`).
- **C.** Relaxar regras globalmente no `eslint.config.js` (reduz o valor do gate). **Decision:** TBD — a escolha é humana e é obrigatória para ACCEPTED/IMPLEMENTED; na aprovação registrar **Approved by:** e **Approved on:**

## Open Questions

- Hooks condicionais de `AdicionarRegistro.tsx`: reordenar os hooks (possível mudança de comportamento) ou manter com `eslint-disable` documentado até refactor maior?

## Acceptance Criteria

- `npm run lint` verde no repositório inteiro (0 errors) em ambiente limpo (`npm ci`).
- W1 executa `npm run lint` completo novamente.
- Cada exceção (`eslint-disable` ou regra ajustada) documentada com razão no próprio código.
- Testes existentes seguem passando (nenhum teste alterado para "passar").

## References

- PR #25 (piloto do CI W1) · CI run 32089115404 · `eslint.config.js` · `.github/workflows/ci.yml`
