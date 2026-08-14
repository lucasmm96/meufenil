# System Map — MeuFenil

**Status:** COMPLETO (Fase 8 — 2026-08-13). Todas as linhas são capabilities CONFIRMADAS das Fases 2–7; a lista preliminar da Fase 0 foi validada e consolidada (ver `.ai/.temp/analyses/24-features-system-map.md`).
**Última verificação:** 2026-08-13 (commit 6323664)

> Este mapa cobre SOMENTE capabilities do Current State. Itens Proposed são indexados no [`README`](../README.md). É um ÍNDICE: cada célula aponta para a documentação canônica — não duplica conteúdo.

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
| Tests | Arquivos de teste reais (Fase 6) |

Convenções de célula: **N/A** = componente não existe para esta capability (confirmado) · **`[A documentar]`** = existe mas sem spec dedicada · **UNKNOWN** = não determinado. Nenhum link falso.

## Mapa de capabilities

| Capability | Feature Spec | Frontend | Backend | Database | Security | Tests |
|---|---|---|---|---|---|---|
| Autenticação (Google OAuth, sessão, logout) | [FEAT-0001](features/FEAT-0001-autenticacao.md) | [home](frontend/pages/home.md), [dashboard](frontend/pages/dashboard.md) | N/A | [usuarios](database/usuarios.md), [triggers](database/triggers.md) | [security-model](security/security-model.md) | `auth.service.test.ts`, `useUser.test.ts`, `auth-real-validation.test.ts` |
| Consentimento LGPD | [FEAT-0002](features/FEAT-0002-consentimento-lgpd.md) | [consentimento-lgpd](frontend/components/consentimento-lgpd.md), [dashboard](frontend/pages/dashboard.md) | N/A | [usuarios](database/usuarios.md) | [security-model](security/security-model.md) | `dashboard.service.test.ts` |
| Registro diário de consumo + cálculo | [FEAT-0003](features/FEAT-0003-registro-diario-consumo.md) | [adicionar-registro](frontend/components/adicionar-registro.md), [dashboard](frontend/pages/dashboard.md), [historico](frontend/pages/historico.md) | N/A | [registros](database/registros.md), [referencias](database/referencias.md) | [security-model](security/security-model.md) | `registros.service.test.ts`, `useRegistros.test.ts`, `useCreateRegistro.test.tsx` |
| Limite diário personalizado | [FEAT-0004](features/FEAT-0004-limite-diario.md) | [perfil](frontend/pages/perfil.md), [dashboard](frontend/pages/dashboard.md) | N/A | [usuarios](database/usuarios.md) | [security-model](security/security-model.md) | `usuarios.service.test.ts`, `usePerfil.test.ts` |
| Dashboard diário | [FEAT-0005](features/FEAT-0005-dashboard.md) | [dashboard](frontend/pages/dashboard.md) | N/A (RPCs órfãs em [rpc](database/rpc.md)) | [registros](database/registros.md), [usuarios](database/usuarios.md) | [security-model](security/security-model.md) | `dashboard.service.test.ts`, `useDashboard.test.tsx` |
| Histórico de registros | [FEAT-0006](features/FEAT-0006-historico-registros.md) | [historico](frontend/pages/historico.md) | N/A | [registros](database/registros.md) | [security-model](security/security-model.md) | `useRegistros.test.ts`, `registros.service.test.ts` |
| Estatísticas + export CSV/JSON | [FEAT-0007](features/FEAT-0007-estatisticas.md) | [estatisticas](frontend/pages/estatisticas.md) | N/A | [registros](database/registros.md), [usuarios](database/usuarios.md) | [security-model](security/security-model.md) | `estatisticas.service.test.ts`, `useEstatisticas.test.ts` |
| Referências alimentares (busca/filtros/favoritas/customizadas/ativar-desativar) | [FEAT-0008](features/FEAT-0008-referencias-alimentares.md) | [referencias](frontend/pages/referencias.md), [modal-referencia](frontend/components/modal-referencia.md) | [rpc](database/rpc.md) | [referencias](database/referencias.md), [referencias_favoritas](database/referencias_favoritas.md), [triggers](database/triggers.md) | [security-model](security/security-model.md) | `referencias.service.test.ts`, `useReferencias.test.ts`, `rpc-ativar-referencia.test.ts`, `rpc-remover-referencia.test.ts` |
| Exames de PKU | [FEAT-0009](features/FEAT-0009-exames-pku.md) | [exames](frontend/pages/exames.md) | N/A | [exames_pku](database/exames_pku.md) | [security-model](security/security-model.md) | `exames.service.test.ts`, `useExames.test.ts` |
| Perfil + exportar dados + excluir conta | [FEAT-0010](features/FEAT-0010-perfil-usuario.md) | [perfil](frontend/pages/perfil.md), [login-as](frontend/components/login-as.md) | [edge-function-delete-account](backend/edge-function-delete-account.md) | [usuarios](database/usuarios.md), [registros](database/registros.md) | [security-model](security/security-model.md) | `usuarios.service.test.ts`, `usePerfil.test.ts`, `useLayoutPerfil.test.ts` |
| Delegação de acesso (login-as) | [FEAT-0011](features/FEAT-0011-delegacao-acesso.md) | [login-as](frontend/components/login-as.md), [perfil](frontend/pages/perfil.md) | [edge-function-delegar-acesso](backend/edge-function-delegar-acesso.md) | [delegacoes_acesso](database/delegacoes_acesso.md) | [security-model](security/security-model.md) | `rpc-ativar`/`rpc-remover` (cenários delegado) |
| Painel administrativo (usuários + DB + jobs) | [FEAT-0012](features/FEAT-0012-painel-administrativo.md) | [admin](frontend/pages/admin.md) | [rpc](database/rpc.md) (`get_estatisticas_admin`) | [usuarios](database/usuarios.md), [background_job_executions](database/background_job_executions.md) | [security-model](security/security-model.md) | `Admin.test.tsx`, `useAdmin.test.ts`, `useBackgroundJobsAdmin.test.tsx`, `admin.service.test.ts`, `background-jobs.service.test.ts` |
| Background jobs (keepalive + retenção) | [FEAT-0013](features/FEAT-0013-background-jobs.md) | N/A (consulta no [admin](frontend/pages/admin.md)) | [api-keepalive](backend/api-keepalive.md), [background-jobs](backend/background-jobs.md) | [background_job_executions](database/background_job_executions.md), [triggers](database/triggers.md) | [security-model](security/security-model.md) | `api/keepalive.test.ts`, `background-jobs.test.ts` |
| PWA / multi-dispositivo | [FEAT-0014](features/FEAT-0014-pwa.md) | [overview](frontend/overview.md) (seção PWA) | N/A | N/A | N/A | NONE |

