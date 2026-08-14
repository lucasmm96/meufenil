# ADR-0004 — RLS como fronteira de autorização

**Status:** Accepted
**Origin:** DOCUMENTED
**Data da decisão:** UNKNOWN (documentada no README)
**Reconstruída por engenharia reversa em:** — (não se aplica — DOCUMENTED)

## Context

As regras de acesso são aplicadas diretamente no banco: RLS habilitado nas 7 tabelas com 31 políticas; grants de tabela são amplos (todas as roles com privilégios completos) — o RLS é a fronteira EFETIVA `[CONFIRMED: database — Fase 2]`. O README declara: "As regras de acesso são aplicadas diretamente no banco de dados via Row Level Security (RLS)" `[CONFIRMED: documentation — README.md]`.

## Decision

Exercer autorização no PostgreSQL via RLS (políticas com ownership, delegação e admin), complementada por RPCs SECURITY DEFINER para operações com regras atômicas.

## Origin

DOCUMENTED — README.md (seção "Autenticação e permissões").

## Evidence

- `README.md` `[CONFIRMED: documentation]`
- Catálogo: RLS = true nas 7 tabelas; 31 policies; grants amplos `[CONFIRMED: database]`
- Migrations: baseline (policies iniciais) + 20260810/20260811 (consolidação e hardening) `[CONFIRMED: migration]`
- [../current/security/security-model.md](../current/security/security-model.md) (matrizes)

## Consequences (OBSERVED)

1. UI é apenas controle de experiência — páginas operam sobre `usuarioAtivoId` e confiam no banco `[CONFIRMED: code, database]`.
2. Parte das políticas foi consolidada/renomeada por canal NÃO versionado (divergência migrations × banco — fato) `[CONFIRMED: database × migration]`.
3. Grants amplos + RLS: qualquer falha de policy expõe dados (a policy `debug_allow_all` existiu e foi removida em 2026-08-11 — histórico documentado) `[CONFIRMED: migration, git history]`.
4. Anon consegue listar referências globais (consequência direta das policies SELECT) `[CONFIRMED: database]`.

## Alternatives

Não determinadas a partir das evidências disponíveis.

## Related Specs

- [../current/security/security-model.md](../current/security/security-model.md), [../current/database/overview.md](../current/database/overview.md)
- [ADR-0010](ADR-0010-rpcs-security-definer.md)
