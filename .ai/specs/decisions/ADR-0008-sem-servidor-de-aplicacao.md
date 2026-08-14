# ADR-0008 — Sem servidor de aplicação: lógica client-side + BaaS

**Status:** Accepted
**Origin:** RECONSTRUCTED
**Data da decisão:** UNKNOWN
**Reconstruída por engenharia reversa em:** 2026-08-13

## Context

Não existe servidor de aplicação: os 12 services são client-side (browser, anon key), agregações de dashboard/estatísticas são feitas no cliente (reduce no browser), e o único backend próprio são 2 Edge Functions + 1 função Vercel. As RPCs `dashboard_hoje`/`dashboard_ultimos_dias` existem no banco (baseline) mas NÃO têm chamadores — indicando agregação que migrou para o cliente `[CONFIRMED: code — Fases 4–5; INFERRED: histórico da migração]`.

## Decision

Manter a lógica de negócio de leitura/agregação no browser (services client-side sobre PostgREST), reservando server-side para operações sensíveis (RPCs SECURITY DEFINER) e tarefas agendadas (keepalive).

## Origin

RECONSTRUCTED — nenhum documento declara a decisão; reconstruída do inventário (ausência de servidor, RPCs órfãs, agregação client-side).

## Evidence

- Ausência de servidor de aplicação no repositório `[CONFIRMED: filesystem]`
- `dashboard.service.ts`, `estatisticas.service.ts` (agregação client-side) `[CONFIRMED: code]`
- RPCs `dashboard_hoje`/`dashboard_ultimos_dias` sem chamadores (grep, 2026-08-13) `[CONFIRMED: ausência — code]`
- [../current/backend/overview.md](../current/backend/overview.md) (inventário)

## Consequences (OBSERVED)

1. Volume de dados transferido ao cliente nas visões de consumo (registros do período) `[CONFIRMED: code]`.
2. Regras de cálculo residem no frontend (BR-001 a BR-007) — testadas apenas por services/hooks `[CONFIRMED: code, test — Fase 6]`.
3. Lógica sensível permanece no banco (RPCs/triggers) `[CONFIRMED: database]`.

## Alternatives

Não determinadas a partir das evidências disponíveis.

## Related Specs

- [../current/backend/overview.md](../current/backend/overview.md), [../current/frontend/overview.md](../current/frontend/overview.md), [../current/database/rpc.md](../current/database/rpc.md)
- [ADR-0001](ADR-0001-supabase-como-baas.md), [ADR-0004](ADR-0004-rls-como-enforcement.md)
