# ADR-0012: Spec-Driven GitHub Operations

**Status:** Accepted
**Origin:** DOCUMENTED
**Data da decisão:** 2026-08-16

> **Nota de revisão (2026-08-24):** os itens 8 (Issues externas) e 12 (Automação) foram revisados pela [ADR-0013](ADR-0013-fluxos-automaticos-deterministicos-sem-ia.md) — IA apenas no modo interativo; resposta estática de Issues externas (W3 `issue-responder`) e gate de produção (W7 `release-gate`). Texto original preservado.

## Context

O MeuFenil é desenvolvido com abordagem Spec-Driven: o Specification System (`.ai/specs/`) registra Current State, Proposed State, ADRs e governança (CONVENTIONS.md). Até 2026-08-16, todo o trabalho era local: as 14 propostas de `proposed/` existiam apenas no repositório (0 Issues públicas, sem GitHub Project, sem CI — `[CONFIRMED: GitHub API, 2026-08-16]`), a regra vigente proibia commits/push automáticos (CLAUDE.md §12), e propostas concluídas permaneciam em `proposed/` com `Status: IMPLEMENTED` (CONVENTIONS §10). O autor do projeto decidiu evoluir o Specification System para um ecossistema operacional integrado ao GitHub (pedido de implementação de 2026-08-16; Blueprint `36`/`37-spec-driven-github-operations-blueprint-v1(.1).md`).

## Decision

Adotar o **Modelo A — Spec como fonte de verdade com projeções operacionais no GitHub**:

1. **Relação fundamental:** Spec = fonte de verdade da especificação · Issue = representação operacional/pública da Spec · Project = dashboard operacional do backlog · Código = implementação · PR = unidade de revisão/integração · Release = unidade de entrega.
2. **Ligação Spec ↔ Issue 1:1:** campo `Issue: #N` no frontmatter da Spec; label `spec:<ID>` no Issue; bloco `SPEC-PROJECTION:START/END` no corpo do Issue (única região editada por Claude; discussão humana fora do bloco nunca é sobrescrita). Todo item real de `proposed/` possui Issue canônica.
3. **Projeções de estado:** Issue open/closed e Project Status (`Backlog`·`Aprovado`·`Em andamento`·`Bloqueado`·`Concluído`·`Encerrado`) são DERIVADOS do Status da Spec; nunca transicionam por conta própria.
4. **PRs e merge:** PRs usam `Part of #N`/`Related to #N` — NUNCA `Closes #N` em Issue canônica. A aprovação humana do PR é a Human Decision Boundary; após aprovação explícita, Claude executa o merge (sem segunda confirmação redundante). Claude nunca aprova o próprio PR.
5. **Fechamento de Issue:** cadeia de verificação pós-merge (ACs com evidência → estado da Spec → evidências → preparar encerramento → confirmação humana quando exigida → fechar explicitamente). Fechamento automático do GitHub não é mecanismo principal.
6. **Git:** commits automáticos no escopo autorizado (commits lógicos e pequenos); push SEMPRE precedido de autorização explícita (resumo: branch, commits, testes, PR proposto); push direto em `development`/`master` fora do workflow do agente. Branch model: work branches `<tipo>/<id>-<slug>` → `development` → `release/vX.Y.Z` → PR → `master` → production.
7. **Releases:** Claude prepara (notas, changelog, tabela de rastreabilidade, draft, branch/PR de release); criação de tag e criação/publicação da Release dependem de confirmação humana explícita.
8. **Issues externas:** preservadas como intake/discussão original; Claude analisa e PODE criar Proposed Spec (que gera Issue canônica); a Issue externa sozinha nunca autoriza implementação. Relação `External #N → SPEC-ID → Canonical #M` registrada nos dois Issues.
9. **Arquivo de propostas:** `proposed/` contém somente propostas ativas; estados terminais movem para `archive/{implemented,rejected,superseded}/<categoria>/` (mesmo commit, `index.md` preserva a linha); o retrofit histórico (fase final) inclui os 5 IMPLEMENTED atuais.
10. **`.ai/.temp`:** fora do Git; subáreas `analyses/ decisions/ plans/ reviews/` + `MANIFEST.md`; lifecycle `PENDING → APPROVED/REJECTED → RESOLVED → retenção 7 dias → CLEANUP` (interativo, após a janela); arquivos pré-existentes = `LEGACY`, isentos de cleanup. Não é segunda fonte de verdade.
11. **Agentes:** seis especializados (spec-manager, github-manager, project-manager, pr-manager, release-manager, test-manager) + release-notes como especialista de análise; um dono por artefato; agentes não chamam agentes (orquestração pelo Claude principal ou workflows de Actions com sequência fixa).
12. **Automação:** GitHub MCP para o modo interativo; GitHub Actions (+ Claude Code Action a verificar) para eventos fora da sessão; `.ai/.temp` é exclusivo do modo interativo. Tokens nunca no repositório; permissões mínimas; production protegida; nenhuma migration automática em production.

