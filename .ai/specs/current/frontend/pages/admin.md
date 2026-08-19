# Página Admin

**Última verificação:** 2026-08-13 (commit 6323664)
**Rota:** `/admin` — `src/react-app/App.tsx:27`

## Propósito

Painel administrativo: visão de usuários (totais), uso do banco de dados (estatísticas do Supabase) e monitoramento de background jobs com filtros, paginação e painel de detalhes. Página 100% leitura — sem forms, modais ou mutações.

## Acesso

- Gate duplo na UI: `loading` → `LayoutSkeleton` + `AdminSkeleton`; `!perfilUsuario || perfilUsuario.role !== "admin"` → box "Acesso Negado" (`AlertCircle`, "Você não tem permissão para acessar o painel administrativo.") `[CONFIRMED: code — Admin.tsx:78,149-175]`.
- `isDelegado` NÃO é usado `[CONFIRMED: code]`. Enforcement real: banco (ver [security-model](../../security/security-model.md)) `[CONFIRMED: security-model]`.

## Estado e dados

- `useAuth()` → `{ authUser }`; `useAdmin(authUser?.id)` → `{ perfilUsuario, usuarios, estatisticasDB, loading }` (expõe também `error`, `reload`, `toggleRole` — NÃO usados na página) `[CONFIRMED: code — Admin.tsx:75-76, useAdmin.ts]`.
- `useBackgroundJobsAdmin(authUser?.id, isAdmin)` → `{ overview, executions, total, page, totalPages, loading, error, filters, setFilters, setPage, reload }` `[CONFIRMED: code]`.
- Estado local: `selectedExecutionId: string | null` (detalhes); `useEffect` mantém seleção válida (zera se lista vazia; senão default `executions[0].id`) `[CONFIRMED: code — Admin.tsx:80,117-126]`.
- Services por trás: `admin.service` (`getPerfilAdmin`, `getUsuariosAdmin`, `getEstatisticasAdmin` — via RPC `get_estatisticas_admin`) e `background-jobs.service` (+ defaults de período/página/limite) `[CONFIRMED: code]`.

## UI (seções em ordem)

1. **Header:** "Painel Administrativo" + subtítulo "Gerenciar usuários, sistema e monitoramento" + pill "Ambiente atual: {CURRENT_APP_ENVIRONMENT}" com dot `bg-emerald-500` `[CONFIRMED: code]`.
2. **3 stat cards de usuários:** "Total de Usuários" (`Users` azul), "Administradores" (`Shield` roxo), "Usuários Comuns" (`Users` verde, = total − admins) — valores `text-3xl font-bold` `[CONFIRMED: code]`.
3. **"Uso do Banco de Dados"** (condicional a `estatisticasDB`):
   - "Armazenamento": `{estimado_mb.toFixed(2)} MB de {limite_gratuito_mb} MB`, percentual `toFixed(1)`%, barra `h-3` com cor condicional (`bg-red-500` se > 80%, `bg-yellow-500` se > 60%, senão `bg-green-500`), largura `min(percentual, 100)%` `[CONFIRMED: code]`.
   - "Registros Totais" (`FileText` ciano): `{registros.toLocaleString("pt-BR")}`.
   - "Referências de Alimentos" (`Package` teal): total + linhas "Globais: {N}" / "Personalizadas: {N}".
   - Box "Limites do Plano Gratuito (Supabase)": lista fixa "• Banco de dados: 500 MB", "• Storage de arquivos: 1 GB", "• Autenticação: até ~50.000 usuários ativos/mês" + nota sobre limites variáveis `[CONFIRMED: code — Admin.tsx:296-314]`.
4. **"Monitoramento de Jobs"** — `section` com descrição "Acompanhe o keepalive e outras execuções do ambiente atual com histórico e filtros." + botão "Atualizar" (`RefreshCw` com `animate-spin` quando loading):
   - **Cards:** "Saúde geral" (card escuro `bg-slate-900 text-white`; labels "Sem dados"/"Saudável"/"Falha recente"/"Atenção"), "Keepalive atual" (título "Operando normalmente"/"Atenção necessária"/"Sem dados"; detalhes Última execução/Duração/Total/Ambiente; fallback "Nenhum registro encontrado para este job no período selecionado."), "Resumo das execuções" (Total/Sucesso `emerald`/Falha `red`/Parcial `amber`) `[CONFIRMED: code — Admin.tsx:341-375,618-686]`.
   - **Filtros** (`SelectField` com `<label>` + `<select>` nativo): "Job" (keepalive/Todos), "Status" (Todos/Sucesso/Falha/Parcial), "Período" (7/30/90 dias); mudança reseta página 1 `[CONFIRMED: code]`.
   - **Histórico das execuções:** cabeçalho "{total} execução(ões) encontradas. Página {page} de {totalPages}."; **tabela desktop** (`hidden md:block`) com colunas Execução | Job | Status | Duração | Mensagem — SEM ordenação; linha clicável seleciona detalhes (`bg-indigo-50/60`); badges de status `bg-emerald-100`/`bg-red-100`/`bg-amber-100`; **cards mobile** (`md:hidden`); **paginação** botões Anterior/Próxima (`ChevronLeft/Right`, disabled nas bordas); **painel de detalhes** `dl grid sm:grid-cols-2`: Ambiente atual, Run ID (`font-mono break-all`), Início, Fim, Duração, Criado em + bloco "Mensagem" + "Metadata" em `<pre>` (`bg-gray-950 text-gray-100`, `JSON.stringify(details, null, 2)`, `max-h-80 overflow-auto`) `[CONFIRMED: code — Admin.tsx:422-590,717-734]`.
   - Formatos: datas `formatInTimeZone(..., "America/Sao_Paulo", "dd/MM/yyyy 'às' HH:mm")`, nulo → "—"; duração: <1000ms → "X ms", <10000ms → 1 decimal "s", senão inteiro "s" `[CONFIRMED: code — Admin.tsx:29-41]`.

## Estados de UI

- **Loading:** skeleton de página inteira; `jobs.loading` → só spinner no botão Atualizar + paginação disabled (lista anterior permanece) `[CONFIRMED: code]`.
- **Empty (jobs):** `Activity` cinza + "Nenhuma execução encontrada" + "Ajuste os filtros ou aguarde novas execuções dos jobs em background." `[CONFIRMED: code — Admin.tsx:464-471]`.
- **Error (jobs):** box vermelho com `AlertTriangle` + "Erro ao carregar jobs" + `jobs.error.message` `[CONFIRMED: code — Admin.tsx:452-462]`.
- **Error (`useAdmin`):** destruturado mas NUNCA renderizado (sem UI de erro para perfil/usuários/estatísticas) `[CONFIRMED: code × ausência]`.
- **Unauthorized:** "Acesso Negado" (acima) `[CONFIRMED: code]`.
- **Confirmations/alert:** NENHUM `[CONFIRMED: ausência]`.

## Responsividade

Stats `grid-cols-1 sm:grid-cols-2 md:grid-cols-3`; DB `md:grid-cols-2`; jobs header `lg:flex-row`; summary `md:grid-cols-2 xl:grid-cols-3`; tabela × cards (`hidden md:block`/`md:hidden`); detalhes `lg:grid-cols-2` `[CONFIRMED: code]`.

## Acessibilidade

Semântica `dl/dt/dd`, `table`, `section`, h1–h5, `<label>`+`<select>`; SEM nenhum `aria-*`, `role=`, tooltip `title` ou teclado customizado `[CONFIRMED: ausência — grep 2026-08-13]`.

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
- [referencias.md](referencias.md) (gestão de referências do usuário)
