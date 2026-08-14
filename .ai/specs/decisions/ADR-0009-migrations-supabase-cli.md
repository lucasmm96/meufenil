# ADR-0009 — Migrations via Supabase CLI com baseline de `db pull`

**Status:** Accepted
**Origin:** DOCUMENTED
**Data da decisão:** 2026-01-02 (commit `b9a82c7` "setup supabase dev environment (migrations)")
**Reconstruída por engenharia reversa em:** — (não se aplica — DOCUMENTED)

## Context

As migrations atuais são versionadas em `supabase/migrations/` (Supabase CLI), com baseline `20260103015052_remote_schema.sql` gerada por `supabase db pull` (estado do banco na adoção do CLI). Antes, havia SQL avulso em `migrations/` na raiz (legado). A aplicação é disciplinada por `scripts/apply-supabase-migrations.sh` (--env obrigatório; produção exige digitar "PRODUCTION"; fluxo link → migration repair → db push) `[CONFIRMED: migration, code — Fases 2, 4]`. O README documenta: "Migrations do banco de dados são gerenciadas via Supabase CLI e versionadas em supabase/migrations/" `[CONFIRMED: documentation]`.

## Decision

Gerenciar o schema versionado com Supabase CLI, adotando o estado existente do banco como baseline única e aplicando mudanças via script com seleção explícita de ambiente.

## Origin

DOCUMENTED — README.md + commit `b9a82c7` + script.

## Evidence

- `README.md` (seção Migrations) `[CONFIRMED: documentation]`
- `scripts/apply-supabase-migrations.sh` (fluxo completo) `[CONFIRMED: code]`
- `supabase/migrations/` (4 arquivos, baseline `db pull`) × `migrations/` (legado) `[CONFIRMED: migration, git history]`

## Consequences (OBSERVED)

1. Dois locais de SQL coexistem (legado raiz + sistema atual) — histórico documentado, sem migração dos arquivos legados para o novo sistema `[CONFIRMED: filesystem]`.
2. Parte do schema NÃO tem DDL versionado (2 tabelas, 1 coluna, ~20 policies, 1 trigger) — aplicada por canal não-versionado antes/depois do baseline `[CONFIRMED: database × migration — Fase 2]`.
3. Produção protegida por confirmação digitada no script `[CONFIRMED: code]`.

## Alternatives

Não determinadas a partir das evidências disponíveis.

## Related Specs

- [../current/database/overview.md](../current/database/overview.md), [../current/backend/cli.md](../current/backend/cli.md), [../current/security/secrets-and-environments.md](../current/security/secrets-and-environments.md)
