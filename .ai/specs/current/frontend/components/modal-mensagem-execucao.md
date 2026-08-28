# Componente ModalMensagemExecucao

**Última verificação:** 2026-08-27 (ENH-0003 — refinamentos de layout do histórico)
**Código:** `src/react-app/components/ModalMensagemExecucao.tsx`

## Propósito e uso

Modal de leitura da mensagem de uma execução de background job, aberto pelo botão "Ver mensagem" da coluna Mensagem do "Histórico das execuções" (página Admin) — substitui a exibição truncada da mensagem na tabela, mantendo a mensagem disponível de forma colapsada `[CONFIRMED: code]`.

## Props

`{ execution: BackgroundJobExecutionDTO; onClose: () => void }` — o pai renderiza condicionalmente (`{mensagemExecucao && <ModalMensagemExecucao ... />}`), então `execution` nunca é nulo dentro do modal `[CONFIRMED: code — ModalMensagemExecucao.tsx:5-9, Admin.tsx:629-634]`.

## Estado e dados

Sem estado próprio — componente puramente apresentacional; dados vêm da prop `execution` `[CONFIRMED: code × ausência]`.

## UI

1. Overlay modal padrão ([overview.md](../overview.md)) — `fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4`; painel `max-w-md max-h-[92vh] overflow-y-auto` (bottom-sheet mobile × central desktop) `[CONFIRMED: code — ModalMensagemExecucao.tsx:15-16]`.
2. Cabeçalho: título "Mensagem da execução" + subtítulo `{execution.job_key}` + botão X (`X` icon, `aria-label="Fechar"`) `[CONFIRMED: code]`.
3. Corpo: mensagem em `<p>` (`bg-gray-50 rounded-xl p-3 border border-gray-200`, `whitespace-pre-wrap break-words`) `[CONFIRMED: code]`.

## Estados de UI

- **Fechado:** pai não renderiza (condicional no `Admin.tsx`) `[CONFIRMED: code]`.

## Responsividade / Acessibilidade

Bottom-sheet mobile × central desktop (`rounded-t-2xl sm:rounded-2xl`); SEM focus trap, SEM ESC/overlay para fechar (padrão do ModalReferencia — fechar apenas pelo X) `[CONFIRMED: code × ausência]`.

## Testes

Exercitado por `Admin.test.tsx` ("abre e fecha o modal de mensagem da execução") `[CONFIRMED: test]`.

## Evidências

- E1 — `src/react-app/components/ModalMensagemExecucao.tsx` completo `[CONFIRMED: code]`
- E2 — Consumidor: `Admin.tsx` — botão "Ver mensagem" (`Admin.tsx:494-505`), estado `mensagemExecucao` (`Admin.tsx:87`) e render (`Admin.tsx:629-634`) `[CONFIRMED: code]`

## Veja também

- [modal-referencia.md](modal-referencia.md), [../pages/admin.md](../pages/admin.md), [../overview.md](../overview.md)
