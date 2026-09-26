# DEBT-0008 — Labels de spec por categoria em vez de labels por ID

**Type:** DEBT
**Status:** IMPLEMENTED
**Decision:** C — labels de categoria (`spec:feat`, `spec:enh`, `spec:ref`, `spec:debt`, `spec:sec`, `spec:test`) + dedup por título de Issue. Migração retroativa de 34 Issues.
**Approved by:** Lucas Martins Menezes
**Approved on:** 2026-09-25
**Title:** Labels de spec por categoria em vez de labels por ID
**Issue:** #94
**Created on:** 2026-09-25
**Implemented Through:** Alternativa C — 6 labels de categoria, dedup por título `[SPEC-ID]`, migração retroativa de 34 Issues; CONVENTIONS.md §18.2/§18.5, github-manager, ADR-0012, templates atualizados — PR #98

## Problem

Labels `spec:<ID>` (ex: `spec:FEAT-0002`, `spec:ENH-0008`) crescem ilimitadamente — uma label por Spec, usada em exatamente uma Issue canônica, sem possibilidade de reaproveitamento. Labels são uma ferramenta de agrupamento; usados 1:1 com IDs únicos, acumulam ruído operacional sem valor de filtro.

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

## Scope

- Criação dos labels de categoria no repositório.
- Ajuste retroativo: em todas as Issues canônicas, remover `spec:<ID>` e adicionar label de categoria.
- Remoção de todos os labels `spec:<ID>` do repositório.
- Atualização de [CONVENTIONS.md §18.5](https://github.com/lucasmm96/meufenil/blob/master/.ai/specs/CONVENTIONS.md) — nova chave de dedup (busca por título) e novo sistema de labels.
- Atualização do agente `github-manager` para usar busca por título como chave primária de dedup.
- ADR-0012 atualizado.

## Acceptance Criteria

- [x] Labels `spec:feat`, `spec:enh`, `spec:ref`, `spec:debt`, `spec:sec`, `spec:test` existem no repositório.
- [x] Nenhuma Issue canônica possui label `spec:<ID>`.
- [x] Nenhum label `spec:<ID>` existe no repositório.
- [x] CONVENTIONS.md §18.5 descreve a nova chave de dedup (título) e os novos labels de categoria.
- [x] `github-manager` usa busca por título como chave primária de dedup.
- [x] Auditoria pós-migração confirmada: 34 Issues migradas.
