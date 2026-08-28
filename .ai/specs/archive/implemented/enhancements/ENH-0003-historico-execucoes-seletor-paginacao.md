# ENH-0003 — Histórico das execuções com seletor de tamanho de página

**Type:** ENH
**Status:** IMPLEMENTED (2026-08-27 — PR #47 merge `bbda6a1`; decisão formal registrada abaixo)
**Implemented Through:** PR #47 (merge `856ce92`, 2026-08-27) · DEFAULT_PAGE_SIZE 20→3 (`background-jobs.service.ts:26`); `pageSize` como estado gerenciável no hook com reset de página 1 (`useBackgroundJobsAdmin.ts:39,108-111`); seletor 3/10/20 no rodapé do Histórico (`Admin.tsx:566-577`); contador dinâmico singular/plural (`Admin.tsx:45-47`); botão "Ver mensagem" na coluna + `ModalMensagemExecucao` (`Admin.tsx:494-505,629-634`); paginação numerada removida por decisão do usuário (2026-08-27); ACs 1–7 validadas com evidência; specs sincronizadas no mesmo commit
**Issue:** #39
**Title:** Histórico das execuções com seletor de tamanho de página
**Created on:** 2026-08-22

## Problem

No painel administrativo, a lista "Histórico das execuções" carrega por padrão 20 itens por página — percepção de "muitos itens" na primeira renderização. O usuário deseja uma visão inicial enxuta (3 execuções), acesso à lista completa por paginação e navegação eficiente entre páginas quando a lista for grande.

## Current State

- A página Admin (`src/react-app/pages/Admin.tsx`) possui a seção "Monitoramento de Jobs" com filtros (Job/Status/Período) e o "Histórico das execuções".
- **Paginação server-side** via PostgREST (`.range` + `count: "exact"`), ordenada por `started_at DESC`, com filtros `environment = CURRENT_APP_ENVIRONMENT`.
- **`DEFAULT_PAGE_SIZE = 3`** (`background-jobs.service.ts:26`).
- **Seletor de page size** (3/10/20) no rodapé, default 3; troca de page size reseta para página 1.
- **`executionCountLabel(total)`** — "1 execução encontrada." / "{N} execuções encontradas." (`Admin.tsx:45-47`).
- **Coluna Mensagem** substituída por botão "Ver mensagem" que abre `ModalMensagemExecucao` (`Admin.tsx:494-505`).
- **Rodapé em linha única** (`sm:grid-cols-3`): "Página {page} de {totalPages}" à esquerda / Anterior/Próxima centralizados / seletor à direita (`Admin.tsx:538-580`).
- **Paginação numerada** removida por decisão do usuário (2026-08-27).
- Hook `useBackgroundJobsAdmin` expõe `page`, `pageSize`, `totalPages`, `setPage`, `setPageSize` (`useBackgroundJobsAdmin.ts:108-129`).
- Testes: 6 no Admin.test.tsx, 4 no useBackgroundJobsAdmin.test.tsx (371/371 suíte verde).

## Acceptance Criteria

- [x] AC1: seletor de page size com opções 3/10/20 visível no "Histórico das execuções"; default 3 ao carregar a página.
- [x] AC2: a lista exibe no máximo N execuções (N = seleção), ordenadas por `started_at DESC`, do conjunto filtrado vigente (job/status/período).
- [x] AC3: Anterior/Próxima; é possível navegar até a última página e voltar; "Página {page} de {totalPages}" no rodapé reflete a contagem correta. A paginação numerada original desta AC foi removida por decisão do usuário (refinamento 2026-08-27).
- [x] AC4: trocar filtro reseta para a página 1; trocar page size também reseta para a página 1 e dispara refetch com o novo range; page size selecionado permanece durante a sessão.
- [x] AC5: nenhuma mudança em banco/RLS/RPC/backend — a consulta permanece server-side (`.range` + `count: "exact"`) com `environment = CURRENT_APP_ENVIRONMENT`.
- [x] AC6: testes atualizados (mocks com page size default 3) e novos (seletor, contador dinâmico, modal, reset de page size) com suíte completa verde; specs `admin.md`/FEAT-0012 sincronizadas no mesmo commit.
- [x] AC7: comportamento responsivo mantido — seletor e navegação funcionais em mobile (cards) e desktop (tabela); painel de detalhes continua selecionando a execução mais recente da página.

## Evidence

- E1 — `src/react-app/pages/Admin.tsx` completo (`Admin.tsx`)
- E2 — `src/react-app/hooks/useBackgroundJobsAdmin.ts`, `useBackgroundJobsAdmin.test.tsx`
- E3 — `src/react-app/services/background-jobs.service.ts`, `background-jobs.service.test.ts`
- E4 — `src/react-app/pages/Admin.test.tsx` (6 testes)
- E5 — `src/react-app/components/ModalMensagemExecucao.tsx`
- E6 — `.ai/specs/current/frontend/pages/admin.md`, `.ai/specs/current/features/FEAT-0012-painel-administrativo.md`, `.ai/specs/current/frontend/components/modal-mensagem-execucao.md`

## Decisions

- **2026-08-22 (usuário):** seletor 3/10/20 com default 3 + paginação numerada (Alternativa B + D).
- **2026-08-27 (usuário):** paginação numerada removida — navegação mantida por Anterior/Próxima + "Página X de Y" no rodapé; paginação numerada pode voltar como proposta futura.
- **2026-08-27 (autor — registro formal):** Aprovação registrada por autorização explícita no fluxo interativo (CONVENTIONS §8), com decisões de design (tamanho de página, contador dinâmico, modal de mensagem, layout 3 zonas) e o refinamento de remover a paginação numerada. Implementada e mergeada via PR #47 (`bbda6a1`).

## See Also

- [FEAT-0012 Painel administrativo](../current/features/FEAT-0012-painel-administrativo.md)
- [background-jobs](../current/backend/background-jobs.md), [background_job_executions](../current/database/background_job_executions.md)
- [admin.md](../current/frontend/pages/admin.md), [modal-mensagem-execucao.md](../current/frontend/components/modal-mensagem-execucao.md)
