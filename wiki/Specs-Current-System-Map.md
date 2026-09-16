# System Map — MeuFenil

**Status:** COMPLETO (Fase 8 — 2026-08-13). Todas as linhas são capabilities CONFIRMADAS das Fases 2–7; a lista preliminar da Fase 0 foi validada e consolidada (ver `.ai/.temp/analyses/24-features-system-map.md`).
**Última verificação:** 2026-09-07 (promoção FEAT-0017 — linha Sincronização de referências; ENH-0004/FEAT-0017 já refletidos nas linhas 0008/0012/0013 nas verificações anteriores)

> Este mapa cobre SOMENTE capabilities do Current State. Itens Proposed são indexados no [`README`](Specs-README). É um ÍNDICE: cada célula aponta para a documentação canônica — não duplica conteúdo.

## Como ler este mapa

Cada linha mapeia uma capability para seus elementos relacionados:

| Coluna | Conteúdo |
|---|---|
| Capability | Funcionalidade confirmada do sistema |
| Feature Spec | Spec ponta-a-ponta em `features/FEAT-NNNN-*.md` |
| Frontend | Páginas/componentes em `frontend/` |
| Backend | API/edge functions/CLI em `backend/` |
| Database | Tabelas/RPCs/triggers em `database/` |
| Security | Modelo em `security/` |
| Tests | Arquivos de teste reais (Fase 6 + TEST-0001) |

Convenções de célula: **N/A** = componente não existe para esta capability (confirmado) · **`[A documentar]`** = existe mas sem spec dedicada · **UNKNOWN** = não determinado. Nenhum link falso.

## Mapa de capabilities

