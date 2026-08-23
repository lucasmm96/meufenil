# ENH-0003 — Histórico das execuções com seletor de tamanho de página e paginação numerada

**Type:** ENH
**Status:** PROPOSED
**Title:** Histórico das execuções com seletor de tamanho de página e paginação numerada
**Issue:** #39
**Created on:** 2026-08-22

## Problem

No painel administrativo, a lista "Histórico das execuções" carrega por padrão 20 itens por página — percepção de "muitos itens" na primeira renderização. O usuário deseja uma visão inicial enxuta (3 execuções), acesso à lista completa por paginação e navegação eficiente entre páginas quando a lista for grande.

## Current State

- A página Admin (`src/react-app/pages/Admin.tsx`) possui a seção "Monitoramento de Jobs" com filtros (Job/Status/Período) e o "Histórico das execuções" `[CONFIRMED: code — Admin.tsx:319-590]`. Spec: [`current/frontend/pages/admin.md`](../../current/frontend/pages/admin.md) e [`current/features/FEAT-0012-painel-administrativo.md`](../../current/features/FEAT-0012-painel-administrativo.md).
- **A paginação JÁ existe e é server-side** `[CONFIRMED: code]`:
  - `background-jobs.service.ts:26` — `DEFAULT_PAGE_SIZE = 20`.
  - `getBackgroundJobExecutions` (`background-jobs.service.ts:148-190`) — query PostgREST com `.range(from, to)` + `count: "exact"`, ordenada por `started_at DESC`, filtros `environment = CURRENT_APP_ENVIRONMENT`, job, status e período.
  - Hook `useBackgroundJobsAdmin` (`useBackgroundJobsAdmin.ts:30,42`) — expõe `page`, `pageSize`, `totalPages`, `setPage`; `pageSize` hoje é constante derivada do service.
  - UI (`Admin.tsx:422-450`) — header "**{total} execução(ões) encontradas. Página {page} de {totalPages}.**" + botões "Anterior"/"Próxima" (disabled nas bordas, disabled durante `loading`). Sem números de página.
- Volume de dados: dev = 6, prod = 8 execuções (2026-08-13); keepalive produz ~1 execução/dia com retenção de 365 dias (BR-027) → teto teórico de ~365 execuções/ambiente `[CONFIRMED: database — background_job_executions.md E4; migration]`.
- Testes existentes fixam `pageSize: 20` em mocks (`Admin.test.tsx:124`, `useBackgroundJobsAdmin.test.tsx:78`) e `pageSize: 10` em `background-jobs.service.test.ts:159` — mudança no default exige atualização.
- Nota: o pedido original pressupunha ausência de paginação; a paginação (server-side, 20/página) já existe desde antes da última verificação da spec (2026-08-13). O pedido real é reduzir/enxugar a visão inicial, dar controle do tamanho da página e melhorar a navegação — não criar paginação do zero.

## Proposed State

- **Seletor de tamanho de página (3 / 10 / 20)** no "Histórico das execuções", com **default 3** — a página inicial mostra as 3 (ou N selecionadas) execuções mais recentes do conjunto **filtrado** (ordem `started_at DESC`, filtros Job/Status/Período vigentes).
- **Paginação numerada** (números de página com estratégia de elisão para listas longas, ex.: `1 … 5 6 7 … 122`) **além** de Anterior/Próxima.
- Troca de filtro reseta para a página 1 (comportamento já existente — `useBackgroundJobsAdmin.ts:103-106`); o page size selecionado permanece durante a sessão. Não há persistência da preferência entre sessões — decisão do usuário (2026-08-22): default 3 a cada carregamento (ver Q5).
- Nenhuma mudança em banco, RLS, RPC ou backend — a paginação continua server-side via PostgREST (`.range` + `count`).

## Motivation

- **FACTUAL:** o default atual é 20 execuções por página `[CONFIRMED: code — background-jobs.service.ts:26]`; o usuário pediu visão inicial de 3 (2026-08-22).
- **FACTUAL:** a navegação atual limita-se a Anterior/Próxima `[CONFIRMED: code — Admin.tsx:431-449]`; com 3 por página e teto de ~365 registros (retenção BR-027), chegam a existir ~122 páginas — sem números de página, navegar até o fim exigiria ~122 cliques.
- **FACTUAL (decisão do usuário, 2026-08-22):** escolhido o modelo de **seletor 3/10/20 com default 3 + paginação numerada**, respeitando os filtros vigentes, restrito ao "Histórico das execuções" e sem persistência de page size entre sessões.
- **ASSUMPTION:** visão inicial enxuta (3) melhora a leitura rápida da saúde dos jobs; o seletor atende tanto leitura rápida quanto exploração profunda; paginação numerada reduz significativamente os cliques em listas grandes. O que falta confirmar: comportamento da paginação numerada no layout mobile (cards) e o limiar da elisão de números.

