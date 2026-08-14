# Página Histórico

**Última verificação:** 2026-08-13 (commit 6323664)
**Rota:** `/historico` — `src/react-app/App.tsx:20`

## Propósito

Lista todos os registros de consumo do usuário ativo, agrupados por data (decrescente), com filtros por período e exclusão individual.

## Acesso

Sem checagem de papel; opera sobre `usuarioAtivoId` `[CONFIRMED: code — Historico.tsx:11-27]`.

## Estado e dados

- `useAuth()` → `{ ready, usuarioAtivoId }`; `useRegistros({usuarioId, dataInicio, dataFim})` → `{ data: registros, loading, remove }` `[CONFIRMED: code]`.
- Estado local (filtros em 2 estágios): `dataInicio/dataFim` (aplicados) e `dataInicioTemp/dataFimTemp` (rascunho); "Aplicar filtros" promove temp → aplicado; "Limpar filtros" zera os 4 `[CONFIRMED: code — Historico.tsx:13-44]`.
- Agrupamento client-side por `data` via `useMemo` (reduce) `[CONFIRMED: code]`.

## UI

1. **Header:** título + "Todos os seus registros de consumo".
2. **Card Filtros:** dois `input type="date"` (Data Início / Data Fim, labels visíveis) + botões "Aplicar filtros" (indigo) e "Limpar filtros" (texto indigo, só quando há filtro aplicado) `[CONFIRMED: code]`.
3. **Grupos por dia:** card por data — cabeçalho com `format(..., "EEEE, d 'de' MMMM", {locale: ptBR})`, contagem ("1 registro"/"N registros") e "Total do dia {X.toFixed(1)} mg" em `text-indigo-600`; linhas dos registros em `bg-gray-50` com nome do alimento, "{peso_g}g • {fenil_mg.toFixed(1)} mg" e botão `Trash2` vermelho `[CONFIRMED: code — Historico.tsx:137-201]`.

## Estados de UI

- **Loading:** `!ready || loading` → `LayoutSkeleton` + `HistoricoSkeleton` `[CONFIRMED: code]`.
- **Empty:** `Calendar` cinza + "Nenhum registro encontrado" + "Comece adicionando seus primeiros registros no Dashboard" `[CONFIRMED: code — Historico.tsx:125-134]`.
- **Error:** `useRegistros` loga (`logger.error`) e mantém lista vazia — a página NÃO distingue erro de vazio (erro ⇒ empty state) `[CONFIRMED: code × ausência de UI de erro]`.
- **Submitting (delete):** sem estado específico `[CONFIRMED: ausência]`.

## Fluxos de interação

- Exclusão: `confirm("Tem certeza que deseja excluir este registro?")` → `remove(id)` (delete via service; reload) `[CONFIRMED: code — Historico.tsx:29-32]`.

## Responsividade

Cards `p-4 sm:p-6`; header de grupo `flex-col sm:flex-row`; filtros `grid-cols-1 sm:grid-cols-2` `[CONFIRMED: code]`.

## Acessibilidade

Labels visíveis; botão de ícone SEM `title`/aria (fato) `[CONFIRMED: code]`. Sem `aria-*` `[CONFIRMED: ausência]`.

## Testes

`useRegistros.test.ts`, `registros.service.test.ts`. Página sem teste próprio `[CONFIRMED: test, ausência]`.

## Evidências

- E1 — `src/react-app/pages/Historico.tsx` completo `[CONFIRMED: code]`

## Veja também

- [dashboard.md](dashboard.md), [../database/registros.md](../../database/registros.md)
