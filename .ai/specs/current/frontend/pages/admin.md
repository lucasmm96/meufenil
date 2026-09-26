# Página Admin

**Última verificação:** 2026-09-25 (ENH-0009: curadoria/pendências/rollback seletivo removidos — 3 abas, sem decidirPendencia/reverterSync; ENH-0010: JsonCodeBlock nos detalhes técnicos; antes: 2026-09-14)
**Rota:** `/admin` — `src/react-app/App.tsx:27`

## Propósito

Painel administrativo: visão de usuários (totais), uso do banco de dados (estatísticas do Supabase), monitoramento de background jobs com filtros, paginação e painel de detalhes e sincronização de referências ANVISA (FEAT-0017 M6 — histórico, auditoria e recuperação). Página 100% leitura EXCETO a seção de sincronização, que é o único ponto de mutação (execução manual e restauração excepcional — ENH-0009 removeu curadoria/pendências e rollback seletivo); fora dela permanece sem forms (modal de leitura de mensagem no histórico).

## Acesso

- Gate duplo na UI: `loading` → `LayoutSkeleton` + `AdminSkeleton`; `!perfilUsuario || perfilUsuario.role !== "admin"` → box "Acesso Negado" (`AlertCircle`, "Você não tem permissão para acessar o painel administrativo.") `[CONFIRMED: code — Admin.tsx:84,164-192]`.
- `isDelegado` NÃO é usado `[CONFIRMED: code]`. Enforcement real: banco (ver [security-model](../../security/security-model.md)) `[CONFIRMED: security-model]`.

## Estado e dados

- `useAuth()` → `{ authUser }`; `useAdmin(authUser?.id)` → `{ perfilUsuario, usuarios, estatisticasDB, loading }` (expõe também `error`, `reload`, `toggleRole` — NÃO usados na página) `[CONFIRMED: code — Admin.tsx:81-82, useAdmin.ts]`.
- `useBackgroundJobsAdmin(authUser?.id, isAdmin)` → `{ overview, executions, total, page, pageSize, totalPages, loading, error, filters, setFilters, setPage, setPageSize, reload }` (paginação server-side via `getBackgroundJobExecutions` com `.range` + `count: "exact"`; `pageSize` gerenciável, default 3; reset para página 1 ao trocar filtro ou page size) `[CONFIRMED: code]`.
- `useReferenciasSyncAdmin(authUser?.id, isAdmin)` (FEAT-0017 M6) → domínios paginados `syncs`/`eventos` (`{ items, total, page, pageSize, totalPages, loading, error }` com filtros `syncsStatus`/`eventosTipo`/`eventosSyncId`/`eventosTermo` + setters que resetam trilha/página), lista `backups`, estado do ambiente `matchingValidado`/`syncRunning`/`executandoSync`/`recuperacaoLoading`, permissão `podeRecuperar` e ações `reload`, `resetaTrilhas`, `restaurarBackup`, `executarSync` (mutações recarregam os domínios; sem ação quando `isAdmin` falso; ENH-0009: removidos `pendencias`/`syncsRevertiveis`/`decidirPendencia`/`reverterSync`) `[CONFIRMED: code — Admin.tsx + hooks/useReferenciasSyncAdmin.ts]`.
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

