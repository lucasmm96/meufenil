# FEAT-0002 — Exportar o histórico de medições (CSV / JSON / PDF)

**Type:** FEAT
**Status:** PROPOSED
**Title:** Exportar o histórico de medições (CSV / JSON / PDF)
**Issue:** #31
**Created on:** 2026-08-17
**Decision:** ACCEPTED
**Approved by:** Lucas
**Approved on:** 2026-10-02

## Problem

Usuários não conseguem exportar o histórico de medições de fenilalanina para compartilhar com o nutricionista — o app mostra gráficos e listas, mas não há como levar os dados para fora (planilha/relatório).

## Current State

O app possui dashboard (`../current/features/FEAT-0005-dashboard.md`) e histórico de registros (`../current/features/FEAT-0006-historico-registros.md`) somente-visualização; nenhum mecanismo de exportação `[CONFIRMED: filesystem]`.

## Proposed State

Botão (ou menu) de exportação no histórico que permite baixar as medições em três formatos:

- **CSV** — compatível com planilhas (separador, encoding e datas pt-BR).
- **JSON** — estrutura de dados completa para integração/backup.
- **PDF** — relatório formatado para impressão/compartilhamento.

O usuário pode filtrar o período antes de exportar. O arquivo gerado inclui: data, valor de fenilalanina, e nome do alimento/refeição associado.

## Motivation

- **FACTUAL:** pedido de usuário registrado em Issue externa (External #27 — piloto F6 do ecossistema GitHub).
- **ASSUMPTION:** CSV é o formato de maior utilidade para nutricionistas (alternativa PDF é comum, mas menos manipulável).

## Evidence

External #27 (Issue externa de teste do piloto da Fase 6 — ADR-0012).

## Scope

Exportação do histórico de registros nos formatos CSV, JSON e PDF, com filtro de período e coluna de nome do alimento. Implementação frontend — dados já disponíveis no cliente/consulta existente; sem novo backend. PDF gerado via jsPDF + jspdf-autotable.

## Out of Scope

Agendamento de envio por e-mail · integração com sistemas de nutricionista · exportação de outros tipos de dados (configurações, alimentos cadastrados).

## Impacted Features

`../current/features/FEAT-0006-historico-registros.md` · `../current/features/FEAT-0005-dashboard.md`

## Impacted Business Rules

N/A

## Impacted Architecture

N/A

## Impacted Frontend / Backend / Database / Security / Tests

- Frontend: página de histórico (seletor de formato, filtro de período, geração e download do arquivo)
- Tests: testes do fluxo de exportação para cada formato (CSV, JSON, PDF), filtro de período e coluna de alimento
- Backend / Database / Security: N/A

## Dependencies

- `jspdf` + `jspdf-autotable` (geração de PDF no cliente)

## Risks

- Formato de data/CSV/JSON deve respeitar o padrão local (pt-BR) e a TZ do produto — cobrir em testes.
- PDF gerado via **jsPDF + jspdf-autotable** — bundle ~250 KB gzip; adequado para tabela de medições.
- Filtro de período vazio (sem registros no intervalo) deve ser tratado graciosamente.

## Alternatives

- **A.** Exportar apenas CSV (proposta original).
- **B.** Exportar CSV + JSON + PDF (proposta atual — escolhida pelo autor).
- **C.** Integração nativa com sistemas de nutricionista (fora do escopo).

**Decision:** Exportar CSV + JSON + PDF (alternativa B — proposta atual)

## Open Questions

N/A

## Acceptance Criteria

- Controle de exportação visível no histórico com opção de formato (CSV / JSON / PDF) e filtro de período.
- CSV: cabeçalho em pt-BR, separador e encoding corretos, abre em planilhas sem erros.
- JSON: estrutura válida com todos os campos (data, valor de fenilalanina, nome do alimento).
- PDF: relatório legível e imprimível com os mesmos dados.
- Filtro de período aplicado antes da exportação; intervalo vazio exibe mensagem adequada.
- Coluna de nome do alimento presente em todos os formatos.
- Testes cobrindo cada formato, filtro de período e TZ pt-BR.

## References

- External #27 · `.ai/specs/current/features/FEAT-0006-historico-registros.md`

---

*Última atualização: 2026-10-01 — adicionados formatos JSON e PDF; OQ1 (filtro de período) e OQ2 (coluna de alimento) respondidos e incorporados ao escopo; jsPDF + jspdf-autotable definido como biblioteca de PDF.*
