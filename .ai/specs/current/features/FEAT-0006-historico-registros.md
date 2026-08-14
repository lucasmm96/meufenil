# Feature Spec: Histórico de registros

**ID:** FEAT-0006
**Tipo:** Current
**Status:** Implementada
**Última verificação:** 2026-08-13 (commit 6323664)

## Purpose

Consultar todos os registros de consumo do usuário ativo, agrupados por dia (decrescente), com filtros por período e exclusão individual.

## Actors

- Usuário; Delegado

## Preconditions

- Usuário ativo definido

## Main Flow

1. `useRegistros({usuarioId, dataInicio, dataFim})` carrega os registros (ordenados por data desc) `[CONFIRMED: code]`.
2. Filtros em 2 estágios: rascunho (inputs de data) → "Aplicar filtros" promove → nova consulta; "Limpar filtros" zera `[CONFIRMED: code — Historico.tsx:13-44]`.
3. Agrupamento client-side por `data`; cada grupo mostra título formatado pt-BR, contagem e "Total do dia {X} mg" `[CONFIRMED: code — Historico.tsx:46-52,137-172]`.
4. Exclusão: `confirm("Tem certeza que deseja excluir este registro?")` → `remove(id)` `[CONFIRMED: code — Historico.tsx:29-32]`.

## Alternative Flows

- Nenhum identificado.

## Error Flows

- Erro de carregamento logado (`REGISTRO_LIST_ERROR`); lista permanece vazia → **erro é indistinguível do empty state** (fato) `[CONFIRMED: code × ausência de UI de erro]`.

## Business Rules

- [BR-005](../domain/business-rules.md), [BR-014](../domain/business-rules.md), [BR-015](../domain/business-rules.md)

## Frontend

- [pages/historico](../frontend/pages/historico.md)
- `useRegistros`, `registros.service`

## Backend

- N/A

## Database

- [registros](../database/registros.md)

## Security

- [security-model](../security/security-model.md) (SELECT/DELETE dono/delegado)

## Tests

- `useRegistros.test.ts` (4, 100%), `registros.service.test.ts` (6)
- **Coverage status:** PARTIALLY TESTED (página, filtros e agrupamento sem teste)

## Dependencies

- FEAT-0001, FEAT-0003

## Related Features

- [FEAT-0005 Dashboard](FEAT-0005-dashboard.md), [FEAT-0007 Estatísticas](FEAT-0007-estatisticas.md)

## Evidence

- E1 — `Historico.tsx` completo `[CONFIRMED: code]`
- E2 — Policies de `registros` (catálogo) `[CONFIRMED: database]`

## Unknowns

- Nenhum.
