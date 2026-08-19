# Feature Spec: Autenticação (Google OAuth + sessão)

**ID:** FEAT-0001
**Tipo:** Current
**Status:** Implementada
**Última verificação:** 2026-08-15 (DEBT-0002)

## Purpose

Permitir que o usuário entre na aplicação com sua conta Google e manter a sessão durante o uso; criar automaticamente o perfil no primeiro acesso.

## Actors

- Usuário (novo ou existente)

## Preconditions

- Nenhuma (login disponível na página pública Home)

## Main Flow

1. Usuário clica "Entrar com Google" na Home → `signInWithOAuth({provider: "google", redirectTo: /dashboard})` `[CONFIRMED: code — useUser.ts:50-57]`.
2. Supabase Auth autentica e redireciona para `/dashboard` `[CONFIRMED: code]`.
3. Trigger `on_auth_user_created` cria o perfil em `usuarios` (nome = full_name ou email, role user, timezone America/Sao_Paulo, limite 500 via default da coluna) `[CONFIRMED: migration — baseline + 20260815000000]`.
4. Sessão gerenciada pelo SDK: bootstrap com `getSession()` + listener `onAuthStateChange` `[CONFIRMED: code — AuthContext.tsx:63-88]`.

## Alternative Flows

- Usuário já autenticado visita `/` → redirect imediato para `/dashboard` `[CONFIRMED: code — Home.tsx:12-14]`.
- Logout: "Sair" no Layout → `signOut()` + limpeza da sessão login-as `[CONFIRMED: code — auth.service.ts, AuthContext.tsx:157-162]`.

## Error Flows

- Falha no logout → `AppError("AUTH_LOGOUT_ERROR")` (logado; sem UI de erro) `[CONFIRMED: code]`.
- Estado de sessão indisponível (`loadingAuth`) → spinner/skeletons nas páginas `[CONFIRMED: code]`.

## Business Rules

- [BR-025](../domain/business-rules.md) (perfil criado no sign-up com limite 500)

## Frontend

- [pages/home](../frontend/pages/home.md), [pages/dashboard](../frontend/pages/dashboard.md) (pós-login)
- `useUser`, `auth.service`, `AuthContext` — [overview](../frontend/overview.md)

## Backend

- N/A (auth é BaaS Supabase; sem servidor próprio) `[CONFIRMED: architecture — ../backend/overview.md]`

## Database

- [usuarios](../database/usuarios.md), [triggers](../database/triggers.md) (`on_auth_user_created`)

## Security

- [security-model](../security/security-model.md) (seção 1 — Authentication)

## Tests

- `src/react-app/services/auth.service.test.ts` (2), `src/react-app/hooks/useUser.test.ts` (2)
- `src/shared/security/auth-real-validation.test.ts` (AV.1–AV.7, integração real)
- **Coverage status:** PARTIALLY TESTED (fluxo OAuth real sem teste E2E; trigger exercitado indiretamente)

## Dependencies

- Supabase Auth (BaaS), Google OAuth

## Related Features

- [FEAT-0011 Delegação](FEAT-0011-delegacao-acesso.md) (identidade real × usuário ativo), [FEAT-0010 Perfil](FEAT-0010-perfil-usuario.md)

## Evidence

- E1 — `useUser.ts:50-57`, `AuthContext.tsx:63-88,157-162`, `auth.service.ts`, `Home.tsx:12-24` `[CONFIRMED: code]`
- E2 — Trigger e perfil: baseline `20260103015052_remote_schema.sql:680`; corpo da função (sem limite explícito): migration `20260815000000_limite_diario_default_500.sql` `[CONFIRMED: migration]`

## Unknowns

- Nenhum.