## Consequences (OBSERVED)

- CONVENTIONS.md atualizado (§1, §8, §10, §13, §14, §16, §17, nova §18) e CLAUDE.md atualizado (camada operacional, workflows com Issue/Project/branch model, stop conditions operacionais, seção Git) — 2026-08-16, mesmo commit desta ADR.
- `templates/proposal-template.md` estendido (Issue, Created on, campos de decisão; seções Evidence/References deduplicadas).
- `proposed/index.md` com coluna Issue e regra de arquivamento; `archive/` criado; README do hub atualizado.
- Planejado: scripts de sincronização idempotente Spec↔Issue↔Project (Fases 2–3), agentes (Fase 4), PR workflow + CI (Fase 5), Actions event-driven (Fase 6), release traceability (Fase 7), retrofit histórico das 14 propostas (Fase 8).

## Alternatives

Consideradas no Blueprint v1 (seções 16/20/25): ligação Spec↔Issue apenas por texto livre (rejeitada — não auditável); manter concluídas em `proposed/` com status (regra anterior, substituída por decisão explícita do autor); MCP via apenas `gh` CLI ou scripts próprios (rejeitados como solução principal); Project incluindo Issues externas (rejeitado — Kanban espelha o backlog Spec-Driven).

## Evidence

- Pedido de implementação do autor (2026-08-16) — decisões 2.1–2.11.
- `.ai/.temp/analyses/36-spec-driven-github-operations-blueprint-v1.md` e `37-…-v1.1.md`.
- CONVENTIONS.md e CLAUDE.md (textos vigentes antes de 2026-08-16 — `[CONFIRMED: git history]`).
- Estado do GitHub em 2026-08-16: 0 Issues, sem Projects, labels default, sem `.github/` `[CONFIRMED: GitHub API]`.
- `.ai/.temp/analyses/35-auditoria-proposed-lifecycle.md` (gaps G1–G11; P1–P10 absorvidos).

## Related Specs

- `../CONVENTIONS.md` (§8, §10, §16, §17, §18) · `../proposed/index.md` · `../templates/proposal-template.md` · `ADR-0011` (fronteira de testes com auth real) · `.claude/agents/release-notes.md` (especialista de release)

## Source of Truth Matrix (referida por CONVENTIONS §18.11)

| Informação | Source of Truth | Projeção em (somente leitura) | Divergência |
|---|---|---|---|
| Comportamento atual | Implementação + `current/` specs | — | Implementação vence (CONVENTIONS §1/§12) |
| Conteúdo da proposta | Spec (`proposed/`) | Issue — bloco `SPEC-PROJECTION` | Spec vence |
| Acceptance Criteria | Spec | Issue (projeção) | Spec vence |
| Estado da proposta | Spec (`Status:`) | Issue open/closed · Project Status | Spec vence |
| Decisão (alternativa, quem, quando) | Spec (`Decision:`, `Approved by/on:`) | Issue (comentário de registro) | Spec vence |
| Conversa operacional pública | Issue (comentários) | — | Comentários humanos nunca sobrescritos |
| Prioridade | Project (`Priority`) | — | Único lugar |
| Bloqueio operacional | Project (`Bloqueado`) + comentário no Issue | — | Override operacional |
| Alvo de release | GitHub Milestone | — | Operacional |
| Execução | Git (branches/commits) | PR | Git vence |
| PR / CI | GitHub PR / Actions runs | — | PR vence |
| Release/tag | GitHub Release + git tag | Release notes (geradas) | Release vence |
| Decisão arquitetural | `decisions/ADR-NNNN` | Issue/`Implemented Through` | ADR vence |
| Rastreabilidade | Relacional (Issue: #N + label + links PR + milestone) | — | Auditoria |
