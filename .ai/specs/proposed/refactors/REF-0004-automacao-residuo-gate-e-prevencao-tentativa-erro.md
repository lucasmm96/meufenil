# REF-0004 — Automação de limpeza de resíduo do release-gate e prevenção de tentativa-e-erro

**Type:** REF
**Status:** PROPOSED
**Issue:** #48 (ligado ao PR de release v1.10.0)
**Title:** Automação de limpeza de resíduo do gate + padrão preventivo para release
**Created on:** 2026-08-28

## Problem

O `release-gate.js` (W7, ADR-0013) posta/edita comentário de falha (`<!-- sync:release-gate -->`) quando falha, mas **nunca remove quando passa**. Isso deixa comentários de erro residuais no PR após correção, exigindo intervenção manual (como ocorreu no PR #48).

Além disso, o formato da tabela §23 e do frontmatter `**Issue:** #N` só é verificado no momento do gate — não há verificação preventiva antes da abertura do PR de release. Isso levou a múltiplas iterações de tentativa-e-erro (formatos do link de arquivo vs ID de spec, bold vs sem bold, tabela com em dash vs hífen, ADR no formato errado).

## Proposed State

- **Gate automático:** quando `result.pass === true`, chamar `deleteComment` no comentário com marker `<!-- sync:release-gate -->`.
- **CONVENTIONS §18.9:** adicionar seção com exemplo válido da tabela §23 (`| Spec | Issue | PR | Título | Tipo |` com IDs de spec `ENH-0003`) + exemplo de frontmatter (`**Issue:** #39` com `**`).
- **Pre-release check (`scripts/spec-github/pre-release-check.js`):** executa `verifyTraceability` + `parseTraceabilityTable` + `listSpecs` + `docsRequirement` localmente, produzindo relatório antes do push.
- **Template `release.md`:** modelo de corpo de PR de release com tabela pré-preenchida.

## Acceptance Criteria

- [ ] AC1: `release-gate.js` deleta comentário de falha ao passar (dry-run testado)
- [ ] AC2: `CONVENTIONS.md` atualizado com exemplo §23
- [ ] AC3: `pre-release-check.js` executável e documentado
- [ ] AC4: `release.md` criado
- [ ] AC5: testes de `release-gate.test.js` atualizados

## Decision

**APPROVED** (autorização do usuário, 2026-08-27) — escopo completo (gate + docs + script + template).

## See Also
- PR #48 (release v1.10.0 — contexto da descoberta)
- ADR-0013 — gate determinístico
- W7 — release-gate
