# Página Referências

**Última verificação:** 2026-09-04 (ENH-0004 — marca separada, identidade imutável de globais, remoção com textos distintos)
**Rota:** `/referencias` — `src/react-app/App.tsx:19`

## Propósito

Gestão das referências alimentares: busca (nome OU marca), filtros (inativas/favoritas/customizadas), ordenação, paginação client-side, favoritar, criar/editar/remover (ou desativar) referências, com regras de permissão espelhadas na UI. Desde a ENH-0004: nome e marca separados (apresentação combinada dinâmica), edição de global = arquivar + criar (identidade imutável), remoção de global = arquivamento.

## Acesso

- Skeleton se `!ready`; opera sobre `usuarioAtivoId`; `isAdmin` vem de `useLayoutPerfil(authUser?.id)` (não do useAdmin) `[CONFIRMED: code — Referencias.tsx:13-17]`.
- `isDelegado` NÃO é usado nesta página `[CONFIRMED: code — extração 2026-08-13]`.

## Estado e dados

- `useUsuarioAtivo()` → `usuarioAtivoId`; `useReferencias(usuarioAtivoId)` → `{ referencias, loading, error, search, create, update, activate, deactivate, remove, ordenarPor, setOrdenarPor, toggleFavoritoReferencia, searchTerm }` `[CONFIRMED: code]`.
- Estado local: `showModal`, `editingReferencia` (null = criar; preenchido com a referência PESSOAL a editar), `prefillCopia` (cópia da referência GLOBAL cuja criação substituirá a original — `{nome, marca, fenil_mg_por_100g, arquivarOrigemId}`), `submitting`, `showInativas`, `onlyFavoritas`, `onlyCustomizadas` (espelham o estado interno do hook), `currentPage = 1`, `itemsPerPage = 20` `[CONFIRMED: code — Referencias.tsx:46-52,60-94]`.
- Busca com debounce de 300ms no hook; filtros/ordenação aplicados no SERVIDOR via `getReferencias`; a busca consulta nome OU marca (`referencias.service` — `.or(nome.ilike,marca.ilike)`) — o placeholder do input cita apenas "Digite o nome do alimento..." `[CONFIRMED: code — Referencias.tsx:256; useReferencias.ts:182-194]`.

## UI

1. **Header:** título + subtítulo "Valores de fenilalanina por 100g" + botão "+ Nova Referência" (gradiente).
2. **Card Filtros:** input "Buscar alimento" (`title` "Limpar busca" no X) + 3 checkboxes com `accent-*`: "Mostrar referências inativas" (`accent-indigo-600`), "Somente favoritas" (`accent-yellow-500`), "Somente customizadas" (`accent-purple-600`) `[CONFIRMED: code]`.
3. **Lista de Referências** — desktop `hidden md:block` tabela com colunas **Fav | Nome | Fenilalanina (mg/100g) | Tipo | Ações**:
   - **Ordenação** por Nome e Fenilalanina (headers clicáveis, `ArrowUp`/`ArrowDown`/`ArrowUpDown`); campo "tipo" na assinatura de `toggleSort` mas SEM header clicável; default `"nome"` `[CONFIRMED: code — Referencias.tsx:443-477]`.
   - **Ações por linha:** star favorito (`text-yellow-400 fill-yellow-400` ativo; `disabled` se inativa), `Edit2` (indigo), `Trash2` (vermelho), `RotateCcw` (verde — só se `!is_ativa && podeEditarOuRemover(r)`); edit/delete `disabled` (`text-gray-300 cursor-not-allowed`) quando `bloqueado = !podeEditarOuRemover(r) || !r.is_ativa` `[CONFIRMED: code]`.
   - **Células:** nome apresentado via `nomeComMarca(nome, marca)` — "Nome (Marca: X)" quando há marca, só o nome quando é `Produto In Natura` (desktop linha 404; mobile 545); com `line-through text-gray-400` se inativa; valor `toFixed(1)` em `text-indigo-600` (sem sufixo "mg" no desktop; mobile com " mg"); badge Tipo "Global" `bg-blue-100 text-blue-700` / "Customizada" `bg-purple-100 text-purple-700` `[CONFIRMED: code]`.
   - **Mobile** `md:hidden`: cards por referência com star, nome combinado (nomeComMarca) (+ "(Inativa)" `text-red-600`), badge `Globe`/`User` com `title` ("Referência global (disponível para todos os usuários)" / "Referência criada pelo usuário"), valor e mesmas ações `[CONFIRMED: code]`.
4. **Paginação client-side:** select "Itens por página:" (10/20/50/100); "Total: {N} registros"; botões SVG inline com `title` "Primeira página"/"Página anterior"/"Próxima página"/"Última página" (`disabled:opacity-40`); indicador `<strong>{pagina}</strong> / {totalPages}`; `useEffect` reseta página para 1 quando a lista muda `[CONFIRMED: code — Referencias.tsx:572-645,150-162]`.
5. **Modal `ModalReferencia`** para criar/editar (spec própria) `[CONFIRMED: code]`.

## Estados de UI

