# ADR-0011 — Testes de segurança com autenticação real (Abordagem B)

**Status:** Accepted
**Origin:** DOCUMENTED
**Data da decisão:** 2026-08-11 (análise 09 — "Limpeza dos Testes da Abordagem A")
**Reconstruída por engenharia reversa em:** — (não se aplica — DOCUMENTED)

## Context

As suítes de segurança (`src/shared/security/`) validam RLS e RPCs com clientes Supabase usando **JWTs reais** contra o banco de development (service role para criar usuários de teste; cleanup em afterAll; skip condicional sem service role). A abordagem anterior (Abordagem A — simulação de `auth.uid()` via `set_config`/`SET LOCAL ROLE` por conexão pg) foi ABANDONADA e seus testes removidos — a análise 09 documenta a decisão e a cobertura equivalente `[CONFIRMED: test, documentation — análise 09]`. O comentário em `test-helpers.ts` nomeia a abordagem: "Abordagem B: Supabase JS client com JWTs reais" `[CONFIRMED: code]`.

## Decision

Validar enforcement de segurança (RLS/RPCs) com autenticação REAL do Supabase no ambiente de development, em vez de simular `auth.uid()` por conexão direta ao banco.

## Origin

DOCUMENTED — `.ai/.temp/analyses/09-auditoria-final-seguranca-dev.md` (seção 1: "Limpeza dos Testes da Abordagem A" + "Cobertura equivalente na Abordagem B") e comentários de `test-helpers.ts`.

## Evidence

- `.ai/.temp/analyses/09-auditoria-final-seguranca-dev.md` `[CONFIRMED: documentation]`
- `src/shared/security/test-helpers.ts` (comentários + helpers) `[CONFIRMED: test]`
- `src/shared/security/*.test.ts` (4 suítes; `describeOrSkip`; `isSecurityMigrationApplied`) `[CONFIRMED: test]`
- Histórico git da remoção dos testes V.x (análise 09 cita V.1–V.7) `[CONFIRMED: documentation]`

## Consequences (OBSERVED)

1. Cobertura real de policies/RPCs com cenários positivos/negativos (AV/T1/T2/T3) `[CONFIRMED: test]`.
2. Dependência do banco development real e de `SUPABASE_SERVICE_ROLE_KEY` (skip condicional) `[CONFIRMED: test]`.
3. Não-determinismo sob paralelismo: colisão de emails de teste (`Date.now()` por processo) — falha transitória em 2 de 3 execuções (Fase 6, GAP-011) `[CONFIRMED: runtime behavior]`.

## Alternatives

A alternativa histórica (Abordagem A) é comprovada e documentada na análise 09: simulação via `set_config`/`SET LOCAL ROLE` — invalidada porque não funciona neste ambiente Supabase `[CONFIRMED: documentation — análise 09]`.

## Related Specs

- [../current/testing/testing-strategy.md](../current/testing/testing-strategy.md), [../current/security/security-model.md](../current/security/security-model.md) (seção 12)
