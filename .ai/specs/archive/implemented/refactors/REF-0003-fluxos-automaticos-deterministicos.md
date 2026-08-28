# REF-0003 — Fluxos automáticos determinísticos sem IA — resposta estática de Issues externas e gate de produção (Spec + Documentação)

**Type:** REF
**Status:** IMPLEMENTED
**Title:** Fluxos automáticos determinísticos sem IA — resposta estática de Issues externas e gate de produção (Spec + Documentação)
Issue: #44
**Created on:** 2026-08-24
**Approved by:** Lucas Martins Menezes
**Approved on:** 2026-08-24
**Implemented Through:** Implementado em 2026-08-24 (merge PR #45 — commit `b7090d4`): W3 `issue-responder` (resposta estática de Issues externas + label `triage`, sem IA) · W7 `release-gate` (gate de produção — Spec + docs `wiki/` obrigatórios) · ADR-0013 (IA apenas no modo interativo; secret `PROJECTS_TOKEN` mapeado) · 366 testes verdes, lint 0 erros, build OK · smoke do gate validado (PASS/FAIL/FAIL) · Project sincronizado (item #44)

## Problem

O único fluxo automático com IA do projeto (triagem de Issues externas via Claude Code Action) gera custo recorrente de tokens se ativado, e nenhum mecanismo impede que uma mudança sem Spec ou sem documentação chegue a produção (`master`).

## Current State

- **Triagem de Issues externas com IA (W3):** `.github/workflows/issue-triage.yml` (wrapper) + `.github/workflows/issue-triage-claude.yml` (Claude Code Action, `anthropics/claude-code-action@v1`, secret `ANTHROPIC_API_KEY`) + `.github/prompts/issue-triage.md` (prompt fixo). Nunca ativado (setup humano pendente: Claude GitHub App + secret — handoffs 2026-08-17/18/19/23); se ativado, cada Issue externa consumiria tokens. Governança: [`CONVENTIONS.md` §18.7](../../CONVENTIONS.md) e ADR-0012 itens 8 e 12.
- **Sem gate de produção:** `ci.yml` (lint/testes/build) roda em qualquer PR; `release-verify.yml` valida a tabela de rastreabilidade §23 **pós-publicação**; não há branch protection. Nada bloqueia feature sem Spec ou sem docs em `master`.
- **Wiki sincronizada mecanicamente:** `sync-wiki.yml` espelha `wiki/*.md` para `meufenil.wiki` em push de `master`, sem verificação de conteúdo.
- **IA interativa (manutenção):** `.mcp.json` e `.claude/agents/*` operam exclusivamente no modo interativo local — custo sob controle do dev.

## Proposed State

1. **Triagem sem IA:** Issue externa aberta recebe **resposta automática ESTÁTICA** (workflow determinístico, sem IA, sem custo) informando que o mantenedor avaliará + label `triage`. A triagem em si é **sempre humana** (mantenedor) — nenhum fluxo automático decide elegibilidade, cria Spec ou aplica `spec-created`/`duplicate`/`not-planned`.
2. **Gate de produção (W7 `release-gate`):** PR de release (`development → release/vX.Y.Z → master`) passa por verificação determinística: tabela de rastreabilidade §23 íntegra (Spec existe, `Issue:` bate, PR merged) **e** diff em `wiki/` quando a tabela contém FEAT/ENH (docs públicas sincronizadas desde a última release publicada). Falha = check vermelho + comentário no PR com o que falta.
3. **IA exclusivamente interativa:** nenhum workflow de GitHub Actions usa IA (`ANTHROPIC_API_KEY`/Claude Code Action proibidos em automação); interações com IA são acionadas manualmente pelo dev na sessão local.
4. **ENH-0002 permanece PROPOSED** (o Claude ainda cria PRs sob demanda no modo interativo).

## Motivation

- **FACTUAL:** custo recorrente de tokens por Issue no W3 atual (2 workflows + prompt + `repository_dispatch`); nenhum gate de produção existente (só `ci.yml` em PR e `release-verify` pós-publicação — [`testing-strategy.md`](../../current/testing/testing-strategy.md)); tags de release mistas exigem diff por `git tag --merged` (não `git describe`).
- **ASSUMPTION:** a frequência futura de Issues externas não justifica automação com IA — resposta estática + triagem manual é suficiente (hipótese razoável, não medida).

## Evidence

ADR-0012 itens 8/12 (triagem IA); `.github/workflows/issue-triage.yml` / `issue-triage-claude.yml`; `.github/prompts/issue-triage.md`; handoffs `.ai/.temp/handoffs/2026-08-17-phase-3-handoff.md` (setup pendente); decisão do autor 2026-08-24 (IA apenas manual).

## Scope

Workflows de GitHub Actions e scripts `scripts/spec-github/`; resposta estática de Issues externas; gate de produção; governança afetada (CONVENTIONS §18.7, ADR-0012 nota de revisão, ADR-0013 novo, CLAUDE.md, template de PR); testes e contratos F6/F7 correspondentes; `wiki/Guia-Desenvolvedor.md` (1 frase).

## Out of Scope

- ENH-0002 (mantida PROPOSED); `.mcp.json`; `.claude/agents/*` (github-manager descreve triagem **interativa** — permanece correto); `wiki/Funcionalidades.md`; `system-map.md` (não cobre automação).
- `.ai/.temp/` (área temporária, gitignored, lifecycle 7 dias — CONVENTIONS §17).
- Configuração de branch protection, remoção do secret `ANTHROPIC_API_KEY` e desinstalação do Claude GitHub App (ações manuais do autor no GitHub, fora do repositório — documentadas na implementação).
- `release-verify.yml` pós-publicação (mantido como reforço).

## Impacted Features

N/A — sem mudança de comportamento do produto.

## Impacted Business Rules

N/A.

## Impacted Architecture

- [ADR-0012](../../decisions/ADR-0012-spec-driven-github-operations.md) — nota de revisão nos itens 8 e 12 (texto original preservado).
- ADR-0013 novo — fluxos automáticos determinísticos sem IA (Origin CONTEMPORARY).
- [CONVENTIONS.md §18.7](../../CONVENTIONS.md) — triagem manual + resposta estática.

## Impacted Frontend / Backend / Database / Security / Tests

- Frontend / Backend / Database / Security: N/A.
- Tests: `scripts/spec-github/event-driven.test.js` (remove contratos W3 antigos, adiciona contrato do issue-responder), `scripts/spec-github/issue-responder.test.js` (novo), `scripts/spec-github/release-gate.test.js` (novo), `scripts/spec-github/lib/github.js` (`addLabels`/`updateComment`).

## Dependencies

Nenhuma.

## Risks

- Gate bloqueando release legítima por docs atrasada — mitigado: exigência só para FEAT/ENH, mensagem clara no PR, fallback humano (check vermelho não bloqueia tecnicamente sem branch protection — decisão do autor).
- Autor da Issue ignorar a resposta estática — mitigado: texto curto e objetivo.
- Regressão nos contratos de teste ao remover os workflows — mitigado: remoção de arquivos e reescrita dos contratos no mesmo commit.

## Alternatives

- **A — Manter a triagem IA (W3 atual):** custo recorrente de tokens; complexidade de 2 workflows + prompt; rejeitada pelo autor (2026-08-24).
- **B — Triagem manual sem resposta automática:** autor externo sem nenhum feedback; rejeitada (open source precisa de orientação clara à comunidade).
- **C — Gate sem exigência de documentação:** deixaria o objetivo ("feature só vai a produção com spec E documentação") incompleto; rejeitada.
- **D — Emendar ADR-0012 in-place (reescrever itens 8/12):** falsifica o registro histórico; sem precedente em `decisions/`; rejeitada — ADR novo + nota de revisão.

**Decision:** A — fluxos automáticos determinísticos sem IA, resposta estática de Issues externas e gate de produção (ver Approved by/on no header).

## Open Questions

Nenhuma em aberto para a decisão. Decisões de design (guardas do issue-responder, strictness do gate, diff por última tag) são recomendações do plano de implementação, revisáveis na revisão humana.

## Acceptance Criteria

- **AC1** — `grep -ri "claude-code-action\|ANTHROPIC_API_KEY"` retorna vazio em código vigente (`.github/`, `scripts/`) — apenas referências históricas permitidas (ADR/CONVENTIONS).
- **AC2** — Issue externa aberta (autor `NONE`/`CONTRIBUTOR`, sem labels do fluxo) recebe exatamente 1 comentário com marker `sync:issue-responder` + label `triage`; `edited` não repete.
- **AC3** — `issue-responder.yml` sem IA, sem `repository_dispatch`, permissões `issues: write`/`contents: read`.
- **AC4** — PR de release para `master` com FEAT/ENH na tabela §23 e sem diff em `wiki/` → `release-gate` falha com mensagem explícita; com docs → passa.
- **AC5** — Release sem FEAT/ENH passa sem exigência de docs; rastreabilidade quebrada (Spec/Issue/PR) sempre falha.
- **AC6** — `npm run test:run` verde (novos contratos em `event-driven.test.js`, `issue-responder.test.js`, `release-gate.test.js`).
- **AC7** — CONVENTIONS §18.7, ADR-0012 (nota), ADR-0013, CLAUDE.md, template de PR e `wiki/Guia-Desenvolvedor.md` atualizados no mesmo PR.
- **AC8** — ENH-0002 permanece PROPOSED; `wiki/Funcionalidades.md` e `system-map.md` inalterados.
- **AC9** — `wiki/Guia-Desenvolvedor.md` reflete a resposta automática (passo 1 de "Como contribuir").

## References

[ADR-0012](../../decisions/ADR-0012-spec-driven-github-operations.md); [CONVENTIONS.md §18.7/§18.9](../../CONVENTIONS.md); `.github/workflows/issue-triage*.yml`; `.github/prompts/issue-triage.md`; `scripts/spec-github/` (padrões determinísticos reutilizáveis: `lib/specs.js`, `lib/release-traceability.js`, `release-verify.js`).
