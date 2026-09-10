# ADR-0010 — RPCs SECURITY DEFINER para operações sensíveis

**Status:** Accepted
**Origin:** RECONSTRUCTED (com hardening DOCUMENTADO em 2026-08-11)
**Data da decisão:** UNKNOWN (funções definidas no baseline 2026-01-02; endurecimento em 2026-08-11 — migration 20260811)
**Reconstruída por engenharia reversa em:** 2026-08-13

> **Nota de revisão (2026-09-04 — ENH-0004):** a decisão permanece vigente — os RPCs sensíveis (`ativar_referencia`, `remover_ou_desativar_referencia` — este redefinido pela migration `20260904000000` com globais sempre arquivadas) continuam SECURITY DEFINER com verificação interna. O inventário de Evidence (10 funções em `pg_proc`, 2026-08-13) era o estado da época; desde a ENH-0004, dev tem 8 funções (as duas eliminadas — `fn_normalizar_nome_referencia` e `fn_remover_favoritos_referencia_inativa` — eram SECURITY INVOKER, fora do escopo desta decisão). Texto original preservado.

## Context

Operações sensíveis do banco são expostas como RPCs SECURITY DEFINER (owner postgres): `ativar_referencia`, `remover_ou_desativar_referencia`, `is_admin_user`, `get_estatisticas_admin`, `fn_trim_background_job_executions` (com `SET search_path TO 'public'`) e `dashboard_hoje`/`dashboard_ultimos_dias`/`handle_new_user` (sem search_path configurado) `[CONFIRMED: database — Fase 2/3]`. Em 2026-08-11, a migration de segurança adicionou verificação interna de dono/delegado/admin nos 2 RPCs de referências (cabeçalho da migration referencia `.ai/.temp/analyses/04-plano-correcao-seguranca.md`) `[CONFIRMED: migration]`.

## Decision

Implementar lógica de negócio sensível como funções SQL SECURITY DEFINER chamadas via PostgREST, com autorização verificada DENTRO da função.

## Origin

RECONSTRUCTED — o padrão geral não tem registro explícito; o HARDENING de `ativar_referencia`/`remover_ou_desativar_referencia` é DOCUMENTED (migration 20260811 cita a análise 04).

## Evidence

- `pg_proc` (10 funções; 7 SECURITY DEFINER; proconfig com/sem search_path) `[CONFIRMED: database]`
- Migration `20260811210456_fix_security_rls_rpc.sql` (comentários + código) `[CONFIRMED: migration]`
- Baseline `20260103015052_remote_schema.sql` `[CONFIRMED: migration]`
- Suítes de segurança T2/T3 (autorização testada com JWTs reais) `[CONFIRMED: test]`

## Consequences (OBSERVED)

1. Autorização centralizada e atômica nos RPCs de referências (dono/delegado/admin; global só admin; vínculo → soft delete) `[CONFIRMED: migration, test]`.
2. Duas funções SECURITY DEFINER sem search_path configurado (`dashboard_hoje`, `dashboard_ultimos_dias`) e uma sem verificação interna (`get_estatisticas_admin`) — fatos do estado atual `[CONFIRMED: database]`.
3. Grants de EXECUTE alcançam todas as roles (default privileges) — a restrição é interna às funções ou inexistente `[CONFIRMED: database]`.

## Alternatives

Não determinadas a partir das evidências disponíveis.

## Related Specs

- [../current/database/rpc.md](../current/database/rpc.md), [../current/security/security-model.md](../current/security/security-model.md) (seção 10), [../current/features/FEAT-0008-referencias-alimentares.md](../current/features/FEAT-0008-referencias-alimentares.md)
- [ADR-0004](ADR-0004-rls-como-enforcement.md)
