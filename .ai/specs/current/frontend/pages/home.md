# Página Home

**Última verificação:** 2026-08-13 (commit 6323664)
**Rota:** `/` — definida em `src/react-app/App.tsx:17`

## Propósito

Landing page pública: apresentação do produto e entrada de login via Google. Única página que NÃO usa o `Layout` compartilhado.

## Acesso

- Autenticado: `useEffect` redireciona para `/dashboard` (`navigate(..., { replace: true })`); durante o redirect renderiza `null` `[CONFIRMED: code — Home.tsx:12-24]`.
- Não autenticado: conteúdo completo da landing `[CONFIRMED: code]`.

## Composição

- Componentes locais `Feature` (3 cards) e `Footer` (links LinkedIn/mailto) — definidos no próprio arquivo, não reutilizados `[CONFIRMED: code — Home.tsx:97-152]`.

## Estado e dados

- `useAuth()` → `{ authUser, loadingAuth }`; `useUser()` → `{ signInWithGoogle }` (OAuth Google com `redirectTo: /dashboard`) `[CONFIRMED: code]`.

## Estados de UI

- **Loading:** spinner central (`animate-spin border-b-2 border-indigo-600`) em gradiente `from-blue-50 to-indigo-100` `[CONFIRMED: code — Home.tsx:16-22]`.
- **Empty/Error:** não aplicável `[CONFIRMED: ausência]`.

## UI

- Hero: logo `/icons/logo.png` (alt "MeuFenil"), título gradiente? não — `font-bold text-gray-900`, subtítulo, botão "Entrar com Google" (gradiente indigo→purple, hover translate) `[CONFIRMED: code]`.
- 3 cards de features com ícones lucide (`Activity`, `BarChart3`, `FileText`) — "Controle Diário", "Estatísticas", "Exportação" `[CONFIRMED: code]`.
- Card LGPD: ícone `Shield` verde + texto "Seus dados estão seguros" `[CONFIRMED: code]`.

## Responsividade

`grid-cols-1 sm:grid-cols-2 md:grid-cols-3` nos features; botão `w-full sm:w-auto`; textos `text-3xl sm:text-4xl md:text-5xl` `[CONFIRMED: code]`.

## Acessibilidade

`alt` em imagem; botão nativo; links com `target="_blank"` SEM `rel` no Footer (fato) `[CONFIRMED: code]`. Sem `aria-*` `[CONFIRMED: ausência]`.

## Testes

Nenhum teste identificado para esta página `[CONFIRMED: ausência]`. `useUser.test.ts` cobre o hook `[CONFIRMED: test]`.

## Evidências

- E1 — `src/react-app/pages/Home.tsx` completo `[CONFIRMED: code]`
- E2 — Rota em `src/react-app/App.tsx:17` `[CONFIRMED: code]`

## Veja também

- [overview.md](../overview.md) (padrões visuais), [dashboard.md](dashboard.md), [security-model](../../security/security-model.md) (OAuth)