5. **"Sincronização de Referências"** (FEAT-0017 M6 — `SecaoSincronizacaoReferencias`, seção empilhada AO FINAL da página, após "Monitoramento de Jobs"; componentes top-level inline da página, dados do hook via prop `data` `[CONFIRMED: code — Admin.tsx:652,1053-1138]`):
   - **Cabeçalho:** subtítulo "Histórico das sincronizações com a tabela oficial de fenilalanina (ANVISA) e recuperação excepcional." (ENH-0009 removeu "curadoria das divergências") + **pill de matching**: ternário `recuperacaoLoading && matchingValidado === null` → "Verificando estado..." (cinza); `matchingValidado` → "Matching validado" (esmeralda); senão → "Aguardando sync inicial" (âmbar); dot da mesma cor `[CONFIRMED: code — Admin.tsx:1080-1103]`.
   - **Execução manual (revisão R4-1, decisão 2026-09-08):** `BotaoExecutarSync` renderizado **sempre** para admin — em dev E prod (antes: SÓ quando `CURRENT_APP_ENVIRONMENT === "prod"`, com nota "Execução manual disponível apenas no ambiente de produção." em dev — removida); `confirm()` antes; botão "Executar sync agora" (`Play`; disabled + "Executando..." com `animate-spin` quando `executandoSync`); resultado inline abaixo (esmeralda/vermelho): "Sincronização iniciada ({status}). ID: {id curto}". A rota grava a sync no environment do deployment (`ambienteAlvo()` — prod ou dev) `[CONFIRMED: code — Admin.tsx:1054,1105,1140-1180]`.
   - **3 sub-abas** com estado local `aba` (Histórico | Auditoria | Recuperação — ENH-0009 removeu "Pendências de curadoria"; a aba Recuperação não é renderizada quando `!podeRecuperar && !recuperacaoLoading`); sem rota própria, troca por clique `[CONFIRMED: code — Admin.tsx]`.
   - **Pontes entre abas:** `TrilhaSyncChip` (pill indigo "Trilha da sincronização {id curto}" + link "ver no histórico" + X com `aria-label="Limpar trilha da sincronização"`) na Auditoria volta ao Histórico sem limpar o filtro do domínio irmão; ENH-0009 removeu a ponte divergências→pendências (botão "N divergências") `[CONFIRMED: code — Admin.tsx]`.
   - **Histórico** (`AbaHistoricoSync`): filtro Status (Todos + 6 status em `SelectField`); erro → `BlocoErroSecao` ("Erro ao carregar o histórico"); vazio → "Nenhuma sincronização encontrada" + "O cron semanal ainda não executou ou o filtro não encontrou resultados."; tabela desktop (`hidden md:block`) colunas Sync | Início | Status | Origem (Cron/Manual) | Totais (N origem + eq/criadas/arquivadas/deletadas — ENH-0009) | Mensagem; ENH-0009 removeu colunas Bootstrap e Divergências; cards mobile (`md:hidden`) com os mesmos campos; rodapé `PaginacaoSync` (seletor de item por página com id único `page-size-syncs`) `[CONFIRMED: code — Admin.tsx:1189-1358]`.
   - **Detalhe do Histórico:** seleção default = primeira linha (`useEffect` zera `syncSelecionadaId` se a selecionada sai da lista; linha/card ativos `bg-indigo-50/60`/`border-indigo-400`); painel `border-t` com grid `lg:grid-cols-2`: (a) "Detalhes da sincronização" — `DetailItem`s (Ambiente, Origem com "Cron (semanal)", Início/Fim, Duração via `tempoExecucaoSync`, Origem (linhas), Equivalentes, Criadas, Arquivadas, **Deletadas** — ENH-0009, Sync ID completo `mono`; ENH-0009 removeu Bootstrap/Divergências) + bloco Mensagem; (b) "Detalhes técnicos (estágios)" via `JsonCodeBlock` (`selecionada.details` — exibe JSON com estágios 1–8; ENH-0010: inclui estágio `audit` com `alteracoes: [{ tipo, referencia_id, identidade }]` quando `arquivadas > 0 || deletadas > 0`) `[CONFIRMED: code — Admin.tsx:1358-1381]`.
   - ~~**Pendências de curadoria**~~ — **ELIMINADA (ENH-0009)**: `AbaPendenciasSync`, `ModalDecisaoPendencia`, `ModalDecisaoBulkRejeitar` e toda a lógica de curadoria/decisão de pendências foram removidos. Não existe mais a aba "Pendências de curadoria" nem os modais de aprovação/rejeição individual ou em lote `[CONFIRMED: code — Admin.tsx; migration 20260923000000]`.
   - **Auditoria** (`AbaAuditoriaSync`): filtros em box "Filtros": Tipo de evento (`SelectField` com Todos + 14 tipos em `EVENTO_TIPO_LABELS`) e busca por nome (`form` com input "Referência (nome)" + botão "Buscar" que só aplica no submit via `setEventosTermo`); com termo ativo, linha "Filtrando por "{termo}"" + link "limpar busca"; cards `EventoCardSync` (badge cinza com label do tipo + data + referência `nomeComMarcaSync` + botão "Sync {id} · trilha" quando `sync_id` + "admin {id}" quando `actor_id` + "pendência {id}" quando houver; `<pre>` escuro com `detalhes` quando não-vazio); vazio → "Nenhum evento encontrado"; rodapé `PaginacaoSync` (`page-size-eventos`) `[CONFIRMED: code — Admin.tsx:1818-1968]`.
   - **Recuperação** (`AbaRecuperacaoSync`, renderizada só com permissão; sem ela a aba não existe): sem `podeRecuperar` → bloco "Recuperação indisponível"; **Restauração excepcional por backup** (`ArchiveRestore`) — lista de backups (data, "N linhas", "sha {12}") com botão "Restaurar backup"; erros em `BlocoErroSecao`; **confirmação forte**: `confirm()` + `prompt()` com a palavra obrigatória "RESTAURAR"; RPC destrutiva só roda com a palavra exata; resultado inline em caixa `border-l-4` (esmeralda: "Backup restaurado: X reativadas, ..."; vermelho: mensagem de erro). ENH-0009 removeu **(a) Rollback seletivo** (`reverter_sync_referencias`/botão "Reverter sync"/lista `syncsRevertiveis`) — apenas restauração permanece `[CONFIRMED: code — Admin.tsx; test — Admin.test.tsx; migration 20260923000000]`.

