# Página Estatísticas

**Última verificação:** 2026-08-13 (commit 6323664)
**Rota:** `/estatisticas` — `src/react-app/App.tsx:21`

## Propósito

Análise do consumo por período (semana/mês): cards de total/média/maior consumo, gráfico de barras por dia e exportação CSV/JSON dos dados agregados.

## Acesso

Skeleton enquanto `!podeBuscar` (`authReady && usuarioReady && usuarioAtivoId`); opera sobre o usuário ativo `[CONFIRMED: code — Estatisticas.tsx:19-33]`.

## Estado e dados

- `useAuth()` + `useUsuarioAtivo()` + `useEstatisticas({usuarioId, periodo})` → `{ data: {registros, totalConsumo, mediaConsumo, maiorConsumo}, loading }` `[CONFIRMED: code]`.
- Estado local: `periodo: PeriodoEstatisticas = "semana"` `[CONFIRMED: code]`.
- `estatisticas.service.getEstatisticas` agrega no CLIENTE (busca timezone do usuário + registros do período; reduce de somas) `[CONFIRMED: code]`.

## UI

1. **Header:** título + subtítulo "Análise do consumo de fenilalanina" + botões **CSV** e **JSON** (`Download` icon, estilo secundário) `[CONFIRMED: code]`.
2. **Seletor de período:** 2 botões — "Última Semana" / "Último Mês"; ativo com gradiente indigo→purple, inativo `bg-gray-100` `[CONFIRMED: code]`.
3. **3 cards:** "Total" (`TrendingUp` azul, "{total.toFixed(1)} mg", "nos últimos 7 dias"/"nos últimos 30 dias"), "Média Diária" (`Calendar` verde, "por dia"), "Maior Consumo" (`TrendingUp` roxo, "em um dia") `[CONFIRMED: code]`.
4. **Gráfico "Consumo por Dia":** Recharts `BarChart` com gradiente `#6366f1→#9333ea`, `radius=[8,8,0,0]`, ticks dd/MM e tooltip padrão do [overview.md](../overview.md); altura `h-64 sm:h-80` `[CONFIRMED: code — Estatisticas.tsx:178-218]`.

## Exportação (implementação real)

- `downloadFile(content, filename, type)`: Blob + `URL.createObjectURL` + `<a download>` click + revoke `[CONFIRMED: code — Estatisticas.tsx:44-56]`.
- **CSV:** header `data,total_mg\n` + linhas `{data},{total.toFixed(2)}` → arquivo `meufenil-estatisticas-{periodo}.csv` (`text/csv;charset=utf-8;`) `[CONFIRMED: code]`.
- **JSON:** `JSON.stringify(registros, null, 2)` → `meufenil-estatisticas-{periodo}.json` `[CONFIRMED: code]`.

## Estados de UI

- **Loading:** `LayoutSkeleton` + `EstatisticasSkeleton` (também cobre `!data`) `[CONFIRMED: code]`.
- **Error:** hook loga; sem UI de erro (estado de skeleton persistente) `[CONFIRMED: ausência]`.
- **Empty:** sem tratamento específico — gráfico renderiza sem barras e cards com 0.0 `[CONFIRMED: code]`.

## Responsividade

Header `flex-col sm:flex-row`; botões de export `grid-cols-2 sm:flex`; período `grid-cols-2`; cards `grid-cols-1 sm:grid-cols-2 md:grid-cols-3` `[CONFIRMED: code]`.

## Acessibilidade

Botões nativos com texto; sem `aria-*` `[CONFIRMED: ausência]`.

## Testes

`useEstatisticas.test.ts`, `estatisticas.service.test.ts`. Página sem teste próprio `[CONFIRMED: test, ausência]`.

## Evidências

- E1 — `src/react-app/pages/Estatisticas.tsx` completo `[CONFIRMED: code]`
- E2 — `useEstatisticas.ts`, `estatisticas.service.ts`, `estatisticas.dto.ts` `[CONFIRMED: code]`

## Veja também

- [perfil.md](perfil.md) (exportação JSON do perfil), [../database/registros.md](../../database/registros.md)
