# Componente AdicionarRegistro

**Última verificação:** 2026-08-13 (commit 6323664)
**Código:** `src/react-app/components/AdicionarRegistro.tsx`

## Propósito e uso

Modal de criação de registro de consumo: busca de alimento (com dropdown e favoritos), criação inline de nova referência, peso consumido e cálculo automático de fenilalanina. Usado no Dashboard `[CONFIRMED: code — Dashboard.tsx:77-85]`.

## Props

`{ onClose: () => void; onSuccess: () => void }` `[CONFIRMED: code]`.

## Estado e dados

- `useAuth()` → `{ ready, usuarioAtivoId, timezone }` (timezone do BROWSER via Intl — usado como fallback do contexto) `[CONFIRMED: code — AuthContext.tsx:58, AdicionarRegistro.tsx:19]`.
- `useReferencias(usuarioAtivoId!, { defaultOrder: "nome" })` → `{ data, loading, search, create }`; `useCreateRegistro()` → `{ create, loading, error }` `[CONFIRMED: code]`.
- Estado local: `search`, `selectedReferencia`, `showDropdown`, `pesoG`, `data` (default hoje no timezone), `showModalReferencia`, `creatingReferencia`, `dropdownRef` `[CONFIRMED: code — AdicionarRegistro.tsx:21-29]`.
- Busca com **debounce 300ms** (`setTimeout/clearTimeout`); dropdown fecha com **click fora** (`mousedown`) e **ESC** (`keydown`) `[CONFIRMED: code — AdicionarRegistro.tsx:53-84]`.

## UI

1. **Overlay modal** padrão ([overview.md](../overview.md)); painel `max-w-2xl max-h-[92vh] overflow-y-auto`; título "Adicionar Registro" + botão X.
2. **Campos do form** (labels visíveis):
   - "Data" — `input type="date"`, `required`, default hoje no fuso do usuário `[CONFIRMED: code]`.
   - "Alimento" — input com ícone `Search` à esquerda e X para limpar (`handleClearSearch`); **dropdown** (`max-h-64 overflow-y-auto divide-y`): botões por referência com nome + "{fenil_mg_por_100g.toFixed(1)} mg/100g"; favoritas com `bg-amber-50/60` e estrela `text-amber-500 fill-amber-500`; seleção preenche o input e fecha dropdown `[CONFIRMED: code — AdicionarRegistro.tsx:186-244]`.
   - **Selecionado:** box `bg-indigo-50` com "{nome} - {fenil} mg de fenilalanina por 100g" + X para limpar `[CONFIRMED: code]`.
   - Link "Criar novo alimento" (`Plus`) → abre `ModalReferencia`; criada com sucesso → vira a referência selecionada `[CONFIRMED: code — AdicionarRegistro.tsx:127-146,269-275]`.
   - "Peso consumido (gramas)" — `input type="number" step="0.01"`, placeholder "Ex: 150", `required` `[CONFIRMED: code]`.
   - **Cálculo ao vivo:** se `fenilCalculada > 0`, box `bg-purple-50` "Fenilalanina calculada:" + "{fenilCalculada.toFixed(1)} mg" `[CONFIRMED: code — AdicionarRegistro.tsx:148-151,299-308]`.
3. **Botões:** "Cancelar" (secundário) e "Salvar Registro" (gradiente; `disabled={loading || !selectedReferencia || !pesoG}`; "Salvando...") `[CONFIRMED: code]`.

## Validação e cálculo

- Guard: `if (!usuarioAtivoId || !selectedReferencia || !pesoG || !data || !timezone) return` `[CONFIRMED: code]`.
- **Cálculo no cliente:** `fenil_mg = (fenil_mg_por_100g * Number(pesoG)) / 100`; data convertida com `formatInTimeZone(..., timezone, "yyyy-MM-dd'T'HH:mm:ssXXX")` `[CONFIRMED: code — AdicionarRegistro.tsx:90-109]`.
- Criação de referência: `Number.isNaN(fenil)` → retorna silenciosamente (sem mensagem) `[CONFIRMED: code]`.

## Estados de UI

- **Loading:** `loading = registro.loading || referenciasLoading` → botão disabled + "Salvando..." `[CONFIRMED: code]`.
- **Error:** `useCreateRegistro.error` NÃO é exibido (apenas logado) `[CONFIRMED: code × ausência de UI]`.
- **Empty (busca):** dropdown simplesmente não abre se `listaExibida.length === 0` `[CONFIRMED: code]`.
- **Não autenticado:** `if (!ready || !usuarioAtivoId) return null` `[CONFIRMED: code]`.

## Responsividade / Acessibilidade

Modal bottom-sheet × central (padrão do overview); dropdown com teclado parcial (ESC fecha; sem navegação por setas/aria) `[CONFIRMED: code × ausência]`.

## Testes

`useCreateRegistro.test.tsx`, `useReferencias.test.ts`. Componente sem teste próprio `[CONFIRMED: test, ausência]`.

## Evidências

- E1 — `src/react-app/components/AdicionarRegistro.tsx` completo `[CONFIRMED: code]`
- E2 — Consumidor: `Dashboard.tsx:77-85` `[CONFIRMED: code]`

## Veja também

- [modal-referencia.md](modal-referencia.md), [../pages/dashboard.md](../pages/dashboard.md), [../database/registros.md](../../database/registros.md)