| Capability | Feature Spec | Frontend | Backend | Database | Security | Tests |
|---|---|---|---|---|---|---|
| Autenticação (Google OAuth, sessão, logout) | [FEAT-0001](Specs-Current-Features-FEAT-0001-Autenticacao) | [home](Specs-Current-Frontend-Pages-Home), [dashboard](Specs-Current-Frontend-Pages-Dashboard) | N/A | [usuarios](Specs-Current-Database-Usuarios), [triggers](Specs-Current-Database-Triggers) | [security-model](Specs-Current-Security-Security-Model) | `auth.service.test.ts`, `useUser.test.ts`, `auth-real-validation.test.ts` |
| Consentimento LGPD | [FEAT-0002](Specs-Current-Features-FEAT-0002-Consentimento-Lgpd) | [consentimento-lgpd](Specs-Current-Frontend-Components-Consentimento-Lgpd), [dashboard](Specs-Current-Frontend-Pages-Dashboard) | N/A | [usuarios](Specs-Current-Database-Usuarios) | [security-model](Specs-Current-Security-Security-Model) | `dashboard.service.test.ts`, `ConsentimentoLGPD.test.tsx`, `Dashboard.test.tsx` |
| Registro diário de consumo + cálculo | [FEAT-0003](Specs-Current-Features-FEAT-0003-Registro-Diario-Consumo) | [adicionar-registro](Specs-Current-Frontend-Components-Adicionar-Registro), [dashboard](Specs-Current-Frontend-Pages-Dashboard), [historico](Specs-Current-Frontend-Pages-Historico) | N/A | [registros](Specs-Current-Database-Registros), [referencias](Specs-Current-Database-Referencias) | [security-model](Specs-Current-Security-Security-Model) | `registros.service.test.ts`, `useRegistros.test.ts`, `useCreateRegistro.test.tsx`, `AdicionarRegistro.test.tsx` |
| Limite diário personalizado | [FEAT-0004](Specs-Current-Features-FEAT-0004-Limite-Diario) | [perfil](Specs-Current-Frontend-Pages-Perfil), [dashboard](Specs-Current-Frontend-Pages-Dashboard) | N/A | [usuarios](Specs-Current-Database-Usuarios) | [security-model](Specs-Current-Security-Security-Model) | `usuarios.service.test.ts`, `usePerfil.test.ts`, `Perfil.test.tsx` |
| Dashboard diário | [FEAT-0005](Specs-Current-Features-FEAT-0005-Dashboard) | [dashboard](Specs-Current-Frontend-Pages-Dashboard) | N/A (RPCs órfãs em [rpc](Specs-Current-Database-Rpc)) | [registros](Specs-Current-Database-Registros), [usuarios](Specs-Current-Database-Usuarios) | [security-model](Specs-Current-Security-Security-Model) | `dashboard.service.test.ts`, `useDashboard.test.tsx`, `Dashboard.test.tsx` |
| Histórico de registros | [FEAT-0006](Specs-Current-Features-FEAT-0006-Historico-Registros) | [historico](Specs-Current-Frontend-Pages-Historico) | N/A | [registros](Specs-Current-Database-Registros) | [security-model](Specs-Current-Security-Security-Model) | `useRegistros.test.ts`, `registros.service.test.ts` |
| Estatísticas + export CSV/JSON | [FEAT-0007](Specs-Current-Features-FEAT-0007-Estatisticas) | [estatisticas](Specs-Current-Frontend-Pages-Estatisticas) | N/A | [registros](Specs-Current-Database-Registros), [usuarios](Specs-Current-Database-Usuarios) | [security-model](Specs-Current-Security-Security-Model) | `estatisticas.service.test.ts`, `useEstatisticas.test.ts` |
| Referências alimentares (busca/filtros/favoritas/customizadas/ativar-desativar; modelo nome+marca desde ENH-0004) | [FEAT-0008](Specs-Current-Features-FEAT-0008-Referencias-Alimentares) | [referencias](Specs-Current-Frontend-Pages-Referencias), [modal-referencia](Specs-Current-Frontend-Components-Modal-Referencia) | [rpc](Specs-Current-Database-Rpc) | [referencias](Specs-Current-Database-Referencias), [referencias_favoritas](Specs-Current-Database-Referencias_favoritas), [triggers](Specs-Current-Database-Triggers) | [security-model](Specs-Current-Security-Security-Model) | `referencias.service.test.ts`, `useReferencias.test.ts`, `Referencias.test.tsx`, `lib/referencias.test.ts` (ENH-0004), `rpc-ativar-referencia.test.ts`, `rpc-remover-referencia.test.ts` |
| Exames de PKU | [FEAT-0009](Specs-Current-Features-FEAT-0009-Exames-Pku) | [exames](Specs-Current-Frontend-Pages-Exames) | N/A | [exames_pku](Specs-Current-Database-Exames_pku) | [security-model](Specs-Current-Security-Security-Model) | `exames.service.test.ts`, `useExames.test.ts` |
| Perfil + exportar dados + excluir conta | [FEAT-0010](Specs-Current-Features-FEAT-0010-Perfil-Usuario) | [perfil](Specs-Current-Frontend-Pages-Perfil), [login-as](Specs-Current-Frontend-Components-Login-As) | [edge-function-delete-account](Specs-Current-Backend-Edge-Function-Delete-Account) | [usuarios](Specs-Current-Database-Usuarios), [registros](Specs-Current-Database-Registros) | [security-model](Specs-Current-Security-Security-Model) | `usuarios.service.test.ts`, `usePerfil.test.ts`, `useLayoutPerfil.test.ts`, `Perfil.test.tsx` |
| Delegação de acesso (login-as) | [FEAT-0011](Specs-Current-Features-FEAT-0011-Delegacao-Acesso) | [login-as](Specs-Current-Frontend-Components-Login-As), [perfil](Specs-Current-Frontend-Pages-Perfil) | [edge-function-delegar-acesso](Specs-Current-Backend-Edge-Function-Delegar-Acesso) | [delegacoes_acesso](Specs-Current-Database-Delegacoes_acesso) | [security-model](Specs-Current-Security-Security-Model) | `rpc-ativar`/`rpc-remover` (cenários delegado) |
| Painel administrativo (usuários + DB + jobs) | [FEAT-0012](Specs-Current-Features-FEAT-0012-Painel-Administrativo) | [admin](Specs-Current-Frontend-Pages-Admin), [modal-mensagem-execucao](Specs-Current-Frontend-Components-Modal-Mensagem-Execucao) | [rpc](Specs-Current-Database-Rpc) (`get_estatisticas_admin`) | [usuarios](Specs-Current-Database-Usuarios), [background_job_executions](Specs-Current-Database-Background_job_executions) | [security-model](Specs-Current-Security-Security-Model) | `Admin.test.tsx`, `useAdmin.test.ts`, `useBackgroundJobsAdmin.test.tsx`, `admin.service.test.ts`, `background-jobs.service.test.ts` |
| Background jobs (keepalive + retenção) | [FEAT-0013](Specs-Current-Features-FEAT-0013-Background-Jobs) | N/A (consulta no [admin](Specs-Current-Frontend-Pages-Admin)) | [api-keepalive](Specs-Current-Backend-Api-Keepalive), [background-jobs](Specs-Current-Backend-Background-Jobs) | [background_job_executions](Specs-Current-Database-Background_job_executions), [triggers](Specs-Current-Database-Triggers) | [security-model](Specs-Current-Security-Security-Model) | `api/keepalive.test.ts`, `background-jobs.test.ts` |
| PWA / multi-dispositivo | [FEAT-0014](Specs-Current-Features-FEAT-0014-Pwa) | [overview](Specs-Current-Frontend-Overview) (seção PWA) | N/A | N/A | N/A | NONE |
| Sincronização de referências (origem ANVISA/Power BI) | [FEAT-0017](Specs-Current-Features-FEAT-0017-Sincronizacao-Referencias-Anvisa) | [admin](Specs-Current-Frontend-Pages-Admin) (seções M6) | [api-referencias-sync](Specs-Current-Backend-Api-Referencias-Sync) | [referencia_syncs](Specs-Current-Database-Referencia_syncs), [referencia_sync_pendencias](Specs-Current-Database-Referencia_sync_pendencias), [referencia_eventos](Specs-Current-Database-Referencia_eventos), [referencia_snapshots](Specs-Current-Database-Referencia_snapshots), [referencia_backups](Specs-Current-Database-Referencia_backups), [rpc](Specs-Current-Database-Rpc), [triggers](Specs-Current-Database-Triggers) | [security-model](Specs-Current-Security-Security-Model) (§11/§12) | `api/referencias-sync.test.ts`, `rpc-referencias-sync.test.ts`, `rpc-referencias-sync-rollback.test.ts`, `rpc-referencias-sync-seed.test.ts`, `canonical/compare/engine/validate.test.ts`, `referencias-sync.service.test.ts`, `Admin.test.tsx` |

