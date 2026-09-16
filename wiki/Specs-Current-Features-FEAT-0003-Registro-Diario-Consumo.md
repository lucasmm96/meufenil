# Feature Spec: Registro diário de consumo

**ID:** FEAT-0003
**Tipo:** Current
**Status:** Implementada
**Última verificação:** 2026-08-13 (commit 6323664)

## Purpose

Permitir que o usuário registre o que consumiu (alimento + peso) com cálculo automático de fenilalanina, e exclua registros. Base de todas as visões de consumo (dashboard, histórico, estatísticas).

## Actors

- Usuário; Delegado (em nome do concedente)

## Preconditions

- Usuário ativo definido; referências existentes; consentimento aceito (via Dashboard)

## Main Flow

1. Dashboard → "Adicionar Registro" abre `AdicionarRegistro` `[CONFIRMED: code — Dashboard.tsx:77-85]`.
2. Usuário escolhe data (default hoje no timezone), busca alimento (debounce 300ms, dropdown com favoritas destacadas), informa peso `[CONFIRMED: code — AdicionarRegistro.tsx]`.
3. Cálculo ao vivo: `fenil_mg = (fenil_mg_por_100g × peso_g) / 100` `[CONFIRMED: code — AdicionarRegistro.tsx:94-95,148-151]`.
4. INSERT em `registros` sob policies (dono/delegado + referência ativa) `[CONFIRMED: database]`.
5. Exclusão: Histórico (ou página) com `confirm()` → DELETE sob policy `[CONFIRMED: code, database]`.

## Alternative Flows

- Criar nova referência inline no modal (abre `ModalReferencia`; a criada vira seleção) `[CONFIRMED: code]`.
- Registro por delegado: `usuario_id` = usuário ativo (concedente); autorização via delegação `[CONFIRMED: database]`.

## Error Flows

- Campos obrigatórios ausentes → guard silencioso + botão disabled `[CONFIRMED: code]`.
- Erros de banco → `AppError` (REGISTRO_CREATE/LIST/DELETE_ERROR) logados; sem UI de erro `[CONFIRMED: code]`.

## Business Rules

- [BR-001](Specs-Current-Domain-Business-Rules), [BR-010](Specs-Current-Domain-Business-Rules), [BR-019](Specs-Current-Domain-Business-Rules), [BR-014](Specs-Current-Domain-Business-Rules), [BR-015](Specs-Current-Domain-Business-Rules), [BR-030](Specs-Current-Domain-Business-Rules)

## Frontend

- [components/adicionar-registro](Specs-Current-Frontend-Components-Adicionar-Registro), [pages/dashboard](Specs-Current-Frontend-Pages-Dashboard), [pages/historico](Specs-Current-Frontend-Pages-Historico)
- `useCreateRegistro`, `useRegistros`, `registros.service`

## Backend

- N/A (cliente → PostgREST direto) `[CONFIRMED: architecture]`

## Database

- [registros](Specs-Current-Database-Registros), [referencias](Specs-Current-Database-Referencias)

## Security

- [security-model](Specs-Current-Security-Security-Model) (policies dono/delegado + referência ativa)

## Tests

- `registros.service.test.ts` (6), `useRegistros.test.ts` (4), `useCreateRegistro.test.tsx` (3, 100%)
- **Coverage status:** PARTIALLY TESTED (componente/modal e fórmula sem teste; policy "referência ativa" sem suíte de segurança)

## Dependencies

- FEAT-0001, FEAT-0008 (referências), FEAT-0002 (consentimento)

## Related Features

- [FEAT-0005 Dashboard](Specs-Current-Features-FEAT-0005-Dashboard), [FEAT-0006 Histórico](Specs-Current-Features-FEAT-0006-Historico-Registros), [FEAT-0007 Estatísticas](Specs-Current-Features-FEAT-0007-Estatisticas)

## Evidence

- E1 — `AdicionarRegistro.tsx` completo, `registros.service.ts` `[CONFIRMED: code]`
- E2 — Policies em `registros` (catálogo) `[CONFIRMED: database]`

## Unknowns

- Nenhum.
