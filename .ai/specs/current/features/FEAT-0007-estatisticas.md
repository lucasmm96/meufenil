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

- [BR-006](../domain/business-rules.md)

## Frontend

- [pages/estatisticas](../frontend/pages/estatisticas.md)
- `useEstatisticas`, `estatisticas.service`, `estatisticas.dto`

## Backend

- N/A

## Database

- [registros](../database/registros.md), [usuarios](../database/usuarios.md) (timezone)

## Security

- [security-model](../security/security-model.md) (RLS de leitura)

## Tests

- `estatisticas.service.test.ts` (3, 100%), `useEstatisticas.test.ts` (100%)
- **Coverage status:** PARTIALLY TESTED (exportação e página sem teste)

## Dependencies

- FEAT-0001, FEAT-0003

## Related Features

- [FEAT-0006 Histórico](FEAT-0006-historico-registros.md), [FEAT-0010 Perfil](FEAT-0010-perfil-usuario.md) (export JSON do perfil)

## Evidence

- E1 — `Estatisticas.tsx` completo, `estatisticas.service.ts:31-73` `[CONFIRMED: code]`

## Unknowns

- Nenhum.
