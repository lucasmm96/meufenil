# Página Dashboard

**Última verificação:** 2026-08-13 (commit 6323664)
**Rota:** `/dashboard` — `src/react-app/App.tsx:18`

## Propósito

Visão diária do consumo: total de hoje vs. limite, percentual com barra de progresso, restante disponível, gráfico dos últimos 7 dias e alerta quando o limite é ultrapassado. Contém as ações de criar registro e criar referência (modais).

## Acesso

Sem checagem de papel; opera sobre `usuarioAtivoId` (próprio ou assumido) `[CONFIRMED: code — Dashboard.tsx:23-29]`.

## Composição

- `Layout`, `ConsentimentoLGPD` (se `!usuario.consentimento_lgpd_em`), `AdicionarRegistro` (modal, condicional), `ModalReferencia` (modal criar, condicional) `[CONFIRMED: code — Dashboard.tsx:75-93]`.

## Estado e dados

- `useAuth()` → `{ ready, usuarioAtivoId }`; `useDashboard(usuarioAtivoId)` → `{ data: {usuario, hoje, grafico}, loading, reload }`; `useReferencias(usuarioAtivoId!, ...)` para `create` `[CONFIRMED: code]`.
- Estado local: `showAddModal`, `showCriarModal`, `creatingReferencia` `[CONFIRMED: code]`.
- Dados por trás: `dashboard.service.getDashboardData` (usuarios + registros de hoje + 7 dias, agregação client-side) e `updateConsentimentoLGPD` `[CONFIRMED: code]`.

## UI (cards)

1. **"Hoje"** (`Activity`, indigo): `{hoje.total.toFixed(1)} mg` + "de {hoje.limite.toFixed(0)} mg".
2. **"Percentual"**: `{percentual.toFixed(1)}%` (verde) ou vermelho quando `ultrapassou = hoje.total > hoje.limite`; ícone `TrendingUp` verde × `AlertCircle` vermelho; barra `h-2` gradiente verde/vermelho com `width = min(percentual, 100)%`; card com `ring-2 ring-red-500` quando ultrapassado.
3. **"Restante"** (`Activity`, purple): `Math.max(0, limite - total).toFixed(1) mg` "disponível hoje".

4. **Gráfico "Últimos 7 dias"**: Recharts `LineChart` (monotone, gradiente indigo→purple, dots `#6366f1`), padrão de tooltip/eixos do [overview.md](../overview.md) `[CONFIRMED: code — Dashboard.tsx:179-218]`.
5. **Alerta "Limite ultrapassado"** (condicional `ultrapassou`): box vermelho com texto "Você ultrapassou seu limite diário de fenilalanina em {X} mg. Considere ajustar suas próximas refeições." `[CONFIRMED: code — Dashboard.tsx:220-233]`.

## Estados de UI

- **Loading:** `!ready || loading || !dashboard` → `LayoutSkeleton` + `DashboardSkeleton` `[CONFIRMED: code]`.
- **Error:** `useDashboard` captura e loga (`logger.error`) — a página NÃO exibe estado de erro; sem dados → skeleton persistente `[CONFIRMED: code × ausência de UI de erro]`.
- **Submitting (criar referência):** `ModalReferencia loading={creatingReferencia}` ("Salvando...") `[CONFIRMED: code]`.
- **Empty (gráfico):** sem tratamento específico — chart renderiza com dados vazios `[CONFIRMED: code]`.

## Fluxos de interação

- "Adicionar Registro" → abre `AdicionarRegistro`; `onSuccess` → `reload()` + fecha modal `[CONFIRMED: code]`.
- "Criar Alimento" → abre `ModalReferencia`; submit valida `Number.isNaN(fenil)` → `createReferencia` → `reload()` + fecha `[CONFIRMED: code — Dashboard.tsx:55-71]`.
- Consentimento LGPD: `onAccept` → `updateConsentimentoLGPD(usuario.id)` → `reload()` `[CONFIRMED: code]`.
- Data do header formatada no timezone do usuário (`formatInTimeZone`, pt-BR) `[CONFIRMED: code]`.

## Responsividade

Header `flex-col sm:flex-row`; botões `w-full sm:w-auto`; cards `grid-cols-1 sm:grid-cols-2 md:grid-cols-3`; gráfico `h-56 sm:h-64` `[CONFIRMED: code]`.

## Acessibilidade

Textos e botões nativos; sem `aria-*` `[CONFIRMED: ausência]`.

## Testes

`useDashboard.test.tsx` (hook) e `dashboard.service.test.ts` (service). Página sem teste próprio `[CONFIRMED: test, ausência]`.

## Evidências

- E1 — `src/react-app/pages/Dashboard.tsx` completo `[CONFIRMED: code]`
- E2 — `useDashboard.ts`, `dashboard.service.ts` `[CONFIRMED: code]`
- E3 — Rotas e padrões: `App.tsx:18`, overview `[CONFIRMED: code]`

## Veja também

- [adicionar-registro.md](../components/adicionar-registro.md), [modal-referencia.md](../components/modal-referencia.md), [consentimento-lgpd.md](../components/consentimento-lgpd.md)
- [../database/registros.md](../../database/registros.md), [../database/usuarios.md](../../database/usuarios.md)
