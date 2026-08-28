# Página Admin

**Última verificação:** 2026-08-27 (ENH-0003 — refinamentos de layout do histórico)
**Rota:** `/admin` — `src/react-app/App.tsx:27`

## Propósito

Painel administrativo: visão de usuários (totais), uso do banco de dados (estatísticas do Supabase) e monitoramento de background jobs com filtros, paginação e painel de detalhes. Página 100% leitura — sem forms ou mutações; modal de leitura de mensagem no histórico.

## Acesso

- Gate duplo na UI: `loading` → `LayoutSkeleton` + `AdminSkeleton`; `!perfilUsuario || perfilUsuario.role !== "admin"` → box "Acesso Negado" (`AlertCircle`, "Você não tem permissão para acessar o painel administrativo.") `[CONFIRMED: code — Admin.tsx:84,164-192]`.
- `isDelegado` NÃO é usado `[CONFIRMED: code]`. Enforcement real: banco (ver [security-model](../../security/security-model.md)) `[CONFIRMED: security-model]`.

## Estado e dados

- `useAuth()` → `{ authUser }`; `useAdmin(authUser?.id)` → `{ perfilUsuario, usuarios, estatisticasDB, loading }` (expõe também `error`, `reload`, `toggleRole` — NÃO usados na página) `[CONFIRMED: code — Admin.tsx:81-82, useAdmin.ts]`.
- `useBackgroundJobsAdmin(authUser?.id, isAdmin)` → `{ overview, executions, total, page, pageSize, totalPages, loading, error, filters, setFilters, setPage, setPageSize, reload }` (paginação server-side via `getBackgroundJobExecutions` com `.range` + `count: "exact"`; `pageSize` gerenciável, default 3; reset para página 1 ao trocar filtro ou page size) `[CONFIRMED: code]`.
- Estado local: `selectedExecutionId: string | null` (detalhes) e `mensagemExecucao: BackgroundJobExecutionDTO | null` (modal de mensagem); `useEffect` mantém seleção válida (zera se lista vazia; senão default `executions[0].id`) `[CONFIRMED: code — Admin.tsx:86-88,123-132]`.
- Services por trás: `admin.service` (`getPerfilAdmin`, `getUsuariosAdmin`, `getEstatisticasAdmin` — via RPC `get_estatisticas_admin`) e `background-jobs.service` (+ defaults de período/página/limite) `[CONFIRMED: code]`.

## UI (seções em ordem)

1. **Header:** "Painel Administrativo" + subtítulo "Gerenciar usuários, sistema e monitoramento" + pill "Ambiente atual: {CURRENT_APP_ENVIRONMENT}" com dot `bg-emerald-500` `[CONFIRMED: code]`.
2. **3 stat cards de usuários:** "Total de Usuários" (`Users` azul), "Administradores" (`Shield` roxo), "Usuários Comuns" (`Users` verde, = total − admins) — valores `text-3xl font-bold` `[CONFIRMED: code]`.
3. **"Uso do Banco de Dados"** (condicional a `estatisticasDB`):
   - "Armazenamento": `{estimado_mb.toFixed(2)} MB de {limite_gratuito_mb} MB`, percentual `toFixed(1)`%, barra `h-3` com cor condicional (`bg-red-500` se > 80%, `bg-yellow-500` se > 60%, senão `bg-green-500`), largura `min(percentual, 100)%` `[CONFIRMED: code]`.
   - "Registros Totais" (`FileText` ciano): `{registros.toLocaleString("pt-BR")}`.
   - "Referências de Alimentos" (`Package` teal): total + linhas "Globais: {N}" / "Personalizadas: {N}".
   - Box "Limites do Plano Gratuito (Supabase)": lista fixa "• Banco de dados: 500 MB", "• Storage de arquivos: 1 GB", "• Autenticação: até ~50.000 usuários ativos/mês" + nota sobre limites variáveis `[CONFIRMED: code — Admin.tsx:302-320]`.
