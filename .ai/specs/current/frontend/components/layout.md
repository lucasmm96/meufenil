# Componente Layout

**Última verificação:** 2026-08-13 (commit 6323664)
**Código:** `src/react-app/components/Layout.tsx`

## Propósito e uso

Shell compartilhado de TODAS as páginas autenticadas (todas exceto Home): header sticky com logo/perfil/logout + banner login-as, barra de navegação, `<main>` e footer. `[CONFIRMED: code — usado por 8 páginas]`.

## Props

`{ children: ReactNode }` `[CONFIRMED: code]`.

## Estado e dados

- `useAuth()` → `{ authUser, loadingAuth }`; `useLayoutPerfil(authUser?.id)` → `{ perfil }`; `useLogout()` → `{ handleLogout }` `[CONFIRMED: code — Layout.tsx:13-18]`.
- `isAdmin = perfil?.role === "admin"` — controla o item "Admin" na navegação `[CONFIRMED: code]`.
- `isActive(path)` por `useLocation().pathname` (igualdade exata) `[CONFIRMED: code]`.

## UI

1. **Header** (`sticky top-0 z-50`, `bg-white/80 backdrop-blur-md shadow-sm border-b`): `LoginAsBanner` no topo; logo `/icons/logo.png` + nome com gradiente texto (`bg-clip-text text-transparent from-indigo-600 to-purple-600`) linkando `/dashboard`; à direita: link "Perfil" (`User` icon; texto `hidden sm:inline`) e botão "Sair" (`LogOut`, `handleLogout`) `[CONFIRMED: code]`.
2. **Nav** (`bg-white/60 backdrop-blur-md border-b`): itens fixos Dashboard (`LayoutDashboard`), Referências (`List`), Histórico (`History`), Estatísticas (`BarChart3`), Exames PKU (`Stethoscope`), Sobre (`Info`) + **Admin** (`Shield`) condicional a `isAdmin`; ativo = `text-indigo-600 bg-indigo-50`; layout `grid grid-cols-4 md:flex` com ícone + label (`text-[10px] sm:text-xs md:text-sm`) `[CONFIRMED: code — Layout.tsx:23-31,80-106]`.
3. **Main:** `flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8` `[CONFIRMED: code]`.
4. **Footer:** "Feito com ❤ para pacientes fenil do Brasil" + LinkedIn/Email + © ano dinâmico `[CONFIRMED: code]`.
5. **Fundo geral:** `min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50` `[CONFIRMED: code]`.

## Estados de UI

- **Loading:** `loadingAuth` → spinner central (sem skeleton) `[CONFIRMED: code — Layout.tsx:33-39]`.
- **Error (perfil):** `useLayoutPerfil` loga; sem UI (item Admin simplesmente não aparece) `[CONFIRMED: code × ausência]`.

## Responsividade

Header `h-16` com textos escondidos no mobile (`hidden sm:inline`); nav `grid-cols-4` mobile (2×2 implícito pelo conteúdo) → `md:flex`; labels com tamanhos progressivos `[CONFIRMED: code]`.

## Acessibilidade

`<nav>`, `<header>`, `<main>`, `<footer>` semânticos; `alt` no logo; links com texto (alguns só ícone no mobile — fato); sem `aria-*` `[CONFIRMED: code × ausência]`.

## Testes

`useLayoutPerfil.test.ts`, `useLogout.test.ts` (hooks). Componente sem teste próprio `[CONFIRMED: test, ausência]`.

## Evidências

- E1 — `src/react-app/components/Layout.tsx` completo `[CONFIRMED: code]`
- E2 — Consumidores: 8 páginas `[CONFIRMED: code — grep import Layout]`

## Veja também

- [login-as.md](login-as.md) (banner), [../pages/home.md](../pages/home.md) (única página sem Layout), [../overview.md](../overview.md) (padrões visuais)
