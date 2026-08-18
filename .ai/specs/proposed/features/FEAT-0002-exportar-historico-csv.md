# FEAT-0002 — Exportar o histórico de medições em CSV

**Type:** FEAT
**Status:** PROPOSED
**Title:** Exportar o histórico de medições em CSV
**Issue:** —
**Created on:** 2026-08-17

## Problem

Usuários não conseguem exportar o histórico de medições de fenilalanina para compartilhar com o nutricionista — o app mostra gráficos e listas, mas não há como levar os dados para fora (planilha/relatório).

## Current State

O app possui dashboard (`../current/features/FEAT-0005-dashboard.md`) e histórico de registros (`../current/features/FEAT-0006-historico-registros.md`) somente-visualização; nenhum mecanismo de exportação `[CONFIRMED: filesystem]`.

## Proposed State

Botão "Exportar CSV" no histórico (e/ou dashboard) que baixa as medições com data, valor de fenilalanina e alimento/referência associado, em formato CSV compatível com planilhas.

## Motivation

- **FACTUAL:** pedido de usuário registrado em Issue externa (External #27 — piloto F6 do ecossistema GitHub).
- **ASSUMPTION:** CSV é o formato de maior utilidade para nutricionistas (alternativa PDF é comum, mas menos manipulável).

## Evidence

External #27 (Issue externa de teste do piloto da Fase 6 — ADR-0012).

## Scope

Exportação CSV do histórico de registros (frontend, sem backend novo — dados já disponíveis no cliente/consulta existente).

## Out of Scope

Exportação PDF · agendamento de envio por e-mail · integração com sistemas de nutricionista.

## Impacted Features

`../current/features/FEAT-0006-historico-registros.md` · `../current/features/FEAT-0005-dashboard.md`

## Impacted Business Rules

N/A

## Impacted Architecture

N/A

## Impacted Frontend / Backend / Database / Security / Tests

- Frontend: página de histórico (botão + geração do arquivo)
- Tests: teste do fluxo de exportação
- Backend / Database / Security: N/A

## Dependencies

Nenhuma

## Risks

- Formato de data/CSV deve respeitar o padrão local (pt-BR) e a TZ do produto — cobrir em testes.
- Nenhum.

## Alternatives

- **A.** Botão "Exportar CSV" no histórico (proposta).
- **B.** Exportação PDF (mais trabalho de geração; menos manipulável).
- **C.** Integração nativa com sistemas de nutricionista (fora do escopo de um app open source pequeno). **Decision:** TBD — a escolha é humana e é obrigatória para ACCEPTED/IMPLEMENTED; na aprovação registrar **Approved by:** e **Approved on:**

## Open Questions

- Exportar apenas o histórico completo ou permitir seleção de período?
- Incluir coluna de alimento/refeição ou apenas valores?

## Acceptance Criteria

- Botão de exportação visível no histórico; download gera CSV com cabeçalho em pt-BR.
- CSV abre corretamente em planilhas (separador, encoding e datas consistentes com o produto).
- Testes cobrindo a geração do CSV (incluindo TZ pt-BR).

## References

- External #27 · `.ai/specs/current/features/FEAT-0006-historico-registros.md`
