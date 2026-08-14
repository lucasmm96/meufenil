# Suíte de Componentes login-as (Delegação)

**Última verificação:** 2026-08-13 (commit 6323664)
**Código:** `src/react-app/components/login-as/` (5 componentes)

## Propósito e uso

Interface da delegação de acesso (login-as): banner de perfil assumido, cards de acessos concedidos/recebidos e modal de concessão. O modelo de segurança e a edge function estão em [security-model](../../security/security-model.md) e [edge-function-delegar-acesso](../../backend/edge-function-delegar-acesso.md) — aqui apenas a UI.

## Inventário

| Componente | Onde usado | Papel |
|---|---|---|
| `LoginAsBanner.tsx` | `Layout.tsx:44` (header de TODAS as páginas logadas) | aviso âmbar quando `isDelegado` |
| `AcessosConcedidosCard.tsx` | `Perfil.tsx` | lista de delegações concedidas + revogar + abrir modal de concessão |
| `AcessosRecebidosCard.tsx` | `Perfil.tsx` | lista de delegações recebidas + "assumir" |
| `ConcederAcessoModal.tsx` | `Perfil.tsx` | modal de concessão por e-mail |
| `ModalConcederAcesso.tsx` | `Perfil.tsx` | modal usado na renderização do Perfil |

`[CONFIRMED: code — grep de import; Perfil.tsx:9-11]`

## LoginAsBanner

- Renderiza apenas se `isDelegado && owner`; barra `bg-amber-100 border-b border-amber-300` com texto "Você está acessando o perfil de **{owner.nome ?? "outro usuário"}**" e botão "Voltar para minha conta" (`ArrowLeftRight`) → `sairDoPerfilAssumido()` `[CONFIRMED: code]`.

## AcessosConcedidosCard

- Props: `{ acessos, loading, onRevogar, onConceder?, isReadOnly? }` `[CONFIRMED: code]`.
- Título "Acessos concedidos"; botão "Conceder acesso" (`Plus`) visível se `!isReadOnly && onConceder`; loading → "Carregando..."; empty → "Você ainda não concedeu acesso a ninguém."; linhas com nome/e-mail do `usuario_destino` e botão revogar (`Trash2`) com `disabled` se read-only `[CONFIRMED: code]`.

## AcessosRecebidosCard

- Props: `{ acessos, loading, onAssumir, isReadOnly? }` `[CONFIRMED: code]`.
- Título "Acessos recebidos"; loading → "Carregando..."; empty → "Nenhum acesso recebido."; linhas com nome/e-mail do `usuario_origem` e botão assumir (`ArrowRightCircle`) com `disabled` se read-only `[CONFIRMED: code]`.

## ModalConcederAcesso (usado no Perfil)

- Props: `{ open, onClose, onConceder: (email) => Promise<void>, loading? }`; `open=false` → `null` `[CONFIRMED: code]`.
- UI: overlay `bg-black/40` central (SEM bottom-sheet); painel `max-w-md`; título "Conceder acesso à conta" + X; campo "Email do usuário" (`type=email required`, placeholder `email@exemplo.com`); erro inline `text-sm text-red-600` extraído de `err?.error || err?.message || "Erro ao conceder acesso"`; botões "Cancelar" e "Conceder acesso"/"Concedendo..." (`bg-indigo-600`, `disabled={loading}`); sucesso limpa email e fecha `[CONFIRMED: code — ModalConcederAcesso.tsx]`.
- Submit delega ao `conceder(email)` do AuthContext → edge function `conceder` `[CONFIRMED: code]`.

## ConcederAcessoModal (variante NÃO utilizada)

- Componente duplicado semanticamente: props `{ open, loading?, onClose, onConfirm }`; título "Conceder acesso" com ícone `ShieldCheck`; validação própria ("Informe um e-mail válido.") e erro `err?.message ?? "Erro ao conceder acesso. Tente novamente."`; overlay `bg-black/40` central, painel `rounded-2xl` `[CONFIRMED: code — ConcederAcessoModal.tsx]`.
- **Fato:** o Perfil importa AMBOS os modais (`Perfil.tsx:11`) mas renderiza apenas `ModalConcederAcesso` (`Perfil.tsx:250-257`) — `ConcederAcessoModal` não tem consumidor identificado no código atual `[CONFIRMED: code × ausência de consumidor — grep 2026-08-13]`.

## Estados de UI

- **Loading:** textos "Carregando..." nos cards `[CONFIRMED: code]`.
- **Empty:** textos próprios acima `[CONFIRMED: code]`.
- **Read-only (delegado):** botões disabled e modal de concessão não renderizado (`Perfil` oculta) `[CONFIRMED: code]`.
- **Error:** ações de conceder/revogar/assumir propagam erro sem UI própria (exceção não tratada na promise) `[CONFIRMED: code × ausência]`.

## Testes

Sem testes próprios identificados; `delegacoesAcesso.service.ts` sem teste dedicado `[CONFIRMED: ausência]`.

## Evidências

- E1 — `src/react-app/components/login-as/*.tsx` `[CONFIRMED: code]`
- E2 — Consumidores: `Layout.tsx`, `Perfil.tsx` `[CONFIRMED: code]`
- E3 — Fluxo backend: `edge-function-delegar-acesso.md` `[CONFIRMED: code]`

## Veja também

- [perfil](../pages/perfil.md), [layout.md](layout.md), [security-model](../../security/security-model.md)