## Estados de UI

- **Loading:** skeleton de página inteira; `jobs.loading` → só spinner no botão Atualizar + paginação disabled (lista anterior permanece) `[CONFIRMED: code]`; seção de sincronização sem skeleton próprio (domínios com paginação e `loading` próprio; pill "Verificando estado..." durante o primeiro carregamento do matching) `[CONFIRMED: code]`.
- **Empty (jobs):** `Activity` cinza + "Nenhuma execução encontrada" + "Ajuste os filtros ou aguarde novas execuções dos jobs em background." (sem rodapé de paginação) `[CONFIRMED: code — Admin.tsx:447-454]`.
- **Error (jobs):** box vermelho com `AlertTriangle` + "Erro ao carregar jobs" + `jobs.error.message` `[CONFIRMED: code — Admin.tsx:435-445]`.
- **Error (seção de sincronização):** `BlocoErroSecao` por domínio ("Erro ao carregar o histórico/a auditoria/os backups" — ENH-0009 removeu "as pendências" e "as sincronizações revertíveis"); falha de mutação → resultado inline vermelho (recuperação) `[CONFIRMED: code]`.
- **Error (`useAdmin`):** destruturado mas NUNCA renderizado (sem UI de erro para perfil/usuários/estatísticas) `[CONFIRMED: code × ausência]`.
- **Unauthorized:** "Acesso Negado" (acima) `[CONFIRMED: code]`.
- **Confirmations/alert:** NENHUM fora da seção de sincronização; nesta: `confirm()` + `prompt()` com palavra obrigatória "RESTAURAR" antes da restauração por backup e `confirm()` antes da execução manual; ENH-0009 removeu confirmação "REVERTER" `[CONFIRMED: code — Admin.tsx; test — Admin.test.tsx]`.

## Responsividade

Stats `grid-cols-1 sm:grid-cols-2 md:grid-cols-3`; DB `md:grid-cols-2`; jobs header `lg:flex-row`; summary `md:grid-cols-2 xl:grid-cols-3`; tabela × cards (`hidden md:block`/`md:hidden`); detalhes `lg:grid-cols-2` `[CONFIRMED: code]`.

## Acessibilidade

Semântica `dl/dt/dd`, `table`, `section`, h1–h5, `<label>`+`<select>`; `aria-*` da página: `aria-label="Fechar"` (botão de fechar do `ModalMensagemExecucao`) e `aria-label="Limpar trilha da sincronização"` (X do `TrilhaSyncChip`); SEM `role=`, tooltip `title` ou teclado customizado; ENH-0009 removeu `ModalDecisaoPendencia` `[CONFIRMED: code]`.

## Navegação e side effects

Sem `navigate`/router; sem chamadas diretas ao supabase (tudo via hooks/services) `[CONFIRMED: code]`.

## Testes

`Admin.test.tsx` (primeiro teste de página do projeto; demais páginas testadas: Perfil, Referencias, Dashboard) — 11 testes (ENH-0009 removeu testes de curadoria/pendências): loading, acesso negado, monitoramento de jobs, pluralização/tamanho de página, modal de mensagem, matching validado + botão manual em dev, aguarda sync inicial, aba de recuperação só com permissão, histórico + detalhes, restauração exige "RESTAURAR"; `useAdmin.test.ts`, `useBackgroundJobsAdmin.test.tsx`, `useReferenciasSyncAdmin.test.tsx` (9 testes), `admin.service.test.ts`, `background-jobs.service.test.ts`, `referencias-sync.service.test.ts` (25 testes) `[CONFIRMED: test]`.

## Evidências

- E1 — `src/react-app/pages/Admin.tsx` completo `[CONFIRMED: code]`
- E2 — Extração estruturada por agente (2026-08-13) validada contra o código `[CONFIRMED: code]`
- E3 — `useAdmin.ts`, `useBackgroundJobsAdmin.ts`, `admin.service.ts`, `background-jobs.service.ts` `[CONFIRMED: code]`

## Veja também

- [background-jobs](../../backend/background-jobs.md), [background_job_executions](../../database/background_job_executions.md), [rpc.md](../../database/rpc.md)
- [modal-mensagem-execucao.md](../components/modal-mensagem-execucao.md) (modal de mensagem do histórico)
- [referencias.md](referencias.md) (gestão de referências do usuário)
- [api-referencias-sync](../../backend/api-referencias-sync.md) + [rpc.md](../../database/rpc.md) (sincronização de referências FEAT-0017 — RPCs e rota atrás da seção de sincronização)
