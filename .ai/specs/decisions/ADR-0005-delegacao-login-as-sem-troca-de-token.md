# ADR-0005 — Delegação de acesso (login-as) sem troca de identidade

**Status:** Accepted
**Origin:** RECONSTRUCTED
**Data da decisão:** UNKNOWN (commits da feature entre 2025-12 e 2026-01 — `e19f43a`, `d14b1de`, `2e6f540`, `fcbaf61`)
**Reconstruída por engenharia reversa em:** 2026-08-13

## Context

O sistema permite que um usuário (delegado) opere em nome de outro (concedente). A implementação NÃO troca o JWT: "assumir perfil" é estado de UI (`sessionStorage["meufenil:login-as"]`) e a autorização do perfil assumido é exercida pelas 15 políticas "dono ou delegado" e 2 RPCs, consultando `delegacoes_acesso` (revogação por `revoked_at`) `[CONFIRMED: code, database — Fase 3]`.

## Decision

Implementar delegação como dados de domínio (tabela `delegacoes_acesso`) consumidos pelo RLS/RPCs, com a identidade real de sessão sempre preservada — o "usuário ativo" é um contexto de UI, não uma troca de credencial.

## Origin

RECONSTRUCTED — não há registro documental explícito da decisão; reconstruída a partir da implementação (edge function + AuthContext + policies) e do histórico git da feature.

## Evidence

- `supabase/functions/delegar-acesso/index.ts` (conceder/revogar/assumir/sair; assumir NÃO emite token novo) `[CONFIRMED: code]`
- `AuthContext.tsx:13,104-105,134-149` (sessionStorage; usuarioAtivoId) `[CONFIRMED: code]`
- `delegacoes_acesso` + 15 policies + RPCs (catálogo e migrations) `[CONFIRMED: database]`
- Git: `e19f43a`, `d14b1de`, `2e6f540`, `fcbaf61` `[CONFIRMED: git history]`

## Consequences (OBSERVED)

1. A identidade real (`authUser`) nunca muda — o banner "Voltar para minha conta" apenas limpa estado de UI `[CONFIRMED: code]`.
2. Revogação tem efeito imediato (toda checagem exige `revoked_at IS NULL`) `[CONFIRMED: database]`.
3. Perfil em modo delegado é somente-leitura na UI (privacidade oculta) `[CONFIRMED: code]`.
4. DDL de `delegacoes_acesso` NÃO versionado (aplicado por canal não-versionado) — fato `[CONFIRMED: database × migration]`.
5. Índice parcial garante 1 delegação ativa por par `[CONFIRMED: database]`.

## Alternatives

Não determinadas a partir das evidências disponíveis.

## Related Specs

- [../current/security/security-model.md](../current/security/security-model.md) (seção 9), [../current/features/FEAT-0011-delegacao-acesso.md](../current/features/FEAT-0011-delegacao-acesso.md), [../current/database/delegacoes_acesso.md](../current/database/delegacoes_acesso.md), [../current/backend/edge-function-delegar-acesso.md](../current/backend/edge-function-delegar-acesso.md)
