# Componente ModalReferencia

**Última verificação:** 2026-08-13 (commit 6323664)
**Código:** `src/react-app/components/ModalReferencia.tsx`

## Propósito e uso

Modal de criação/edição de referência alimentar (nome + fenilalanina por 100g), reutilizado em 3 lugares: Dashboard (criar), Referências (criar/editar) e AdicionarRegistro (criar inline) `[CONFIRMED: code — grep de import]`.

## Props

`{ referencia?: ReferenciaDTO | null; loading?: boolean; onClose: () => void; onSubmit: (data: { nome: string; fenil: number }) => Promise<void> }` — `referencia` presente = modo edição (preenche campos via `useEffect`) `[CONFIRMED: code — ModalReferencia.tsx:5-29]`.

## Estado e dados

Apenas estado local `nome` e `fenil` (strings dos inputs); sem hooks de dados (a lógica de create/update é do PAI, via `onSubmit`) `[CONFIRMED: code]`.

## UI

1. Overlay modal padrão ([overview.md](../overview.md)); painel `max-w-md max-h-[92vh] overflow-y-auto`; título dinâmico "Editar Referência" × "Nova Referência" + botão X (`X` icon) `[CONFIRMED: code]`.
2. Campos (labels visíveis, `required`): "Nome do Alimento" (`text`, placeholder "Ex: Maçã Fuji") e "Fenilalanina (mg por 100g)" (`number step="0.01"`, placeholder "Ex: 25.50") `[CONFIRMED: code]`.
3. Botões: "Cancelar" (`type=button`, secundário) e "Salvar" (`type=submit`, gradiente, `disabled={loading}`, "Salvando...") `[CONFIRMED: code — ModalReferencia.tsx:90-106]`.

## Validação

- Guard no submit: `if (!nome || !fenil) return` (sem mensagem de erro) + `required` nativo `[CONFIRMED: code]`.
- Validação numérica é responsabilidade do PAI (ex.: `Number.isNaN(fenil)` com `alert("Informe um valor numérico válido para fenilalanina.")` em Referencias.tsx:107; Dashboard retorna silenciosamente) `[CONFIRMED: code]`.

## Estados de UI

- **Submitting:** `loading` prop → "Salvando..." + `disabled:opacity-50 disabled:cursor-not-allowed` `[CONFIRMED: code]`.
- **Error:** exibido pelo PAI via `alert()` (o modal não renderiza erro próprio) `[CONFIRMED: code × ausência]`.
- **Edição × criação:** título e preenchimento condicionais a `referencia` `[CONFIRMED: code]`.

## Responsividade / Acessibilidade

Bottom-sheet mobile × central desktop; `rounded-t-2xl sm:rounded-2xl`; botões `flex-col sm:flex-row`; SEM `aria-*`, sem focus trap, sem ESC/overlay para fechar `[CONFIRMED: code × ausência]`.

## Testes

Sem teste próprio; coberto indiretamente por `Referencias.test`/`useReferencias.test`? NÃO — nenhum teste de componente identificado `[CONFIRMED: ausência]`.

## Evidências

- E1 — `src/react-app/components/ModalReferencia.tsx` completo `[CONFIRMED: code]`
- E2 — Consumidores: Dashboard, Referencias, AdicionarRegistro `[CONFIRMED: code]`

## Veja também

- [adicionar-registro.md](adicionar-registro.md), [../pages/referencias.md](../pages/referencias.md), [../database/referencias.md](../../database/referencias.md)