## Evidence

- Origem: solicitação do usuário em linguagem natural (2026-08-22; texto original preservado em References) + respostas às Open Questions (2026-08-22).
- Evidências de código do Current State listadas acima (service, hook, página, testes).
- Specs atuais: `current/frontend/pages/admin.md`, `current/features/FEAT-0012-painel-administrativo.md`, `current/features/FEAT-0013-background-jobs.md`, `current/database/background_job_executions.md`.
- Sem GAP-XXX/O-XXX/R-XXX/U-X.X/ADR-NNNN associados.

## Scope

- "Histórico das execuções" do painel admin (`Admin.tsx` + `useBackgroundJobsAdmin` + `background-jobs.service`):
  - Seletor de page size 3/10/20 (default 3) — estado no hook (`pageSize` deixa de ser constante derivada e passa a ser estado gerenciável).
  - Paginação numerada (com elisão) + Anterior/Próxima existentes.
  - Comportamento de reset de página 1 ao trocar filtro (manter) e ao trocar page size (decisão técnica: reset para página 1, coerente com o modelo atual).
- Atualização dos testes afetados (mocks com page size default 3) + testes novos (seletor, paginação numerada, reset) e das specs de `current/` (admin.md, FEAT-0012) após implementação.

## Out of Scope

- Outras listas do app (histórico de registros FEAT-0006, referências — que já tem paginação própria em `referencias.service.ts:95`).
- Cards/overview do monitoramento ("Resumo das execuções", `DEFAULT_OVERVIEW_LIMIT = 240`).
- Persistência da preferência de page size entre sessões (ex.: localStorage) — **decisão do usuário (2026-08-22): fora de escopo**; sem camada de persistência, default 3 a cada carregamento (ver Q5 resolvida).
- Mudanças em banco, RLS, RPC, backend ou contrato externo.
- FEAT-0002 (exportar histórico CSV) — proposta independente sobre outro domínio.

## Impacted Features

- [`FEAT-0012 Painel administrativo`](../../current/features/FEAT-0012-painel-administrativo.md) (única capability afetada).
- FEAT-0013 (background jobs) — apenas como consumido pela consulta; sem mudança de comportamento.

## Impacted Business Rules

- Nenhuma BR afetada (paginação é UI/UX, não regra de negócio). BR-027 (retenção 365 dias) e BR-009/BR-016 (admin) permanecem inalteradas.

## Impacted Architecture

- N/A — nenhuma decisão arquitetural; paginação server-side já estabelecida é mantida. ADR não se aplica.

## Impacted Frontend / Backend / Database / Security / Tests

- **Frontend:** [`current/frontend/pages/admin.md`](../../current/frontend/pages/admin.md) — `Admin.tsx` (seletor + paginação numerada), `hooks/useBackgroundJobsAdmin.ts` (page size como estado), `services/background-jobs.service.ts` (default 3; API de seletor). Padrões de UI seguem os existentes na página (SelectField, botões de paginação atuais).
- **Backend:** N/A (nenhuma mudança — consulta PostgREST existente).
- **Database:** N/A (sem schema/índice/RLS novo; índices existentes de `background_job_executions` já cobrem a ordenação).
- **Security:** N/A (nenhuma mudança de autorização; RLS `admin_can_select_background_job_executions` intocado).
- **Tests:** `Admin.test.tsx`, `useBackgroundJobsAdmin.test.tsx`, `background-jobs.service.test.ts` — mocks com `pageSize` fixo precisam acompanhar o novo default 3; novos testes para seletor (troca de page size → refetch com novo range), paginação numerada (renderização, elisão, clique em número) e reset de página; suíte completa verde.

## Dependencies

- Nenhuma (ENH-0003 é independente; não depende de outras propostas ativas).

## Risks

- **Paginação numerada longa:** com page size 3, até ~122 páginas — a lista de números precisa de elisão (janela + "…" + última) para não poluir a UI. `[ASSUMED: teto teórico baseado em 1 execução/dia + retenção 365 dias; na prática atual dev=6, prod=8]`
- **Mobile:** números de página + seletor em layout de cards podem ocupar espaço — mitigação: design responsivo (números compactos, seletor de largura reduzida).
- **Regressão de testes:** mocks fixam `pageSize: 20/10` — atualização obrigatória no mesmo commit.
- **Escopo de UI maior que o mínimo:** seletor + paginação numerada ampliam a mudança em relação ao pedido literal — mitigado pela decisão explícita do usuário (2026-08-22).

## Alternatives

