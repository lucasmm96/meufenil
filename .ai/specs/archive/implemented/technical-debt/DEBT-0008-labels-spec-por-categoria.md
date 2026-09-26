# DEBT-0008 — Labels de spec por categoria em vez de labels por ID

**Type:** DEBT
**Status:** IMPLEMENTED
**Title:** Labels de spec por categoria em vez de labels por ID
**Issue:** #94
**Created on:** 2026-09-25
**Implemented Through:** Alternativa C — 6 labels de categoria (`spec:feat`/`spec:enh`/`spec:ref`/`spec:debt`/`spec:sec`/`spec:test`), dedup por título `[SPEC-ID]`, migração retroativa de 34 Issues; CONVENTIONS.md §18.2/§18.5, github-manager, ADR-0012, templates atualizados — sessão meuFenil018 (2026-09-25)

## Problem

Labels `spec:<ID>` (ex: `spec:FEAT-0002`, `spec:ENH-0008`) crescem ilimitadamente — uma label por Spec, usada em exatamente uma Issue canônica, sem possibilidade de reaproveitamento. Labels são uma ferramenta de agrupamento; usados 1:1 com IDs únicos, acumulam ruído operacional sem valor de filtro.

## Current State

Conforme CONVENTIONS.md §18.5, a linkagem Issue→Spec usa dois mecanismos:

1. **Label `spec:<ID>`** — chave de dedup no sync (busca idempotente) e linkagem reversa Issue→Spec.
2. **Bloco SPEC-PROJECTION** no body da Issue — âncora de conteúdo com ID, caminho e status.

O repositório acumula labels `spec:FEAT-*`, `spec:ENH-*`, `spec:DEBT-*` etc., cada um vinculado a exatamente uma Issue canônica ativa ou histórica.

## Proposed State

Substituir o conjunto aberto `spec:<ID>` por um conjunto fechado de **labels de categoria**:

| Label | Agrupa |
|---|---|
| `spec:feat` | Features (`FEAT-*`) |
| `spec:enh` | Enhancements (`ENH-*`) |
| `spec:ref` | Refactors (`REF-*`) |
| `spec:debt` | Technical Debt (`DEBT-*`) |
| `spec:sec` | Security (`SEC-*`) |
| `spec:test` | Testing (`TEST-*`) |

Para dedup/lookup no sync, trocar a busca por label pela busca por **título de Issue** — o formato `[FEAT-0002] Título` já é determinístico. O SPEC-PROJECTION no body continua como âncora de linkagem.

**Ajuste retroativo:** aplicar a todas as Issues canônicas existentes (ativas e históricas) — remover labels `spec:<ID>`, adicionar label de categoria correspondente, deletar os labels `spec:<ID>` do repositório.

## Motivation

[FACTUAL] Labels são uma ferramenta de agrupamento do GitHub. Uma label por Spec cria um conjunto que cresce sem limite; pesquisar por `spec:FEAT-0002` retorna sempre exatamente uma Issue — o que torna a label redundante com o título da Issue e com o SPEC-PROJECTION.

[FACTUAL] O SPEC-PROJECTION block e o campo `Issue:` no frontmatter já provêm linkagem bidirecional robusta. A busca por título `[SPEC-ID]` é determinística dado o formato canônico dos títulos de Issues.

[ASSUMPTION] O volume atual e projetado do projeto não tornará a busca por título (`search` endpoint do GitHub) um gargalo por rate limit.

## Evidence

- `github.com/lucasmm96/meufenil/labels`: labels `spec:FEAT-*`, `spec:ENH-*`, `spec:DEBT-*` etc. acumulados sem reuso observado.
- CONVENTIONS.md §18.5: uso de `spec:<ID>` como chave de dedup e linkagem.
- Discussão sessão meuFenil018 (2026-09-25).

## Scope

- Criação dos labels de categoria (`spec:feat`, `spec:enh`, `spec:ref`, `spec:debt`, `spec:sec`, `spec:test`) no repositório.
- **Ajuste retroativo:** em todas as Issues canônicas (ativas e históricas/fechadas), remover o label `spec:<ID>` e adicionar o label de categoria correspondente.
- Remoção de todos os labels `spec:<ID>` do repositório.
- Atualização de CONVENTIONS.md §18.5: nova chave de dedup (busca por título) e novo sistema de labels de categoria.
- Atualização do agente `github-manager` para usar busca por título como chave primária de dedup.
- Atualização de `proposed/index.md` e demais referências que mencionem `label spec:<ID>`.
- Auditoria pós-migração: toda Issue canônica ativa possui exatamente um label `spec:<tipo>`.

