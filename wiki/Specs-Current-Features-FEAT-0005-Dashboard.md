# Feature Spec: Dashboard diário

**ID:** FEAT-0005
**Tipo:** Current
**Status:** Implementada
**Última verificação:** 2026-08-13 (commit 6323664)

## Purpose

Visão do dia corrente: consumo total vs. limite, percentual com progresso, restante disponível, gráfico dos últimos 7 dias e alerta de ultrapassagem — porta de entrada das ações de registro e criação de alimento.

## Actors

- Usuário; Delegado (opera sobre o usuário ativo)

## Preconditions

- Usuário ativo definido; consentimento aceito (senão, modal LGPD primeiro)

## Main Flow

1. `useDashboard(usuarioAtivoId)` carrega usuário (timezone, limite, consentimento) + registros de hoje + 7 dias (agregação client-side) `[CONFIRMED: code — dashboard.service.ts]`.
2. Renderiza 3 cards (Hoje / Percentual / Restante), gráfico "Últimos 7 dias" (LineChart com gradiente) e alerta condicional `[CONFIRMED: code — Dashboard.tsx]`.
3. Botões "Criar Alimento" e "Adicionar Registro" abrem os modais; sucesso → `reload()` `[CONFIRMED: code]`.

## Alternative Flows

- Data do header formatada no timezone do usuário (pt-BR) `[CONFIRMED: code — Dashboard.tsx:100-106]`.

## Error Flows

- Erros de carregamento → `AppError` (DASHBOARD_USER/TODAY/GRAPH_ERROR) logados; página permanece em skeleton (sem UI de erro) `[CONFIRMED: code × ausência]`.

## Business Rules

- [BR-002](Specs-Current-Domain-Business-Rules), [BR-003](Specs-Current-Domain-Business-Rules), [BR-004](Specs-Current-Domain-Business-Rules), [BR-033](Specs-Current-Domain-Business-Rules)

## Frontend

- [pages/dashboard](Specs-Current-Frontend-Pages-Dashboard), [components/adicionar-registro](Specs-Current-Frontend-Components-Adicionar-Registro), [components/modal-referencia](Specs-Current-Frontend-Components-Modal-Referencia), [components/consentimento-lgpd](Specs-Current-Frontend-Components-Consentimento-Lgpd)
- `useDashboard`, `dashboard.service`

## Backend

- N/A (agregação client-side; RPCs `dashboard_hoje`/`dashboard_ultimos_dias` existem no banco mas SEM chamadores — ver [rpc](Specs-Current-Database-Rpc))

## Database

- [usuarios](Specs-Current-Database-Usuarios), [registros](Specs-Current-Database-Registros)

## Security

- [security-model](Specs-Current-Security-Security-Model) (RLS de leitura)

## Tests

- `dashboard.service.test.ts` (4), `useDashboard.test.tsx` (100%)
- **Coverage status:** PARTIALLY TESTED (página sem teste; alerta/cards sem teste de UI)

## Dependencies

- FEAT-0001, FEAT-0003, FEAT-0004, FEAT-0008

## Related Features

- [FEAT-0006 Histórico](Specs-Current-Features-FEAT-0006-Historico-Registros), [FEAT-0007 Estatísticas](Specs-Current-Features-FEAT-0007-Estatisticas)

## Evidence

- E1 — `Dashboard.tsx` completo, `dashboard.service.ts` `[CONFIRMED: code]`
- E2 — RPCs órfãos: grep de chamadores (Fase 4) `[CONFIRMED: ausência — code]`

## Unknowns

- Nenhum.
