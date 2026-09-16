# ENH-0002 — Identidade de bot para PRs criados pelo Claude

**Type:** ENH
**Status:** PROPOSED
**Title:** Identidade de bot para PRs criados pelo Claude
**Issue:** #21
**Created on:** 2026-08-16

## Problem

PRs criados pelo Claude usam a credencial do autor do projeto (`lucasmm96`) e saem atribuídos a ele; o GitHub impede o autor de aprovar o próprio PR — o review formal pelo botão "Approve" fica indisponível para o mantenedor nos PRs de autoria do Claude.

## Current State

O Claude cria PRs via GitHub API usando o credential manager do autor (fluxo aprovado no pedido de implementação, D-3/D-5). Os PRs #4, #5 e #20 aparecem como autoria `lucasmm96` `[CONFIRMED: GitHub — html_url/author dos PRs]`. A Human Decision Boundary de merge é exercida por aprovação explícita na conversa (ADR-0012 §Decision item 4) — mecanismo válido e em operação —, mas o botão de review formal do GitHub não pode ser usado pelo autor. Branch protection com "required review" não está habilitada hoje `[UNKNOWN: GitHub settings — verificar]`.

## Proposed State

AVALIAR a criação de uma identidade separada de bot (GitHub App dedicado, ex.: `meufenil-claude`) com permissões mínimas (issues:write, pull-requests:write, contents:read) para que o Claude crie PRs/Issues em nome do bot. Com isso, `lucasmm96` deixa de ser o autor dos PRs do Claude e pode exercer o review formal pelo botão "Approve" — além de habilitar, no futuro, branch protection com review obrigatório.

## Motivation

- **FACTUAL:** GitHub impede o autor de aprovar o próprio PR (regra da plataforma, confirmada pelo autor em 2026-08-16).
- **ASSUMPTION:** review formal no GitHub e branch protection com review obrigatório aumentam a qualidade da fronteira de merge (hipótese razoável, não medida).

## Evidence

PRs #4, #5 e #20 (autoria `lucasmm96`); decisão do autor em 2026-08-16: "registrar como melhoria em proposed/ para ser implementado no futuro".

## Scope

Identidade de bot para o fluxo de PRs/Issues do Claude; documentação do segredo do bot conforme `current/security/secrets-and-environments.md`; ajuste do mecanismo de criação de PRs (scripts/MCP) para a identidade do bot.

## Out of Scope

Branch protection obrigatória (decisão futura separada); troca do credential manager do autor para push de work branches (fluxo D-3 atual permanece); automações de CI (Fase 6).

## Impacted Features

N/A

## Impacted Business Rules

N/A

## Impacted Architecture

ADR-0012 (camada operacional §18.8 — autoria de PRs) `[CONFIRMED: decisions/ADR-0012-*.md]`

## Impacted Frontend / Backend / Database / Security / Tests

- Frontend: N/A · Backend: N/A · Database: N/A
- Security: novo segredo do GitHub App (`.env.github`/secrets; nunca versionado — ADR-0012 §16.4)
- Tests: teste do fluxo de criação de PR com a identidade do bot (suíte `scripts/spec-github/`)

## Dependencies

Nenhuma

## Risks

- Segredo do App mal gerenciado = mesma superfície de risco do PAT atual (mitigação: permissões mínimas, nunca versionar).
- Criação/manutenção de GitHub App exige passos manuais do autor (criar App, instalar no repo, gerar token) `[FACTUAL: pré-requisito administrativo]`.

## Alternatives

A — GitHub App dedicado (bot `meufenil-claude`) — review formal habilitado · B — conta GitHub separada (mais pesado: segundo usuário, licenças, identidade humana) · C — manter aprovação conversacional como único mecanismo (status quo; sem review formal via GitHub)
**Decision:** TBD — a escolha é humana e é obrigatória para ACCEPTED/IMPLEMENTED; na aprovação registrar **Approved by:** e **Approved on:**

## Open Questions

1. GitHub App é aceitável para o autor (pré-requisito administrativo)? 2. O App deve cobrir apenas Issues/PRs ou também labels/milestones? 3. Nome do bot (`meufenil-claude`?).

## Acceptance Criteria

- [ ] PR criado pelo Claude aparece com autoria do bot (não `lucasmm96`)
- [ ] `lucasmm96` consegue aprovar o PR pelo botão "Approve" no GitHub
- [ ] Fluxo D-5 mantido (aprovação humana continua sendo a HDB; merge executado pelo Claude após aprovação)
- [ ] Segredo do bot armazenado fora do repositório e documentado em `current/security/secrets-and-environments.md`
- [ ] Testes do fluxo de criação de PR atualizados para a nova identidade

## References

`../ADR-0012-spec-driven-github-operations.md` · `.ai/.temp/analyses/38-spec-driven-github-operations-blueprint-v1.1-final.md` (§11, §14, §16)
