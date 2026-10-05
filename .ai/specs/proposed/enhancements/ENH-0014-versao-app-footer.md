# ENH-0014 — Versão do app exibida no footer

**Type:** ENH
**Status:** PROPOSED
**Title:** Versão do app exibida no footer
**Issue:** TBD
**Created on:** 2026-10-05

## Problem

O footer do Layout não exibe a versão do app, dificultando ao usuário identificar se está usando a versão mais recente — especialmente relevante em contexto PWA, onde o cache pode atrasar a atualização.

## Current State

O footer em `src/react-app/components/Layout.tsx:112-148` exibe:
- Mensagem "Feito com ❤ para pacientes fenil do Brasil"
- Links LinkedIn e Email do autor
- Copyright `© {ano} MeuFenil. Todos os direitos reservados.`

Não há exibição de versão. A versão canônica do app é `1.19.0`, definida no campo `version` de `package.json:2` `[CONFIRMED: code]`.

O Vite expõe constantes de build-time via `define` em `vite.config.ts` `[CONFIRMED: vite.config.ts]`. Não há uso atual de `define` nem variáveis `VITE_APP_*` no projeto `[CONFIRMED: ausência]`.

Ver: [`frontend/overview.md`](../../current/frontend/overview.md), `src/react-app/components/Layout.tsx`.

## Proposed State

A versão do app é exibida no footer em linha única junto ao copyright e na página Sobre, e corresponde automaticamente ao valor em `package.json` no momento do build, sem nenhum overhead de runtime.

Formato: `© 2026 MeuFenil · v1.19.0 · Todos os direitos reservados.` (linha única, substituindo o formato atual de duas linhas separadas)

Também exibida em `Sobre.tsx` — posição a definir na implementação (hero ou card).

## Motivation

- FACTUAL: `package.json:version` é atualizado a cada release como parte do processo estabelecido — é a fonte canônica da versão `[CONFIRMED: processo de release]`.
- FACTUAL: Vite suporta injeção de constantes em build-time via `define`, sem dependências adicionais `[CONFIRMED: documentação Vite + vite.config.ts]`.
- FACTUAL: o app é distribuído como PWA (`public/manifest.json:display=standalone`) — o cache do browser/PWA pode manter versões antigas sem o usuário perceber `[CONFIRMED: FEAT-0014, frontend/overview.md seção PWA]`.
- ASSUMPTION: usuários ocasionalmente precisam confirmar se estão na versão correta (ex.: ao relatar um problema ou verificar se uma atualização chegou).

## Evidence

Draft 009 (`proposed/draft/archive/009-versao-mais-atual-do-app-no-front.md`) — solicitação do usuário em 2026-10-05. Leitura de `package.json`, `vite.config.ts`, `Layout.tsx` em 2026-10-05.

## Scope

- Injeção da versão em build-time via `define` em `vite.config.ts` (lendo `package.json`)
- Exibição no footer de `Layout.tsx`: linha única `© {ano} MeuFenil · v{versão} · Todos os direitos reservados.`
- Exibição em `Sobre.tsx` — posição exata a definir na implementação
- Avaliação do `FooterSkeleton.tsx` para preservar proporção visual

## Out of Scope

- Verificação de atualização disponível (comparar versão local com versão remota — intersecta com [FEAT-0018](../features/FEAT-0018-central-notificacoes.md) e [ENH-0001](ENH-0001-pwa-offline.md))
- Changelog in-app
- Página de versão dedicada

## Impacted Features

- [FEAT-0014](../../current/features/FEAT-0014-pwa.md) — visibilidade da versão é especialmente útil em contexto PWA

## Impacted Business Rules

N/A

## Impacted Architecture

- `vite.config.ts`: adição de `define` com a versão lida de `package.json` — mudança de build, sem impacto em runtime `[INFERRED: mecanismo Vite — Basis: documentação Vite define]`
- Ver [`frontend/overview.md`](../../current/frontend/overview.md) — seção Stack e entrypoints

## Impacted Frontend / Backend / Database / Security / Tests

- **Frontend:** `vite.config.ts` (define), `src/react-app/components/Layout.tsx` (footer), `src/react-app/pages/Sobre.tsx` (exibição adicional), `src/react-app/skeletons/layout/FooterSkeleton.tsx` (avaliar ajuste)
- **Backend:** N/A
- **Database:** N/A
- **Security:** N/A — versão é dado público, sem risco de exposição de informação sensível
- **Tests:** nenhum teste específico esperado (conteúdo estático injetado em build-time); verificação manual suficiente

## Dependencies

Nenhuma.

## Risks

- Mínimo: `define` em `vite.config.ts` requer leitura do `package.json` no momento do build — padrão documentado e estável no Vite `[CONFIRMED: documentação Vite]`.
- Nenhuma regressão esperada nos testes existentes (mudança puramente aditiva no footer).

## Alternatives

- **A — `define` no `vite.config.ts` lendo `package.json` (build-time) ✓ (escolhida):** `import pkg from './package.json' assert { type: 'json' }` + `define: { __APP_VERSION__: JSON.stringify(pkg.version) }`. Zero overhead de runtime; sempre em sincronia com a versão do build.
- **B — Variável de ambiente `.env` (`VITE_APP_VERSION`):** requer atualização manual a cada release, propenso a divergir do `package.json`. Não recomendado.
- **C — Fetch de `package.json` em runtime:** overhead de rede desnecessário para dado estático. Não recomendado.
- **D — Hardcode no componente:** acoplamento manual, diverge a cada esquecimento. Não recomendado.

**Decision:** TBD — aprovação humana obrigatória para `ACCEPTED`; registrar `Approved by:` e `Approved on:`. Alternativa A e formato de exibição confirmados pelo questionário (2026-10-05).

## Open Questions

1. **Posição em `Sobre.tsx`:** onde exatamente exibir a versão — no bloco hero, no card "Minha História" ou como chip/badge separado? (decisão visual a tomar na implementação)

_Respondidas (2026-10-05):_ formato ✓ (`v{versão}`) · posição no footer ✓ (linha única com copyright) · exibição em Sobre ✓ (sim)

## Acceptance Criteria

- [ ] Footer exibe linha única: `© {ano} MeuFenil · v{versão} · Todos os direitos reservados.`
- [ ] Versão exibida (`v{versão}`) é idêntica ao campo `version` de `package.json` no momento do build
- [ ] `Sobre.tsx` exibe a versão em posição visível (exata a definir na implementação)
- [ ] Zero overhead de runtime (injeção em build-time via `define`)
- [ ] `FooterSkeleton` preserva proporção visual sem layout shift
- [ ] Nenhum teste existente regride

## References

- Draft original: `proposed/draft/archive/009-versao-mais-atual-do-app-no-front.md`
- `src/react-app/components/Layout.tsx:112-148` — footer atual
- `src/react-app/pages/Sobre.tsx` — página Sobre
- `package.json:2` — fonte canônica da versão (`1.19.0`)
- `vite.config.ts` — ponto de extensão via `define`
- [`frontend/overview.md`](../../current/frontend/overview.md) — arquitetura do frontend
- [FEAT-0014](../../current/features/FEAT-0014-pwa.md) — contexto PWA