4. **"Monitoramento de Jobs"** — `section` com descrição "Acompanhe o keepalive e outras execuções do ambiente atual com histórico e filtros." + botão "Atualizar" (`RefreshCw` com `animate-spin` quando loading):
   - **Cards:** "Saúde geral" (card escuro `bg-slate-900 text-white`; labels "Sem dados"/"Saudável"/"Falha recente"/"Atenção"), "Keepalive atual" (título "Operando normalmente"/"Atenção necessária"/"Sem dados"; detalhes Última execução/Duração/Total/Ambiente; fallback "Nenhum registro encontrado para este job no período selecionado."), "Resumo das execuções" (Total/Sucesso `emerald`/Falha `red`/Parcial `amber`) `[CONFIRMED: code — Admin.tsx:347-381,672-740]`.
   - **Filtros** (`SelectField` com `<label>` + `<select>` nativo): "Job" (keepalive/Todos), "Status" (Todos/Sucesso/Falha/Parcial), "Período" (7/30/90 dias); mudança reseta página 1 `[CONFIRMED: code]`.
   - **Histórico das execuções:** cabeçalho `border-b` com título "Histórico das execuções" + contador dinâmico de resultados — "1 execução encontrada." para 1, "{total} execuções encontradas." para 0/2+; **tabela desktop** (`hidden md:block`) com colunas Execução | Job | Status | Duração | Mensagem — SEM ordenação; linha clicável seleciona detalhes (`bg-indigo-50/60`); coluna "Mensagem" exibe botão sutil "Ver mensagem" (`MessageSquare` + texto `text-xs text-indigo-600`; `stopPropagation` no clique para não selecionar a linha) que abre o `ModalMensagemExecucao` `[CONFIRMED: code — Admin.tsx:494-505]`; badges de status `bg-emerald-100`/`bg-red-100`/`bg-amber-100`; **cards mobile** (`md:hidden`) sem mensagem inline (mensagem disponível no painel de detalhes e no modal) `[CONFIRMED: code — Admin.tsx:512-536]`; **rodapé de paginação** (`border-t`) abaixo da lista: linha única em 3 zonas (`sm:grid-cols-3`, empilha em mobile) — "Página {page} de {totalPages}" à esquerda; botões Anterior/Próxima centralizados (`ChevronLeft/Right`, disabled nas bordas, disabled durante `loading`); seletor "Item por página" (3 / 10 / 20, default 3) à direita; **painel de detalhes** `dl grid sm:grid-cols-2`: Ambiente atual, Run ID (`font-mono break-all`), Início, Fim, Duração, Criado em + bloco "Mensagem" + "Metadata" em `<pre>` (`bg-gray-950 text-gray-100`, `JSON.stringify(details, null, 2)`, `max-h-80 overflow-auto`) `[CONFIRMED: code — Admin.tsx:429-433,457-510,538-581,583-624,629-634]`. Seletor de tamanho de página e modal de mensagem implementados via ENH-0003 (2026-08-26/27); paginação numerada removida por decisão do usuário (2026-08-27) — `DEFAULT_PAGE_SIZE = 3`.
   - Formatos: datas `formatInTimeZone(..., "America/Sao_Paulo", "dd/MM/yyyy 'às' HH:mm")`, nulo → "—"; duração: <1000ms → "X ms", <10000ms → 1 decimal "s", senão inteiro "s"; contador de execuções com plural dinâmico (`executionCountLabel`) `[CONFIRMED: code — Admin.tsx:33-47]`.

## Estados de UI

- **Loading:** skeleton de página inteira; `jobs.loading` → só spinner no botão Atualizar + paginação disabled (lista anterior permanece) `[CONFIRMED: code]`.
- **Empty (jobs):** `Activity` cinza + "Nenhuma execução encontrada" + "Ajuste os filtros ou aguarde novas execuções dos jobs em background." (sem rodapé de paginação) `[CONFIRMED: code — Admin.tsx:447-454]`.
- **Error (jobs):** box vermelho com `AlertTriangle` + "Erro ao carregar jobs" + `jobs.error.message` `[CONFIRMED: code — Admin.tsx:435-445]`.
- **Error (`useAdmin`):** destruturado mas NUNCA renderizado (sem UI de erro para perfil/usuários/estatísticas) `[CONFIRMED: code × ausência]`.
- **Unauthorized:** "Acesso Negado" (acima) `[CONFIRMED: code]`.
- **Confirmations/alert:** NENHUM `[CONFIRMED: ausência]`.

## Responsividade

Stats `grid-cols-1 sm:grid-cols-2 md:grid-cols-3`; DB `md:grid-cols-2`; jobs header `lg:flex-row`; summary `md:grid-cols-2 xl:grid-cols-3`; tabela × cards (`hidden md:block`/`md:hidden`); detalhes `lg:grid-cols-2` `[CONFIRMED: code]`.

## Acessibilidade

Semântica `dl/dt/dd`, `table`, `section`, h1–h5, `<label>`+`<select>`; único `aria-*` da página: `aria-label="Fechar"` no botão de fechar do `ModalMensagemExecucao`; SEM `role=`, tooltip `title` ou teclado customizado `[CONFIRMED: code]`.

## Navegação e side effects

Sem `navigate`/router; sem chamadas diretas ao supabase (tudo via hooks/services) `[CONFIRMED: code]`.

## Testes

`Admin.test.tsx` (primeiro teste de página do projeto; demais páginas testadas: Perfil, Referencias, Dashboard), `useAdmin.test.ts`, `useBackgroundJobsAdmin.test.tsx`, `admin.service.test.ts`, `background-jobs.service.test.ts` `[CONFIRMED: test]`.

## Evidências

- E1 — `src/react-app/pages/Admin.tsx` completo `[CONFIRMED: code]`
- E2 — Extração estruturada por agente (2026-08-13) validada contra o código `[CONFIRMED: code]`
- E3 — `useAdmin.ts`, `useBackgroundJobsAdmin.ts`, `admin.service.ts`, `background-jobs.service.ts` `[CONFIRMED: code]`

## Veja também

- [background-jobs](../../backend/background-jobs.md), [background_job_executions](../../database/background_job_executions.md), [rpc.md](../../database/rpc.md)
- [modal-mensagem-execucao.md](../components/modal-mensagem-execucao.md) (modal de mensagem do histórico)
- [referencias.md](referencias.md) (gestão de referências do usuário)
