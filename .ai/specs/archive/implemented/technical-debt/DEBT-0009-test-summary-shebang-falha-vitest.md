# DEBT-0009 — Falha de SyntaxError em test-summary.test.js (shebang × Vitest transform)

**Type:** DEBT
**Status:** IMPLEMENTED
**Title:** Falha de SyntaxError em test-summary.test.js (shebang × Vitest transform)
**Issue:** #109
**Created on:** 2026-10-02
**Implemented Through:** Alternativa A — extrair funções puras (`parseVitestReport`, `inferSkipReason`) para `test-summary-core.js` (sem shebang); `test-summary.js` e `test-summary.test.js` importam de lá — PR #108 (squash merge `106a9cd`, development, 2026-10-02)

## Problem

`scripts/ai-workflows/test-summary.test.js` falha com `SyntaxError: Invalid or unexpected token`
em toda execução da suite completa (`npm run test:run`). O arquivo de teste em si é válido; o
erro ocorre ao importar `./test-summary.js`, cujo shebang `#!/usr/bin/env node` o Vitest
não consegue strip ao transformar o módulo para o ambiente `jsdom`.

## Current State

```
FAIL  scripts/ai-workflows/test-summary.test.js
SyntaxError: Invalid or unexpected token
Test Files  1 failed | 80 passed (81)
```

A falha existe desde o commit `707bd62` (ENH-0013/AC6, 2026-10-01 — PR #106) e está
presente em `development` e em `master` `[CONFIRMED: observado na suite local]`.

A suite retorna exit code 0 (o arquivo foi incluído no count de 81 arquivos mas não produz
testes), o que mascarou a falha: o CI não bloqueia PRs por causa dela. Isso é um risco
adicional porque falhas futuras em `test-summary.js` seriam igualmente silenciosas.

## Root Cause

`test-summary.test.js` é o **único** teste em `scripts/ai-workflows/` que importa funções
diretamente do script-alvo:

```js
// test-summary.test.js
import { parseVitestReport, inferSkipReason } from './test-summary.js'
```

Os outros 6 testes (`spec-locate`, `release-context`, `spec-impl-readiness`, etc.) executam
os scripts como subprocessos externos via `spawnSync` / `execFileSync` — o arquivo jamais é
transformado pelo Vitest nesses casos.

Quando o Vitest (v4.0.17, ambiente `jsdom`) tenta transformar `test-summary.js` para
resolver o import acima, encontra o shebang `#!/usr/bin/env node` na primeira linha e falha:
esse token não é JavaScript válido e o transformer não faz strip dele antes de parsear.
`[CONFIRMED: shebang presente em todos os scripts; falha exclusiva no test-summary]`

Todos os scripts em `scripts/ai-workflows/` possuem shebang (necessário para execução CLI),
mas somente `test-summary.js` é importado diretamente em testes — daí a falha isolada.

## Proposed State

A suite roda com **0 arquivos falhando** e os testes de `test-summary.test.js` validam
`parseVitestReport` e `inferSkipReason` com evidência de 100% dos casos cobrindo os cenários
existentes (happy path, falhas, skips, relatório vazio, `inferSkipReason`).

## Motivation

- CI silencioso sobre falha real: exit code 0 mascara o problema; testes de
  `parseVitestReport` nunca executam.
- Risco de regressão invisível: mudanças em `test-summary.js` não são cobertas.
- Inconsistência de abordagem: os outros 6 testes funcionam; somente este está quebrado.

## Evidence

- `SyntaxError: Invalid or unexpected token` reproduzível: `npm run test:run -- scripts/ai-workflows/test-summary.test.js`
- Todos os scripts têm shebang; somente `test-summary.test.js` importa diretamente: confirmado por `head -1 scripts/ai-workflows/*.js` + leitura dos 6 outros arquivos de teste
- Introduzido no commit `707bd62` (ENH-0013/AC6) — branch `development` e `master`
- Vitest v4.0.17 · `environment: 'jsdom'` · `package.json "type": "module"`

## Scope

Corrigir a transformação/importação de `test-summary.js` no ambiente de testes de forma que
os 5 describes / ~15 testes existentes no arquivo passem. Não alterar o comportamento CLI do
script.

## Out of Scope

- Alterar o comportamento runtime de `test-summary.js`
- Modificar os outros 6 testes de `scripts/ai-workflows/` (já funcionam)
- Cobrir cenários além dos já especificados no arquivo de teste

## Alternatives

**A. Separar funções puras em módulo sem shebang**
Criar `test-summary-core.js` (sem shebang, sem CLI entry point) com `parseVitestReport` e
`inferSkipReason`; `test-summary.js` importa de lá. O teste importa de `test-summary-core.js`.
→ Sem mudança no Vitest config; não altera CLI; isola claramente o núcleo testável.

**B. Vitest custom transform para strip de shebang**
Adicionar plugin em `vitest.config.ts` que remove `#!/...` da primeira linha de arquivos `.js`:
```ts
plugins: [{ name: 'strip-shebang', transform(code, id) {
  if (id.endsWith('.js') && code.startsWith('#!')) return code.replace(/^#!.*\n/, '')
}}]
```
→ Corrige sem mover arquivos; risco de efeito colateral em outros `.js` transformados.

**C. Mudar abordagem do teste para subprocesso (consistente com os outros)**
Reescrever `test-summary.test.js` para executar o script via `spawnSync` / `execFileSync`,
testando output JSON em vez de funções individuais.
→ Consistente com os outros testes; não testa funções isoladamente (menos granular).

**Decision:** Alternativa A — extrair funções puras para test-summary-core.js (sem shebang)
**Approved by:** Lucas
**Approved on:** 2026-10-02

## Open Questions

N/A — causa raiz confirmada; as alternativas são claras.

## Acceptance Criteria

- `npm run test:run -- scripts/ai-workflows/test-summary.test.js` retorna exit code 0 com
  todos os testes passando (sem `SyntaxError`).
- `npm run test:run` (suite completa) não apresenta mais o arquivo como `failed`.
- O comportamento CLI de `test-summary.js` (invocação via `node scripts/ai-workflows/test-summary.js`)
  permanece inalterado.
- Nenhum dos outros 6 testes de `scripts/ai-workflows/` é afetado.

## References

- Commit introdutor: `707bd62` (ENH-0013/AC6)
- `scripts/ai-workflows/test-summary.js` — script com shebang + entry point
- `scripts/ai-workflows/test-summary-core.js` — módulo com funções puras (sem shebang)
- `scripts/ai-workflows/test-summary.test.js` — arquivo de teste com 5 describes / 15 testes
- `vitest.config.ts` — `environment: 'jsdom'`, sem transform customizado
- ENH-0013 (IMPLEMENTED) — contexto da criação dos scripts e testes
- PR #108 — implementação da Alternativa A

---

*Criado em 2026-10-02 — investigação pós-FEAT-0002: falha detectada na suite completa, causa raiz identificada (shebang × Vitest transform na importação direta). Implementado em PR #108 (2026-10-02).*