## Out of Scope

- Labels não relacionados a specs (`triage`, `spec-created`, `spec-driven`, `duplicate`, `not-planned`, tipo de Issue, prioridade etc.) — sem alteração.
- Redesign do SPEC-PROJECTION block ou do campo `Issue:` no frontmatter.
- Alteração da estrutura de títulos de Issues canônicas.

## Impacted Features

N/A — infraestrutura operacional, sem impacto em features do produto.

## Impacted Business Rules

N/A

## Impacted Architecture

- CONVENTIONS.md §18.5 — mecanismo de dedup/sync e linkagem Issue→Spec.
- Agente `github-manager` — lógica de busca de Issue canônica.

## Impacted Frontend / Backend / Database / Security / Tests

- Frontend: N/A
- Backend: N/A
- Database: N/A
- Security: N/A
- Tests: N/A

## Dependencies

Nenhuma.

## Risks

[FACTUAL] A busca por título (`search` endpoint do GitHub) tem rate limit mais restrito que a busca por label. Para o volume atual, não é um problema, mas é uma degradação técnica a monitorar.

[ASSUMPTION] Migração retroativa das Issues (remover label `spec:<ID>`, adicionar label de categoria) pode introduzir erros se feita sem checklist; auditoria pós-migração é necessária para garantir cobertura completa, incluindo Issues fechadas.

## Alternatives

**A — Manter `spec:<ID>` (status quo):** Sem trabalho de migração; continua crescendo sem limite. Não resolve o label bloat.

**B — Label único `spec-driven` para Issues canônicas + busca por título para dedup (sem labels de categoria):** Mais simples; perde a capacidade de filtrar Issues por categoria de Spec no GitHub UI. Adequado se filtros por categoria não tiverem valor operacional. Verifica-se se `spec-driven` já existe antes de criar.

**C — Labels de categoria `spec:<tipo>` (proposta acima):** Conjunto fechado com 6 labels; permite filtrar por categoria; exige mudança na CONVENTIONS, no `github-manager` e ajuste retroativo em todas as Issues.

**Decision:** C — labels de categoria (`spec:feat`, `spec:enh`, `spec:ref`, `spec:debt`, `spec:sec`, `spec:test`) + dedup por título de Issue. **Approved by:** Lucas (usuário) **Approved on:** 2026-09-25

## Open Questions

1. O filtro por categoria de Spec no GitHub UI tem valor operacional suficiente para justificar a complexidade da migração (alternativa C vs. B)?
2. Existe algum fluxo automatizado fora do `github-manager` que consome o label `spec:<ID>` diretamente?

## Acceptance Criteria

*(Condicionais à alternativa escolhida pela decisão humana)*

**Se C (proposta principal):**
- [ ] Labels `spec:feat`, `spec:enh`, `spec:ref`, `spec:debt`, `spec:sec`, `spec:test` existem no repositório.
- [ ] Nenhuma Issue canônica (ativa ou histórica/fechada) possui label `spec:<ID>`.
- [ ] Nenhum label `spec:<ID>` existe no repositório.
- [ ] CONVENTIONS.md §18.5 descreve a nova chave de dedup (título) e os novos labels de categoria.
- [ ] `github-manager` usa busca por título como chave primária de dedup.
- [ ] Auditoria pós-migração confirmada: toda Issue canônica ativa possui exatamente um label `spec:<tipo>`.

**Se B:**
- [ ] Label `spec-driven` aplicado a todas as Issues canônicas ativas.
- [ ] Nenhuma Issue canônica (ativa ou histórica/fechada) possui label `spec:<ID>`.
- [ ] Nenhum label `spec:<ID>` existe no repositório.
- [ ] CONVENTIONS.md §18.5 descreve a nova chave de dedup (título).

## References

- [CONVENTIONS.md §18.5](.ai/specs/CONVENTIONS.md) — mecanismo atual de dedup e linkagem
- [proposed/index.md](.ai/specs/proposed/index.md) — catálogo de propostas ativas
- Discussão que originou esta proposta: sessão meuFenil018 (2026-09-25)
