# Feature Spec: Estatísticas por período + exportação

**ID:** FEAT-0007
**Tipo:** Current
**Status:** Implementada
**Última verificação:** 2026-08-13 (commit 6323664)

## Purpose

Analisar o consumo em janelas de tempo (semana/mês) — total, média diária e maior consumo, com gráfico de barras por dia — e exportar os dados agregados em CSV ou JSON.

## Actors

- Usuário; Delegado

## Preconditions

- Usuário ativo definido

## Main Flow

1. Seletor "Última Semana" (7 dias incluindo hoje) / "Último Mês" (30) → `useEstatisticas({usuarioId, periodo})` `[CONFIRMED: code — Estatisticas.tsx:21-32, estatisticas.service.ts:31-34]`.
2. Agregação client-side por dia; cards Total / Média Diária / Maior Consumo; BarChart "Consumo por Dia" `[CONFIRMED: code — estatisticas.service.ts:55-73, Estatisticas.tsx]`.
3. Exportação: CSV (`data,total_mg` + linhas, `meufenil-estatisticas-{periodo}.csv`) ou JSON (registros agregados) via Blob + `<a download>` `[CONFIRMED: code — Estatisticas.tsx:44-77]`.

## Alternative Flows

- Sem registros no período: cards com 0.0 e gráfico vazio (sem empty state dedicado — fato) `[CONFIRMED: code]`.

## Error Flows

- Erros (`ESTATISTICAS_USUARIO/REGISTROS_ERROR`) logados; página permanece em skeleton (sem UI de erro) `[CONFIRMED: ausência]`.

## Business Rules

- [BR-006](Specs-Current-Domain-Business-Rules)

## Frontend

- [pages/estatisticas](Specs-Current-Frontend-Pages-Estatisticas)
- `useEstatisticas`, `estatisticas.service`, `estatisticas.dto`

## Backend

- N/A

## Database

- [registros](Specs-Current-Database-Registros), [usuarios](Specs-Current-Database-Usuarios) (timezone)

## Security

- [security-model](Specs-Current-Security-Security-Model) (RLS de leitura)

## Tests

- `estatisticas.service.test.ts` (3, 100%), `useEstatisticas.test.ts` (100%)
- **Coverage status:** PARTIALLY TESTED (exportação e página sem teste)

## Dependencies

- FEAT-0001, FEAT-0003

## Related Features

- [FEAT-0006 Histórico](Specs-Current-Features-FEAT-0006-Historico-Registros), [FEAT-0010 Perfil](Specs-Current-Features-FEAT-0010-Perfil-Usuario) (export JSON do perfil)

## Evidence

- E1 — `Estatisticas.tsx` completo, `estatisticas.service.ts:31-73` `[CONFIRMED: code]`

## Unknowns

- Nenhum.
