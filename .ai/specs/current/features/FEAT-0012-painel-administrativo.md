# Feature Spec: Painel administrativo

**ID:** FEAT-0012
**Tipo:** Current
**Status:** Implementada
**Última verificação:** 2026-09-07 (FEAT-0017 M6 — UI do Admin estendida com seções de sincronização de referências/curadoria/recuperação; página [admin](../frontend/pages/admin.md))

## Purpose

Visão administrativa (somente leitura) do sistema: usuários (totais), uso do banco de dados e monitoramento de background jobs com filtros, paginação e detalhes de execução.

## Actors

- Admin (`usuarios.role = 'admin'`)

## Preconditions

- Usuário autenticado com papel admin; navegação mostra item "Admin" apenas para admins; página repete a checagem ("Acesso Negado") `[CONFIRMED: code — Layout.tsx:21-31, Admin.tsx:157-175]`.

## Main Flow

1. `useAdmin` carrega perfil (gate), lista de usuários e `getEstatisticasAdmin` (RPC `get_estatisticas_admin`) `[CONFIRMED: code]`.
2. Seção "Uso do Banco de Dados": armazenamento (percentual com min(...,100), barra colorida por faixa >80/>60), registros totais, referências (globais/personalizadas) e box fixo de limites do plano gratuito `[CONFIRMED: code — Admin.tsx:224-317]`.
3. `useBackgroundJobsAdmin` carrega overview + execuções (filtros job/status/período com reset de página; paginação server-side; tabela desktop × cards mobile; rodapé de paginação em linha única com "Página {page} de {totalPages}" à esquerda, botões Anterior/Próxima centralizados e seletor "Item por página" à direita; botão "Ver mensagem" por linha abre modal de mensagem; linha clicável abre painel de detalhes com Run ID, tempos e `details` em `<pre>`) `[CONFIRMED: code — Admin.tsx:326-634]`.
4. "Atualizar" recarrega jobs (spinner no botão; lista anterior permanece) `[CONFIRMED: code]`.

## Alternative Flows

- Badge de ambiente ("Ambiente atual: dev|prod") no header `[CONFIRMED: code — Admin.tsx:186-189]`.

## Error Flows

- Jobs: box vermelho "Erro ao carregar jobs" + `jobs.error.message` `[CONFIRMED: code]`.
- Perfil/usuários/estatísticas: `error` do useAdmin destruturado mas NUNCA renderizado (fato) `[CONFIRMED: code × ausência]`.

## Business Rules

- [BR-009](../domain/business-rules.md), [BR-016](../domain/business-rules.md)

## Frontend

- [pages/admin](../frontend/pages/admin.md)
- `useAdmin`, `useBackgroundJobsAdmin`, `admin.service`, `background-jobs.service`
- `referencias-sync.service`, `useReferenciasSyncAdmin` (seções de sincronização/curadoria/recuperação no Admin — FEAT-0017 M6)

## Backend

- RPC [get_estatisticas_admin](../database/rpc.md) (via PostgREST)

## Database

- [usuarios](../database/usuarios.md), [background_job_executions](../database/background_job_executions.md)

## Security

- [security-model](../security/security-model.md) (Admin Matrix — sem acesso RLS a registros/exames/favoritas/delegações)

## Tests

- `Admin.test.tsx` (15 — com a seção de sincronização FEAT-0017 M6; primeiro teste de página; Perfil, Referencias e Dashboard também têm teste desde TEST-0001), `useAdmin.test.ts` (100%), `useBackgroundJobsAdmin.test.tsx` (4), `admin.service.test.ts` (5), `background-jobs.service.test.ts` (4), `referencias-sync.service.test.ts` (25 — M6), `useReferenciasSyncAdmin.test.tsx` (9 — M6)
- **Coverage status:** PARTIALLY TESTED (mocks pesados no teste de página; monitoramento testado com dados mockados)

## Dependencies

- FEAT-0001, FEAT-0013 (jobs), FEAT-0017 (sincronização — UI no Admin desde o M6)

## Related Features

- [FEAT-0013 Background jobs](FEAT-0013-background-jobs.md), [FEAT-0008 Referências](FEAT-0008-referencias-alimentares.md), [FEAT-0017 Sincronização de referências](FEAT-0017-sincronizacao-referencias-anvisa.md) (seções de sincronização/curadoria/recuperação no Admin — M6)

## Evidence

- E1 — `Admin.tsx` completo (extrato estruturado Fase 5) `[CONFIRMED: code]`
- E2 — RPC e tabela de jobs: catálogo + migrations `[CONFIRMED: database, migration]`

## Unknowns

- Uso efetivo do RPC por papel (grants incluem anon — U-2.5).
