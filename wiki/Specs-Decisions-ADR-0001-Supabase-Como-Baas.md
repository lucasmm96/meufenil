# ADR-0001 — Supabase como backend/BaaS

**Status:** Accepted
**Origin:** DOCUMENTED
**Data da decisão:** 2025-12-15 (primeiro commit `c171d0c` com scaffold; stack documentada no README) — data exata da decisão: UNKNOWN
**Reconstruída por engenharia reversa em:** — (não se aplica — DOCUMENTED)

## Context

O MeuFenil usa Supabase como backend: PostgreSQL com PostgREST, Auth (Google OAuth) e Edge Functions. O frontend fala diretamente com o Supabase via `supabase-js` (anon key + JWT) `[CONFIRMED: code — lib/supabase.ts]`. O README documenta explicitamente o stack: "Backend / BaaS — Supabase (Autenticação OAuth Google, Banco PostgreSQL, Edge Functions)" `[CONFIRMED: documentation — README.md]`.

## Decision

Usar Supabase como plataforma única de backend (banco, auth e funções serverless), sem servidor de aplicação próprio.

## Origin

DOCUMENTED — README.md (seção "Stack técnica") e histórico git (`b9a82c7` "setup supabase dev environment (migrations)").

## Evidence

- `README.md` (stack técnica, setup, migrations) `[CONFIRMED: documentation]`
- `src/react-app/lib/supabase.ts` (client com anon key) `[CONFIRMED: code]`
- `supabase/config.toml`, `supabase/migrations/` `[CONFIRMED: configuration, migration]`
- Git: `c171d0c` (2025-12-15), `b9a82c7` (2026-01-02) `[CONFIRMED: git history]`

## Consequences (OBSERVED)

1. Autorização exercida no banco (RLS/RPCs) — 7 tabelas com RLS, 31 policies `[CONFIRMED: database]`.
2. Migrations versionadas via Supabase CLI com baseline `db pull` (ADR-0009) `[CONFIRMED: migration]`.
3. Parte do schema sem DDL versionado (aplicado por canal não-versionado) — consequência observada do fluxo de trabalho adotado, não da plataforma em si `[CONFIRMED: database — Fase 2]`.
4. Dependência de planos gratuitos do Supabase — mitigada pelo keepalive (ADR-0007) `[CONFIRMED: README, code]`.

## Alternatives

Não determinadas a partir das evidências disponíveis.

## Related Specs

- [../current/backend/overview.md](Specs-Current-Backend-Overview), [../current/security/security-model.md](Specs-Current-Security-Security-Model), [../current/database/overview.md](Specs-Current-Database-Overview)
- [ADR-0003](Specs-Decisions-ADR-0003-Google-Oauth), [ADR-0004](Specs-Decisions-ADR-0004-Rls-Como-Enforcement), [ADR-0009](Specs-Decisions-ADR-0009-Migrations-Supabase-Cli)
