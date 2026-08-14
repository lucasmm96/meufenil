# Feature Spec: Exames de PKU

**ID:** FEAT-0009
**Tipo:** Current
**Status:** Implementada
**Última verificação:** 2026-08-13 (commit 6323664)

## Purpose

Registrar e acompanhar exames laboratoriais de PKU (data + resultado em mg/dL): resumo com último exame e variação, gráfico de histórico, lista com exclusão.

## Actors

- Usuário; Delegado

## Preconditions

- Usuário ativo definido

## Main Flow

1. Página lista exames (ordenados por data asc client-side); cards Último Exame / Variação / Total (condicionais a dados) `[CONFIRMED: code — Exames.tsx:82-183]`.
2. "Registrar Exame" abre modal: data (default hoje no timezone do usuário) + resultado numérico; submit converte data local → UTC (`zonedTimeToUtc`) e insere `[CONFIRMED: code — Exames.tsx:30-67]`.
3. Gráfico "Histórico de Resultados" (≥ 2 exames) e tabela desktop × cards mobile com exclusão (`confirm`) `[CONFIRMED: code]`.
4. Box informativo: conversão "PHE ÷ 60,6 = PKU em mg/dL" (apenas texto; sem cálculo) `[CONFIRMED: code — Exames.tsx:334-336,386-388]`.

## Alternative Flows

- Empty state: "Nenhum exame registrado ainda" + "Registrar primeiro exame" `[CONFIRMED: code]`.

## Error Flows

- Guards silenciosos (data/valor ausentes ou não numéricos); erros de banco logados (`EXAMES_*_ERROR`), sem UI `[CONFIRMED: code × ausência]`.

## Business Rules

- [BR-007](../domain/business-rules.md), [BR-008](../domain/business-rules.md), [BR-012](../domain/business-rules.md), [BR-014](../domain/business-rules.md), [BR-015](../domain/business-rules.md)

## Frontend

- [pages/exames](../frontend/pages/exames.md)
- `useExames`, `exames.service`

## Backend

- N/A

## Database

- [exames_pku](../database/exames_pku.md)

## Security

- [security-model](../security/security-model.md) (policies dono/delegado)

## Tests

- `exames.service.test.ts` (6, 100%), `useExames.test.ts` (93.75%)
- **Coverage status:** PARTIALLY TESTED (página/modal/tendência sem teste; policies de exames sem suíte de segurança)

## Dependencies

- FEAT-0001

## Related Features

- [FEAT-0004 Limite diário](FEAT-0004-limite-diario.md) (ambos medem controle de PKU)

## Evidence

- E1 — `Exames.tsx` completo, `exames.service.ts` `[CONFIRMED: code]`
- E2 — Tabela e policies: catálogo `[CONFIRMED: database]`

## Unknowns

- Nenhum.
