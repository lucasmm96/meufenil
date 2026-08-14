# ADR-0003 — Google OAuth como autenticação

**Status:** Accepted
**Origin:** DOCUMENTED
**Data da decisão:** UNKNOWN (documentada no README)
**Reconstruída por engenharia reversa em:** — (não se aplica — DOCUMENTED)

## Context

A única forma de autenticação da aplicação é Google OAuth via Supabase Auth: `signInWithOAuth({ provider: "google", redirectTo: /dashboard })` `[CONFIRMED: code — useUser.ts:50-57]`. O README documenta "Autenticação de usuários (OAuth com Google)" e "Autenticação via Google OAuth (Supabase Auth)" `[CONFIRMED: documentation]`.

## Decision

Usar Google OAuth como único provedor de login (sem email/senha nem outros provedores na aplicação).

## Origin

DOCUMENTED — README.md (funcionalidades + seção "Autenticação e permissões").

## Evidence

- `README.md` `[CONFIRMED: documentation]`
- `src/react-app/hooks/useUser.ts:50-57` (provider: "google") `[CONFIRMED: code]`
- `Home.tsx` (botão "Entrar com Google") `[CONFIRMED: UI]`

## Consequences (OBSERVED)

1. Identidade do usuário = `auth.users.id` (perfil em `usuarios` espelha via FK + trigger) `[CONFIRMED: database]`.
2. Dados de perfil iniciais vêm do OAuth (`full_name` → nome) `[CONFIRMED: migration — handle_new_user]`.
3. As suítes de segurança usam auth email/senha APENAS para criar usuários de teste via admin API (não é um fluxo de login do produto) `[CONFIRMED: test — test-helpers.ts]`.

## Alternatives

Não determinadas a partir das evidências disponíveis.

## Related Specs

- [../current/security/security-model.md](../current/security/security-model.md), [../current/features/FEAT-0001-autenticacao.md](../current/features/FEAT-0001-autenticacao.md)
- [ADR-0001](ADR-0001-supabase-como-baas.md)