## Notas de navegação (componentes fora das linhas)

- **Página Sobre:** conteúdo institucional — documentada em [frontend/pages/sobre](frontend/pages/sobre.md); não elevada a feature (sem regras de negócio).
- **CLI e script de migrations:** ferramentas de operação — [backend/cli](backend/cli.md); não são feature de usuário final.
- **RPCs órfãs** (`dashboard_hoje`, `dashboard_ultimos_dias`): alcançáveis por [database/rpc](database/rpc.md).
- **`ConcederAcessoModal`** (componente sem consumidor — fato Fase 5): documentado em [frontend/components/login-as](frontend/components/login-as.md).
- **Product & Domain:** [product/overview](product/overview.md), [product/glossary](product/glossary.md), [domain/domain-model](domain/domain-model.md), [domain/business-rules](domain/business-rules.md) — base conceitual de todas as linhas.
- **Testing:** [testing/testing-strategy](testing/testing-strategy.md) — infraestrutura e resultados.

## Regras de manutenção

- Auditado em toda fase e em toda promoção de feature (checklist — `CONVENTIONS.md`).
- Linha sem links = pendência explícita — nunca preencher sem evidência.
- Mudança de comportamento → atualizar a linha no mesmo fluxo de mudança.
- Capabilities propostas NÃO entram aqui (ver `README.md`).