## Notas de navegação (componentes fora das linhas)

- **Página Sobre:** conteúdo institucional — documentada em [frontend/pages/sobre](Specs-Current-Frontend-Pages-Sobre); não elevada a feature (sem regras de negócio).
- **CLI e script de migrations:** ferramentas de operação — [backend/cli](Specs-Current-Backend-Cli); não são feature de usuário final.
- **RPCs órfãs** (`dashboard_hoje`, `dashboard_ultimos_dias`): alcançáveis por [database/rpc](Specs-Current-Database-Rpc).
- **`ConcederAcessoModal`** (componente sem consumidor — fato Fase 5): documentado em [frontend/components/login-as](Specs-Current-Frontend-Components-Login-As).
- **Product & Domain:** [product/overview](Specs-Current-Product-Overview), [product/glossary](Specs-Current-Product-Glossary), [domain/domain-model](Specs-Current-Domain-Domain-Model), [domain/business-rules](Specs-Current-Domain-Business-Rules) — base conceitual de todas as linhas.
- **Testing:** [testing/testing-strategy](Specs-Current-Testing-Testing-Strategy) — infraestrutura e resultados.

## Regras de manutenção

- Auditado em toda fase e em toda promoção de feature (checklist — `CONVENTIONS.md`).
- Linha sem links = pendência explícita — nunca preencher sem evidência.
- Mudança de comportamento → atualizar a linha no mesmo fluxo de mudança.
- Capabilities propostas NÃO entram aqui (ver `README.md`).
