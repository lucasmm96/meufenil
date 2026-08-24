# ADR-0013: Fluxos automáticos determinísticos sem IA — resposta estática de Issues externas e gate de produção

**Status:** Accepted
**Origin:** DOCUMENTED
**Data da decisão:** 2026-08-24

> Revisa os itens 8 (Issues externas) e 12 (Automação) da ADR-0012. Texto original preservado — esta ADR é a fonte da revisão.

## Context

Até 2026-08-24, um fluxo automático com IA estava planejado para o projeto: triagem de Issues externas via Claude Code Action (`.github/workflows/issue-triage.yml` + `issue-triage-claude.yml` + `.github/prompts/issue-triage.md`), jamais ativado (setup humano pendente: Claude GitHub App + `ANTHROPIC_API_KEY`) — `[CONFIRMED: workflows deletados em 2026-08-24, commit 8dd4fa8]`. IA em fluxos automáticos geraria custo recorrente de tokens fora de controle do autor, com ganho não essencial: a triagem é uma decisão de backlog, própria do mantenedor.

Simultaneamente, não existia gate de produção: `ci.yml` (lint/test/build) roda em qualquer PR, `release-verify` (W6) é pós-publicação, sem branch protection em `master` — `[CONFIRMED: .github/workflows/, 2026-08-24]`. Nada impedia uma feature sem Spec ou sem documentação de chegar a produção, contradizendo o caráter spec-driven do projeto (Spec = fonte da verdade) e o requisito de clareza da documentação pública (app open source com comunidade técnica e não-técnica).

O autor decidiu (2026-08-24, REF-0003): IA passa a existir APENAS no modo interativo (sessão local acionada pelo dev). Todo fluxo automático (GitHub Actions) é determinístico, sem IA, sem custo.

## Decision

1. **IA apenas no modo interativo:** qualquer interação com Claude/IA que possa gerar custo é acionada manualmente pelo dev, em sessão local. Nenhum fluxo automático (workflow de GitHub Actions) invoca IA.
2. **Proibição em automação:** `ANTHROPIC_API_KEY`, Claude Code Action e afins são proibidos em `.github/workflows/`; `repository_dispatch` não é usado para acionar IA. Exceção: nenhuma — o modo interativo não passa por Actions.
3. **Resposta estática de Issues externas (W3 `issue-responder`):** ao abrir uma Issue externa, resposta automática determinística — 1 comentário estático pt-BR com marker `<!-- sync:issue-responder -->` (idempotente; `edited` não repete) + label `triage` (POST aditivo). Guardas: apenas autor `NONE`/`CONTRIBUTOR`; skip se já houver label do fluxo (`spec-driven`/`spec-created`/`duplicate`/`not-planned`) ou marker. Nenhum fluxo automático decide elegibilidade, cria Spec ou aplica `spec-created`/`duplicate`/`not-planned` — triagem é manual (mantenedor).
4. **Gate de produção (W7 `release-gate`):** PR com base `master` (PR de release) passa por gate determinístico — (a) tabela de rastreabilidade §23 íntegra: Spec existe, frontmatter `Issue:` bate, Issue existe, PR merged (Issue pode estar aberta no pré-merge — `requireIssueClosed: false`; W6 continua exigindo fechado); (b) quando a tabela contém FEAT/ENH, diff obrigatório em `wiki/` desde a última release publicada (`git tag --merged HEAD --sort=-version:refname` — tags do repo são MISTAS annotated/lightweight). Falha = check vermelho + comentário no PR (marker de dedup, update-in-place — sem spam a cada push). O gate nunca cria tag, nunca publica release, nunca faz push.
5. **Revisão ADR-0012:** itens 8 e 12 revisados nos pontos de automação; a relação Spec = fonte de verdade e as demais decisões da ADR-0012 permanecem inalteradas.

## Consequences (OBSERVED)

- Workflows de triagem IA deletados e substituídos por `issue-responder.yml` + `scripts/spec-github/issue-responder.js` (+ testes) — 2026-08-24, commit 8dd4fa8. `[OBSERVED: git history]`
- W7 implementado: `release-gate.yml` + `scripts/spec-github/release-gate.js` (+ testes), `verifyTraceability` extraída para `lib/traceability-verify.js` com `requireIssueClosed` (comportamento do W6 idêntico — re-export preserva o contrato) — 2026-08-24, commit d8274de. `[OBSERVED: git history]`
- Smoke local com leitura real (dry-run): release DEBT sem FEAT/ENH → PASS; FEAT sem diff `wiki/` vs v1.9.1 → FAIL com mensagem explícita; tabela quebrada → FAIL com bullets — 2026-08-24. `[OBSERVED: execução local]`
- CONVENTIONS.md §18.7 e §18.9 atualizados; CLAUDE.md §5 atualizado; template de PR com campo `Docs (wiki/)` + item de checklist — 2026-08-24, mesmo PR. `[OBSERVED: PR da REF-0003]`
- ENH-0002 permanece PROPOSED: o Claude ainda cria PRs sob demanda no modo interativo; não é fluxo automático. `[OBSERVED: .ai/specs/proposed/enhancements/]`

## Alternatives

Consideradas na REF-0003 (seções Alternatives, decisão do autor 2026-08-24): A — fluxos automáticos determinísticos sem IA (adotada); B — triagem IA mantida com limite de custo (rejeitada — custo fora de controle e triagem é decisão de backlog do mantenedor); C — triagem puramente manual sem resposta automática (rejeitada — comunidade open source espera resposta mínima imediata); D — gate apenas de rastreabilidade sem exigência de docs (rejeitada — app spec-driven + open source exige documentação pública acompanhando FEAT/ENH).

## Evidence

- `.github/workflows/issue-responder.yml`, `scripts/spec-github/issue-responder.js` e `scripts/spec-github/issue-responder.test.js`
- `.github/workflows/release-gate.yml`, `scripts/spec-github/release-gate.js` e `scripts/spec-github/release-gate.test.js`
- `scripts/spec-github/lib/traceability-verify.js`, `scripts/spec-github/release-verify.js` (re-export)
- `.ai/specs/proposed/refactors/REF-0003-fluxos-automaticos-deterministicos.md` (Status: ACCEPTED, Decision A)
- Git history: 8dd4fa8 (I1), d8274de (I2), commits I3 no mesmo PR

## Related Specs

- [ADR-0012: Spec-Driven GitHub Operations](ADR-0012-spec-driven-github-operations.md) (itens 8 e 12 revisados)
- [REF-0003: Fluxos automáticos determinísticos sem IA](../proposed/refactors/REF-0003-fluxos-automaticos-deterministicos.md)