- **Loading inicial:** `LayoutSkeleton` + `ReferenciasSkeleton` `[CONFIRMED: code]`.
- **Loading de dados:** overlay `absolute inset-0 bg-white/60 backdrop-blur-[2px]` com spinner sobre o card da lista (lista anterior visível) `[CONFIRMED: code — Referencias.tsx:311-315]`.
- **Empty:** `Star` cinza + "Nenhuma referência cadastrada ainda" + botão "Criar primeira referência" `[CONFIRMED: code]`.
- **Error:** box vermelho estático "Erro ao carregar referências" (`error.message` NÃO exibido; o mesmo box aparece para erros de create/favorito) `[CONFIRMED: code — Referencias.tsx:301-307]`.
- **Submitting:** modal com "Salvando..." e `disabled` `[CONFIRMED: code]`.

## Autorização / Visibilidade (UI)

- `podeEditarOuRemover(ref)`: `ref.criado_por === usuarioAtivoId` OU (`isAdmin && ref.is_global`) — guarda também exige `ref.is_ativa` nos handlers `[CONFIRMED: code — Referencias.tsx:54-58]`.
- A função `motivoBloqueio(r)` (textos "Referência inativa", "Apenas administradores podem editar referências globais", etc.), que existia sem uso no JSX, foi ELIMINADA na ENH-0004 — botões desabilitados via `disabled` sem tooltip de motivo `[CONFIRMED: code — ausência de motivoBloqueio em Referencias.tsx, 2026-09-04]`.
- Enforcement real: banco (ver [security-model](../../security/security-model.md)) `[CONFIRMED: security-model]`.

## Fluxos de interação (com textos exatos)

- **Editar (global) — arquivar + criar (ENH-0004, BR-034):** `confirm('Referências globais são imutáveis.\n\nPara ajustar "<nomeComMarca>", a referência atual será arquivada e uma nova será criada com os dados alterados.\n\nContinuar?')` → abre o modal em modo criar com `prefillCopia` `{nome, marca, fenil_mg_por_100g, arquivarOrigemId}` → no submit (modo criar), `create()` e depois `deactivate(arquivarOrigemId)` → alert "Nova referência criada com sucesso.\n\nA referência original foi arquivada (desativada) e não poderá ser usada em novos registros." `[CONFIRMED: code — Referencias.tsx:66-94,152-158]`.
- **Editar (pessoal):** modal em modo edição (`editingReferencia`) → `update(id, nome, marca, fenil)` → alert "Referência atualizada com sucesso." `[CONFIRMED: code — Referencias.tsx:140-148]`.
- **Remover:** global → `confirm('Arquivar a referência global "<nomeComMarca>"?\n\nReferências globais nunca são excluídas — ela será apenas desativada.')`; pessoal → `confirm('Remover a referência "<nomeComMarca>"?\n\n⚠️ Se houver registros associados, ela será apenas desativada.')` → `remove()` (chama o RPC e trata o retorno; NÃO há fallback de erro FK 23503 desde a ENH-0004) → se `'deactivated'`: global → alert "Referência global arquivada (desativada).\n\nEla não poderá ser usada em novos registros."; pessoal → alert "Esta referência possui registros associados.\n\nEla foi DESATIVADA e não poderá ser usada em novos registros."; se `'deleted'` → alert "Referência removida com sucesso."; erro → "Erro ao remover referência." `[CONFIRMED: code — Referencias.tsx:96-127]`.
- **Reativar:** `confirm('Reativar a referência "<nomeComMarca>"?')` → `activate()` `[CONFIRMED: code — Referencias.tsx:464,594]`.
- **Criar/editar (submit):** valida `Number.isNaN(fenil)` → alert "Informe um valor numérico válido para fenilalanina."; sem permissão na edição → alert "Você não tem permissão para editar esta referência."; duplicada (`code REFERENCIA_DUPLICADA`) → "Já existe uma referência ativa com esse nome e marca." (modal permanece aberto); imutabilidade (`code REFERENCIA_GLOBAL_IMUTAVEL`, guarda do service) → "Referências globais não podem ser editadas."; sucesso → "Referência criada com sucesso." / "Referência atualizada com sucesso."; outro erro → "Erro ao salvar referência." `[CONFIRMED: code — Referencias.tsx:129-186]`.
- **Favoritar:** `toggleFavoritoReferencia` — reordena a lista client-side (favoritos primeiro) com rollback em erro `[CONFIRMED: code — useReferencias.ts:133-168]`.

## Responsividade

Conforme [overview.md](../overview.md) (tabela × cards mobile; modal bottom-sheet × central) `[CONFIRMED: code]`.

## Acessibilidade

Labels visíveis, `title` em ícones, `disabled` com feedback; SEM `aria-*`, sem focus trap, sem ESC/overlay para fechar modal `[CONFIRMED: code × ausência]`.

## Testes

`useReferencias.test.ts`, `referencias.service.test.ts`. Página: `Referencias.test.tsx` (25 testes — loading/empty/error, filtros, busca, ordenação, paginação, criar/editar, remover/desativar/reativar, permissões) `[CONFIRMED: test]`.

## Evidências

- E1 — `src/react-app/pages/Referencias.tsx` completo `[CONFIRMED: code]`
- E2 — `useReferencias.ts`, `referencias.service.ts` `[CONFIRMED: code]`
- E3 — Extração estruturada por agente (2026-08-13) validada contra o código `[CONFIRMED: code]`

## Veja também

- [modal-referencia.md](../components/modal-referencia.md), [../database/referencias.md](../../database/referencias.md), [../database/rpc.md](../../database/rpc.md)
- [admin.md](admin.md) (visão admin do mesmo domínio)
