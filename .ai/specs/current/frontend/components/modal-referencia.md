# Componente ModalReferencia

**Última verificação:** 2026-09-04 (ENH-0004 — campo Marca; prop `initial` para cópia de global)
**Código:** `src/react-app/components/ModalReferencia.tsx`

## Propósito e uso

Modal de criação/edição de referência alimentar (nome + marca + fenilalanina por 100g), reutilizado em 3 lugares: Dashboard (criar), Referências (criar/editar/arquivar+criar de global) e AdicionarRegistro (criar inline) `[CONFIRMED: code — grep de import]`.

## Props

`{ referencia?: ReferenciaDTO | null; initial?: { nome; marca; fenil_mg_por_100g } | null; loading?: boolean; onClose: () => void; onSubmit: (data: DadosModalReferencia) => Promise<void> }` — `DadosModalReferencia = { nome: string; marca: string; fenil: number }`. `referencia` presente = modo edição; `initial` presente (sem `referencia`) = modo criação pré-preenchido — usado pela página Referências para a cópia da referência global a arquivar (ENH-0004, BR-034); a fonte do preenchimento é `referencia ?? initial` via `useEffect` `[CONFIRMED: code — ModalReferencia.tsx:6-19,32-44]`.

## Estado e dados

Apenas estado local `nome`, `marca` e `fenil` (strings dos inputs); sem hooks de dados (a lógica de create/update é do PAI, via `onSubmit`) `[CONFIRMED: code — ModalReferencia.tsx:28-30]`.

## UI

1. Overlay modal padrão ([overview.md](../overview.md)); painel `max-w-md max-h-[92vh] overflow-y-auto`; título dinâmico "Editar Referência" × "Nova Referência" + botão X (`X` icon) `[CONFIRMED: code]`.
2. Campos: "Nome do Alimento" (`text`, `required`, placeholder "Ex: Maçã Fuji"); **"Marca (opcional)"** (`text` sem `required`, placeholder "Ex: Nestlé", help "Em branco = sem marca declarada.") — adicionado na ENH-0004; canônico revisto 2026-09-04 (em branco NÃO vira "Produto In Natura" — só é gravado o que foi digitado); "Fenilalanina (mg por 100g)" (`number step="0.01"`, `required`, placeholder "Ex: 25.50") `[CONFIRMED: code — ModalReferencia.tsx:74-123]`.
3. Botões: "Cancelar" (`type=button`, secundário) e "Salvar" (`type=submit`, gradiente, `disabled={loading}`, "Salvando...") `[CONFIRMED: code — ModalReferencia.tsx:125-141]`.

## Validação

- Guard no submit: `if (!nome || !fenil) return` — sem exigir marca (marca omissa = EM BRANCO `''` no service/lib; BR-035 — canônico 2026-09-04) + `required` nativo apenas em nome e fenil `[CONFIRMED: code — ModalReferencia.tsx:48]`.
- Validação numérica é responsabilidade do PAI (ex.: `Number.isNaN(fenil)` com `alert("Informe um valor numérico válido para fenilalanina.")` em Referencias.tsx:132-135; Dashboard retorna silenciosamente) `[CONFIRMED: code]`.

## Estados de UI

- **Submitting:** `loading` prop → "Salvando..." + `disabled:opacity-50 disabled:cursor-not-allowed` `[CONFIRMED: code]`.
- **Error:** exibido pelo PAI via `alert()` (o modal não renderiza erro próprio) `[CONFIRMED: code × ausência]`.
- **Edição × criação:** título e preenchimento condicionais a `referencia`/`initial` (`referencia` → "Editar Referência") `[CONFIRMED: code — ModalReferencia.tsx:62-63]`.

## Responsividade / Acessibilidade

Bottom-sheet mobile × central desktop; `rounded-t-2xl sm:rounded-2xl`; botões `flex-col sm:flex-row`; SEM `aria-*`, sem focus trap, sem ESC/overlay para fechar `[CONFIRMED: code × ausência]`.

## Testes

Sem teste próprio; exercitado indiretamente (renderização real) por `Referencias.test.tsx`, `Dashboard.test.tsx` e `AdicionarRegistro.test.tsx` (criar/editar referência) `[CONFIRMED: test]`.

## Evidências

- E1 — `src/react-app/components/ModalReferencia.tsx` completo `[CONFIRMED: code]`
- E2 — Consumidores: Dashboard, Referencias, AdicionarRegistro `[CONFIRMED: code]`

## Veja também

- [adicionar-registro.md](adicionar-registro.md), [../pages/referencias.md](../pages/referencias.md), [../database/referencias.md](../../database/referencias.md)
