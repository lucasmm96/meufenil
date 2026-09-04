# REF-0005 — Corpo de Release com heading canônico da tabela de rastreabilidade + pre-release-check ampliado

**Type:** REF
**Status:** PROPOSED
**Title:** Corpo de Release com heading canônico da tabela de rastreabilidade + pre-release-check ampliado
**Issue:** #54
**Created on:** 2026-09-03

## Problem

Duas releases consecutivas (v1.10.0 e v1.10.1) foram publicadas com o corpo usando o heading `## Rastreabilidade (§23)` em vez do formato canônico `## Rastreabilidade` — o W6 (`release-verify`) falhou no pós-publicação nas duas (Failure Mode #20: "no-table"), exigindo correção retroativa dos corpos por decisão humana. O `pre-release-check.js` (REF-0004, AC3) valida apenas o corpo do **PR** de release antes do push; o corpo da **Release** (usado no `gh release create`) não passa por nenhuma checagem preventiva antes do publish.

## Current State

- **Formato canônico:** o exemplo canônico da tabela de rastreabilidade Spec → Issue → PR → Release do fluxo de release usa o heading exato `## Rastreabilidade` ([CONVENTIONS.md](../../CONVENTIONS.md) §18.9). Mensagens das ferramentas (W6/W7/pre-release-check) referem-se a ela como "tabela §23". [CONFIRMED — `.ai/specs/CONVENTIONS.md` §18.9 (exemplo canônico); mensagens de erro em `scripts/spec-github/`]
- **Parser estrito:** o parser compartilhado W6/W7 (`scripts/spec-github/lib/release-traceability.js`) exige o heading no início de linha, sem sufixo — regex `(?:^|\n)## Rastreabilidade[^\S\r\n]*(?:\r?\n|$)` (linha 40). Um heading com sufixo (ex.: `## Rastreabilidade (§23)`) não é reconhecido e o corpo é reportado como `no-table`. [CONFIRMED — `lib/release-traceability.js:40`]
- **Checagem preventiva cobre só o PR:** `pre-release-check.js` (REF-0004, AC3) verifica localmente o corpo do PR de release (tabela parseável, Specs existem, frontmatter `Issue:` bate, docs quando FEAT/ENH) antes do push — o arquivo de notas do corpo da Release é publicado sem checagem equivalente antes do `gh release create`. [CONFIRMED — `scripts/spec-github/pre-release-check.js` (uso: `--body-file <md>`, corpo do PR); fluxo §18.9]
- **Histórico das ocorrências:** v1.9.1 publicada com `## Rastreabilidade` (W6 OK — run 32674587795); v1.10.0 e v1.10.1 publicadas com `## Rastreabilidade (§23)` (W6 `no-table` — runs 33139076564 e 33826721637). Corpos de v1.10.0 e v1.10.1 corrigidos retroativamente em 2026-09-03 (decisão humana, Failure Mode #20 — "notas retroativas"; a tag nunca foi apagada). [CONFIRMED — corpos live das releases + runs do workflow `release-verify.yml`]
- **Drafts antigos de PR bodies** (`v1.8.0`, `v1.9.0`, `v1.9.1` em `.ai/.temp/analyses/`) já usavam o heading com sufixo `(§23)`; os corpos efetivamente publicados de PR passaram pela checagem/gate e saíram com o heading canônico — a Release body não tem o mesmo filtro. [CONFIRMED — drafts em `.ai/.temp/analyses/` vs corpos live]

## Proposed State

- **CONVENTIONS §18.9:** nota explícita de que o heading da tabela é exatamente `## Rastreabilidade` — sem sufixo (ex.: `(§23)`) nem numeração — tanto no corpo do PR de release quanto no corpo da Release, pois W6/W7 o exigem literalmente; incluir o contra-exemplo.
- **`pre-release-check.js` ampliado:** validar também o arquivo do corpo da Release (mesma verificação: tabela parseável + Specs existem + frontmatter `Issue:` bate) antes do `gh release create`/publish — fechando a lacuna deixada pelo REF-0004.
- **Fluxo §18.9:** o uso da checagem do corpo da Release entra no passo de preparação da release (antes da publicação), com o comando documentado.

## Motivation

- **FACTUAL:** falha do W6 em duas releases consecutivas (v1.10.0: run 33139076564; v1.10.1: run 33826721637 — ambas "no-table" com heading `## Rastreabilidade (§23)` no corpo publicado); v1.9.1 (heading canônico) passou (run 32674587795). O parser sempre foi estrito e o exemplo canônico (§18.9) sempre foi limpo — o desvio entrou na redação do corpo da Release, que não tem verificação mecânica pré-publicação (diferente do corpo do PR, coberto por `pre-release-check.js` + gate W7). Corpos corrigidos retroativamente por decisão humana em 2026-09-03.
- **ASSUMPTION:** nenhuma — a proposta deriva integralmente de ocorrências observadas.

## Evidence

- Runs do workflow `release-verify.yml` (W6): 33139076564 (v1.10.0, failure) · 33826721637 (v1.10.1, failure) · 32674587795 (v1.9.1, success).
- Corpos live das releases v1.9.1 / v1.10.0 / v1.10.1 (antes e depois da correção retroativa de 2026-09-03).
- [REF-0004 — automação de limpeza do gate + padrão preventivo para release](../../archive/implemented/refactors/REF-0004-automacao-residuo-gate-e-prevencao-tentativa-erro.md) — criou o `pre-release-check.js` (corpo do PR).
- [CONVENTIONS.md §18.9](../../CONVENTIONS.md) — exemplo canônico da tabela.
- [ADR-0013 — fluxos automáticos determinísticos sem IA](../../decisions/ADR-0013-fluxos-automaticos-deterministicos-sem-ia.md) — W6/W7 determinísticos.

## Scope

- Nota em CONVENTIONS §18.9 com o heading exato e contra-exemplo (AC1).
- `pre-release-check.js` estendido para validar o corpo da Release antes do publish (AC2).
- Testes do pre-release-check atualizados (AC3).
- Uso documentado no fluxo §18.9 (AC4).

## Out of Scope

- Corpos publicados v1.10.0/v1.10.1 — já corrigidos retroativamente em 2026-09-03 (remediação da anomalia, Failure Mode #20; fora do escopo desta proposta).
- Re-execução do W6 nos runs históricos — impossível: o gatilho é `release.published` e não há `workflow_dispatch`.
- Mudança do parser para aceitar headings com sufixo — ver Alternatives.

## Impacted Features

N/A — sem mudança de comportamento do produto (fluxo de engenharia).

## Impacted Business Rules

N/A.

## Impacted Architecture

- [ADR-0013 — fluxos automáticos determinísticos sem IA](../../decisions/ADR-0013-fluxos-automaticos-deterministicos-sem-ia.md) — W7 `release-gate` e W6 `release-verify`: a proposta estende o padrão preventivo local (REF-0004) do corpo do PR para o corpo da Release.

## Impacted Frontend / Backend / Database / Security / Tests

- Frontend / Backend / Database: N/A.
- Security: N/A — controle documental do fluxo de release, sem efeito sobre autenticação, autorização ou RLS.
- Tests: `scripts/spec-github/pre-release-check.test.js` (ou suíte equivalente do pre-release-check) — contratos estendidos para o corpo da Release (AC3).

## Dependencies

Nenhuma — relacionada ao REF-0004 (IMPLEMENTED, criou o `pre-release-check.js` que esta proposta amplia).

## Risks

N/A — nenhum risco formal registrado; mudança de processo com checagem mecânica local.

## Alternatives

- **Flexibilizar o parser W6/W7** para aceitar `## Rastreabilidade (§23)` e outras variantes — manteria dois formatos válidos e afrouxaria o guarda mecânico do formato canônico; contraria a regra de formato único do exemplo §18.9. [decisão humana]
- **Manter o status quo** (checagem só do PR + correção manual retroativa quando o W6 falhar) — observado falhar em 2 releases consecutivas (v1.10.0 e v1.10.1). [decisão humana]
- **Caminho proposto** (nota §18.9 + pre-release-check do corpo da Release): fecha a lacuna na origem, sem afrouxar o parser. [decisão humana]

**Decision:** TBD — escolha humana (registrar **Approved by:** e **Approved on:** na aprovação).

## Open Questions

Nenhuma — causa raiz confirmada por evidência; a decisão pendente é a escolha entre as Alternatives acima.

## Acceptance Criteria

- [ ] AC1: CONVENTIONS §18.9 documenta que o heading da tabela é exatamente `## Rastreabilidade` (sem sufixo), com contra-exemplo
- [ ] AC2: `pre-release-check.js` valida o arquivo do corpo da Release antes do publish (mesma verificação do corpo do PR)
- [ ] AC3: testes do pre-release-check atualizados cobrindo o corpo da Release
- [ ] AC4: uso da checagem do corpo da Release documentado no fluxo §18.9 (comando + momento)

## References

- Runs W6 `release-verify`: 33139076564 (v1.10.0) · 33826721637 (v1.10.1) · 32674587795 (v1.9.1).
- [CONVENTIONS.md §18.9](../../CONVENTIONS.md).
- [REF-0004 — arquivada como IMPLEMENTED](../../archive/implemented/refactors/REF-0004-automacao-residuo-gate-e-prevencao-tentativa-erro.md).
- [ADR-0013 — fluxos automáticos determinísticos sem IA](../../decisions/ADR-0013-fluxos-automaticos-deterministicos-sem-ia.md).
- Releases v1.9.1 / v1.10.0 / v1.10.1 (corpos live; correção retroativa de 2026-09-03).