- **A. Reduzir `DEFAULT_PAGE_SIZE` de 20 para 3**, mantendo apenas Anterior/Próxima — mudança mínima, atende o pedido literal; **não escolhida**: navegação insuficiente em listas grandes.
- **B. Paginação numerada** (números de página com elisão) além de Anterior/Próxima — **escolhida** (2026-08-22): navegação eficiente (~122 páginas potenciais).
- **C. "Mostrar 3 e botão Ver mais"** (carregamento incremental no cliente) — diverge do modelo server-side atual; **não escolhida**: mais complexa e fora do padrão existente.
- **D. Seletor de page size (3 / 10 / 20)** — **escolhida** (2026-08-22): flexibilidade para leitura rápida (3) e exploração profunda (20); default 3 atende o pedido original.

**Decisão registrada (2026-08-22, usuário):** combinação **B + D** — seletor 3/10/20 com default 3, paginação numerada, filtros respeitados, escopo restrito ao "Histórico das execuções".
**Decision:** TBD — a aprovação formal (ACCEPTED, com **Approved by:** e **Approved on:**) permanece pendente e é registrada no fluxo orquestrado; a decisão de design acima não substitui o campo formal de decisão da proposta.

## Open Questions

Todas as questões resolvidas (2026-08-22) — nenhuma pendência em aberto para a formalização da proposta.

1. **Tamanho da página** — **RESOLVIDA (2026-08-22):** seletor 3/10/20 com default 3 (Alternativa D). Racional: default 3 atende a visão inicial enxuta; o seletor dá controle ao usuário sem nova proposta.
2. **Navegação** — **RESOLVIDA (2026-08-22):** paginação numerada com elisão + Anterior/Próxima (Alternativa B). Racional: com ~1 registro/dia e retenção de 365 dias, listas de ~122 páginas tornam Anterior/Próxima sozinho insuficiente.
3. **"3 últimas" e filtros** — **RESOLVIDA (2026-08-22):** respeitar os filtros vigentes (job/status/período); "últimas N" são as últimas do conjunto filtrado. Racional: coerente com o modelo atual (troca de filtro reseta para página 1).
4. **Escopo** — **RESOLVIDA (2026-08-22):** somente o "Histórico das execuções" do Admin. Racional: outras listas (histórico FEAT-0006, referências) têm requisitos próprios e ficam fora.
5. **Persistência da preferência de page size entre sessões** — **RESOLVIDA (2026-08-22):** fora de escopo — sem localStorage; default 3 a cada carregamento. Racional: escopo menor (nenhuma camada de persistência) e coerente com o desenho enxuto; persistência como proposta futura se houver demanda real.

## Acceptance Criteria

- [ ] AC1: seletor de page size com opções 3/10/20 visível no "Histórico das execuções"; default 3 ao carregar a página.
- [ ] AC2: a lista exibe no máximo N execuções (N = seleção), ordenadas por `started_at DESC`, do conjunto filtrado vigente (job/status/período).
- [ ] AC3: paginação numerada (com elisão quando `totalPages` for grande) + Anterior/Próxima; é possível navegar até a última página e voltar; header "Página {page} de {totalPages}" reflete a contagem correta.
- [ ] AC4: trocar filtro reseta para a página 1; trocar page size também reseta para a página 1 e dispara refetch com o novo range; page size selecionado permanece durante a sessão.
- [ ] AC5: nenhuma mudança em banco/RLS/RPC/backend — a consulta permanece server-side (`.range` + `count: "exact"`) com `environment = CURRENT_APP_ENVIRONMENT`.
- [ ] AC6: testes atualizados (mocks com page size default 3) e novos (seletor, paginação numerada/elisão, reset de página) com suíte completa verde; specs `admin.md`/FEAT-0012 sincronizadas no mesmo commit.
- [ ] AC7: comportamento responsivo mantido — seletor e paginação numerada funcionais em mobile (cards) e desktop (tabela); painel de detalhes continua selecionando a execução mais recente da página.

## References

- Texto original da solicitação do usuário (2026-08-22): preservado abaixo.
- Decisões do usuário nas Open Questions (2026-08-22) — incorporadas acima.
- `current/frontend/pages/admin.md`, `current/features/FEAT-0012-painel-administrativo.md`, `current/features/FEAT-0013-background-jobs.md`, `current/database/background_job_executions.md`.
- Código: `src/react-app/pages/Admin.tsx`, `src/react-app/hooks/useBackgroundJobsAdmin.ts`, `src/react-app/services/background-jobs.service.ts`.

---

### Texto original da solicitação do usuário (preservado)

> a pagina "src\react-app\pages\Admin.tsx" tem uma lista chamada "Histórico das execuções", essa lista mostra por padrão muitos itens, eu quero q a lista inicial (pode ser uma paginação) mostre apenas as 3 ultimas rodagens. o usuario deve conseguir ver a lista completa de dados, mas com a devida paginação selecionada e em caso da lista ser muito grande o usuario pode tbm navegar entre as paginas.
