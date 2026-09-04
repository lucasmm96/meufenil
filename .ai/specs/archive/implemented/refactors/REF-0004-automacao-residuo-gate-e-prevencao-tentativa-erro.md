# REF-0004 — Automação de limpeza de resíduo do gate + padrão preventivo para release

**Type:** REF
**Status:** IMPLEMENTED
**Title:** Automação de limpeza de resíduo do gate + padrão preventivo para release
**Issue:** #51
**Created on:** 2026-08-28
**Implemented Through:** PR #52 (squash merge)

## Problem

O `release-gate.js` (W7, ADR-0013) posta/edita comentário de falha (`<!-- sync:release-gate -->`) quando falha, mas **nunca remove quando passa**. Isso deixa comentários de erro residuais no PR após correção, exigindo intervenção manual (como ocorreu no PR #48).

Além disso, o formato da tabela §23 e do frontmatter `**Issue:** #N` só é verificado no momento do gate — não há verificação preventiva antes da abertura do PR de release. Isso levou a múltiplas iterações de tentativa-e-erro (formatos do link de arquivo vs ID de spec, bold vs sem bold, tabela com em dash vs hífen, ADR no formato errado).

## Current State

- **Comentário de falha residual:** `scripts/spec-github/release-gate.js` (W7, [ADR-0013 — fluxos automáticos determinísticos sem IA](../../decisions/ADR-0013-fluxos-automaticos-deterministicos-sem-ia.md)) posta ou edita comentário de falha no PR com o marker `<!-- sync:release-gate -->` quando o gate falha (deduplicação por marker) e **não remove o comentário quando o gate passa** — a interface de comentários usada pelo gate expõe apenas listar/adicionar/editar, sem deleção. [CONFIRMED — `release-gate.js:28` (marker), `:112-119`/`:185-188` (publicação/edição somente no caminho de falha), `:167-169` (interface sem deleção); registro da descoberta nesta proposta]
- **Verificação apenas no momento do gate:** o formato da tabela de rastreabilidade §23 do PR de release e do frontmatter `**Issue:** #N` das specs ([CONVENTIONS.md](../../CONVENTIONS.md)) só é verificado na execução do gate — não há checagem preventiva local antes da abertura do PR de release (o `pre-release-check.js` proposto não existe na árvore do repositório; nenhum mecanismo pré-PR está registrado). [CONFIRMED — árvore do repositório + registro da descoberta nesta proposta]
- **Tentativa-e-erro recorrente:** múltiplas iterações de tentativa-e-erro já ocorreram em releases anteriores — formatos do link de arquivo vs ID de spec, bold vs sem bold, tabela com em dash vs hífen, ADR no formato errado. [CONFIRMED — registro da descoberta (PR #48, release v1.10.0)]

## Proposed State

- **Gate automático:** quando `result.pass === true`, chamar `deleteComment` no comentário com marker `<!-- sync:release-gate -->`.
- **CONVENTIONS §18.9:** adicionar seção com exemplo válido da tabela §23 (`| Spec | Issue | PR | Título | Tipo |` com IDs de spec `ENH-0003`) + exemplo de frontmatter (`**Issue:** #39` com `**`).
- **Pre-release check (`scripts/spec-github/pre-release-check.js`):** executa `verifyTraceability` + `parseTraceabilityTable` + `listSpecs` + `docsRequirement` localmente, produzindo relatório antes do push.
- **Template `release.md`:** modelo de corpo de PR de release com tabela pré-preenchida.

## Motivation

- **FACTUAL:** descoberta registrada no PR #48 (release v1.10.0): comentários de falha residuais do gate exigiram intervenção manual após a correção do PR; as múltiplas iterações de tentativa-e-erro (formatos do link de arquivo vs ID de spec, bold vs sem bold, tabela com em dash vs hífen, ADR no formato errado) ocorreram porque o formato da tabela §23 e do frontmatter `**Issue:** #N` só é verificado no momento do gate.
- **ASSUMPTION:** nenhuma — o arquivo não registra hipóteses não medidas; a proposta deriva integralmente de fatos observados.

## Evidence

- PR #48 (release v1.10.0 — contexto da descoberta).
- [ADR-0013 — fluxos automáticos determinísticos sem IA](../../decisions/ADR-0013-fluxos-automaticos-deterministicos-sem-ia.md) — gate determinístico W7.

## Scope

- Limpeza automática do comentário de falha do gate quando passa (AC1).
- Exemplo válido da tabela §23 adicionado ao CONVENTIONS (AC2).
- `pre-release-check.js` executável e documentado (AC3).
- Template `release.md` de corpo de PR de release (AC4).
- Testes do gate atualizados (AC5).

## Out of Scope

N/A — o arquivo não registra itens fora do escopo; nada além do acima.

## Impacted Features

N/A — sem mudança de comportamento do produto.

## Impacted Business Rules

N/A.

## Impacted Architecture

- [ADR-0013 — fluxos automáticos determinísticos sem IA](../../decisions/ADR-0013-fluxos-automaticos-deterministicos-sem-ia.md) — W7 `release-gate`: a proposta estende o comportamento do gate (limpeza do comentário de falha no sucesso) e adiciona checagem preventiva local ao fluxo de release.

## Impacted Frontend / Backend / Database / Security / Tests

- Frontend / Backend / Database: N/A.
- Security: N/A — sem efeito sobre autenticação, autorização ou RLS; o gate W7 é controle de processo de produção, coberto em Impacted Architecture.
- Tests: `scripts/spec-github/release-gate.test.js` — contratos do gate atualizados (AC1 e AC5).

## Dependencies

Nenhuma.

## Risks

N/A — nenhum risco formal registrado no arquivo.

## Alternatives

Nenhuma alternativa formal foi registrada antes da decisão — o arquivo não documenta opções consideradas.

**Decision:** APPROVED (autorização do usuário, 2026-08-27) — escopo completo (gate + docs + script + template).

## Open Questions

Nenhuma — nenhuma lacuna de política em aberto; a pendência restante é de implementação, registrada na Issue #51 (aberta).

## Acceptance Criteria

- [ ] AC1: `release-gate.js` deleta comentário de falha ao passar (dry-run testado)
- [ ] AC2: `CONVENTIONS.md` atualizado com exemplo §23
- [ ] AC3: `pre-release-check.js` executável e documentado
- [ ] AC4: `release.md` criado
- [ ] AC5: testes de `release-gate.test.js` atualizados

## References

- PR #48 (release v1.10.0 — contexto da descoberta).
- [ADR-0013 — fluxos automáticos determinísticos sem IA](../../decisions/ADR-0013-fluxos-automaticos-deterministicos-sem-ia.md).
- W7 `release-gate` — `scripts/spec-github/release-gate.js` (contratos: `scripts/spec-github/release-gate.test.js`).
- Issue canônica #51 (aberta — pendência de implementação registrada).
