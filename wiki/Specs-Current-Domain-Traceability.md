# Traceability — Business Rule × Implementation × Spec × Test

**Última verificação:** 2026-09-07 (FEAT-0017 — BR-038–047 adicionadas; BR-023/024/026/027 refletem ressalvas do sync)

Índice/matriz de rastreabilidade VERSIONADA (consolidação da Fase 12 — antes vivia apenas em `.ai/.temp/analyses/23`). Responde: qual implementação realiza a BR? qual spec documenta? qual teste cobre? qual o estado de cobertura?

**Status de cobertura:** `tested` = coberto por teste real/mockado com cenários · `partial` = parte dos cenários · `none` = sem teste identificado. Não inventar testes — coluna Testes reflete os arquivos reais (Fase 6).

| Rule | Tipo | Implementation | Spec | Tests | Coverage |
|---|---|---|---|---|---|
| BR-001 | cálculo | `AdicionarRegistro.tsx:94-95` | [business-rules.md](Specs-Current-Domain-Business-Rules) · [adicionar-registro](Specs-Current-Frontend-Components-Adicionar-Registro) | `useCreateRegistro.test.tsx` (hook; fórmula no componente) | partial |
| BR-002 | cálculo | `Dashboard.tsx:47` | [dashboard](Specs-Current-Frontend-Pages-Dashboard) | — | none |
| BR-003 | cálculo | `Dashboard.tsx:173` | idem | — | none |
| BR-004 | UI | `Dashboard.tsx:220-233` | idem | — | none |
| BR-005 | cálculo | `Historico.tsx:46-52,137-172` | [historico](Specs-Current-Frontend-Pages-Historico) | — | none |
| BR-006 | cálculo | `estatisticas.service.ts:31-73` | [estatisticas](Specs-Current-Frontend-Pages-Estatisticas) | `estatisticas.service.test.ts`, `useEstatisticas.test.ts` | tested |
| BR-007 | cálculo | `Exames.tsx:82-97` | [exames](Specs-Current-Frontend-Pages-Exames) | — | none |
| BR-008 | UI | `Exames.tsx:334-336,386-388` | idem | — | none |
| BR-009 | cálculo | `admin.service.ts:16,86` | [admin](Specs-Current-Frontend-Pages-Admin) | `admin.service.test.ts` | tested |
| BR-010 | validação | `AdicionarRegistro.tsx:89,132` | [adicionar-registro](Specs-Current-Frontend-Components-Adicionar-Registro) | — | none |
| BR-011 | validação | `ModalReferencia.tsx:48` | [modal-referencia](Specs-Current-Frontend-Components-Modal-Referencia) | services (parcial) | partial |
| BR-012 | validação | `Exames.tsx:44-56` | [exames](Specs-Current-Frontend-Pages-Exames) | — | none |
| BR-013 | validação | `delegar-acesso/index.ts:141-146` + policy | [security-model](Specs-Current-Security-Security-Model) | — | none |
| BR-014 | ownership | policies RLS | [security-model](Specs-Current-Security-Security-Model) | T1–T3 (parcial) | partial |
| BR-015 | delegação | 15 policies + 2 RPCs | idem | T2.3, T3.4 | partial |
| BR-016 | autorização | `is_admin_user` | idem · [rpc](Specs-Current-Database-Rpc) | T1/T2/T3 | tested |
| BR-017 | autorização | RPC + policy | [rpc](Specs-Current-Database-Rpc) · [referencias](Specs-Current-Database-Referencias) | T3.6, T3.7 | tested |
| BR-018 | lifecycle | RPC `remover_ou_desativar_referencia` + policy (sem fallback 23503 desde ENH-0004) | [rpc](Specs-Current-Database-Rpc) · [referencias](Specs-Current-Frontend-Pages-Referencias) | T3.3, T3.7 | tested |
| BR-019 | validação | policy INSERT | [registros](Specs-Current-Database-Registros) | — | none |
| BR-020 | delegação | índice parcial | [delegacoes_acesso](Specs-Current-Database-Delegacoes_acesso) | — | none |
| BR-021 | delegação | edge function + policy | [edge-function-delegar-acesso](Specs-Current-Backend-Edge-Function-Delegar-Acesso) | — | none |
| BR-022 | delegação | edge function + `AuthContext` | [security-model](Specs-Current-Security-Security-Model) | — | none |
| BR-023 | UI | `Referencias.tsx:54-58,66-127` + guard do service | [referencias](Specs-Current-Frontend-Pages-Referencias) | service (guarda de global) | partial |
| BR-024 | lifecycle | RPCs + policy (sem trigger de favoritos desde ENH-0004) | [rpc](Specs-Current-Database-Rpc) · [triggers](Specs-Current-Database-Triggers) | T2/T3 (parcial) | partial |
| BR-025 | lifecycle | `handle_new_user` | [triggers](Specs-Current-Database-Triggers) · [usuarios](Specs-Current-Database-Usuarios) | indireto (AV) | partial |
| BR-026 | exclusão | `delete-account/index.ts` | [edge-function-delete-account](Specs-Current-Backend-Edge-Function-Delete-Account) | — | none |
| BR-027 | retenção | `fn_trim_background_job_executions` + trigger | [triggers](Specs-Current-Database-Triggers) | — | none |
| BR-028 | UI | `Dashboard.tsx:75` + `ConsentimentoLGPD.tsx` | [consentimento-lgpd](Specs-Current-Frontend-Components-Consentimento-Lgpd) | `dashboard.service.test.ts` (parcial) | partial |
| BR-029 | exportação/exclusão | `Perfil.tsx:72-160` | [perfil](Specs-Current-Frontend-Pages-Perfil) | — | none |
| BR-030 | UI | `AdicionarRegistro.tsx:53-84` | [adicionar-registro](Specs-Current-Frontend-Components-Adicionar-Registro) | — | none |
| BR-031 | UI | `useReferencias.ts:132-179` | [referencias](Specs-Current-Frontend-Pages-Referencias) | hook (parcial) | partial |
| BR-032 | UI | `useReferencias.ts:28-56,182-194` | idem | service/hook (parcial) | partial |
| BR-033 | cálculo | `dashboard.service.ts:34-43` | [dashboard](Specs-Current-Frontend-Pages-Dashboard) | `dashboard.service.test.ts` | tested |
| BR-034 | lifecycle (identidade) | guard `referencias.service.ts:242-261` + `Referencias.tsx:66-94` (arquivar+criar) | [business-rules](Specs-Current-Domain-Business-Rules) · [referencias](Specs-Current-Database-Referencias) | `referencias.service.test.ts` (guarda de global) | partial |
| BR-035 | modelo de dados | migrations 20260904000000/020000/030000 (canônico revisto) + `lib/referencias.ts` + service (busca nome/marca) | [referencias](Specs-Current-Database-Referencias) · [modal-referencia](Specs-Current-Frontend-Components-Modal-Referencia) | `lib/referencias.test.ts`, `referencias.service.test.ts` | tested |
| BR-036 | lifecycle | ausência de trigger (DROPs na 20260904000000) | [triggers](Specs-Current-Database-Triggers) · [referencias_favoritas](Specs-Current-Database-Referencias_favoritas) | — | none |
| BR-037 | lifecycle | RPC `remover_ou_desativar_referencia` (20260904000000, linhas 96-164) | [rpc](Specs-Current-Database-Rpc) · [referencias](Specs-Current-Database-Referencias) | T3.7 | tested |
| BR-038 | escopo (globals only) | motor `src/shared/referencias-sync/` (engine/compare) + RPCs aplicar/decidir/reverter/restaurar | [business-rules](Specs-Current-Domain-Business-Rules) · [referencia_syncs](Specs-Current-Database-Referencia_syncs) · [rpc](Specs-Current-Database-Rpc) | suítes do motor + REAL M4–M6 | tested |
| BR-039 | lifecycle (bootstrap) | `compare.ts:117-122` (derivarModoSync) + validação aborta antes de efeito | [business-rules](Specs-Current-Domain-Business-Rules) · [referencia_syncs](Specs-Current-Database-Referencia_syncs) | `compare.test.ts`, `engine.test.ts` + REAL M4 | tested |
| BR-040 | lifecycle (sem UPDATE in-place) | RPCs aplicar/decidir (20260906000000; guardas de estado) | [business-rules](Specs-Current-Domain-Business-Rules) · [rpc](Specs-Current-Database-Rpc) | `rpc-referencias-sync.test.ts` | tested |
| BR-041 | matching | `canonical.ts` (chaveRef) + índice único de identidade (ENH-0004) | [business-rules](Specs-Current-Domain-Business-Rules) · [referencias](Specs-Current-Database-Referencias) | `canonical.test.ts` | tested |
| BR-042 | lifecycle (arquivada/bloqueio manual) | `compare.ts:30-33` (reaparição) + seed 20260907000000 (pre_sync_inativa) | [business-rules](Specs-Current-Domain-Business-Rules) · [referencia_eventos](Specs-Current-Database-Referencia_eventos) | `compare.test.ts`, `rpc-referencias-sync-seed.test.ts` | tested |
| BR-043 | curadoria | `decidir_pendencia_referencia` (20260906000000:226-450) | [business-rules](Specs-Current-Domain-Business-Rules) · [referencia_sync_pendencias](Specs-Current-Database-Referencia_sync_pendencias) | `rpc-referencias-sync.test.ts` | tested |
| BR-044 | validação | `src/shared/powerbi/validate.ts` (check 4 — grupos conflitantes rejeitam todas as linhas do grupo) | [business-rules](Specs-Current-Domain-Business-Rules) · [api-referencias-sync](Specs-Current-Backend-Api-Referencias-Sync) | `validate.test.ts` | tested |
| BR-045 | lifecycle/concorrência | single-flight índice parcial (20260905000000:90-92) + locks de rollback (20260906010000) | [business-rules](Specs-Current-Domain-Business-Rules) · [referencia_syncs](Specs-Current-Database-Referencia_syncs) | REAL M1.1–M1.5 (single-flight), M4 | tested |
| BR-046 | retenção/recuperação | `trg_trim_referencia_backups` (20260905000000:260-279) + reverter/restaurar (20260906010000) | [business-rules](Specs-Current-Domain-Business-Rules) · [referencia_backups](Specs-Current-Database-Referencia_backups) | `rpc-referencias-sync-rollback.test.ts` | tested |
| BR-047 | auditoria | `referencia_eventos` + `trg_auditar_is_ativa_manual` + ator Sistema (email fixo) | [business-rules](Specs-Current-Domain-Business-Rules) · [referencia_eventos](Specs-Current-Database-Referencia_eventos) | suítes REAL M1–M6 (eventos, GUC, actor) | tested |

**Resumo:** 47 BRs — 18 tested · 11 partial · 18 none. Recontagem em 2026-09-07 (FEAT-0017): +10 BRs (BR-038–047), todas com teste identificado (suítes do motor + REAL M1–M6). Recontagem em 2026-09-04: o resumo anterior (8 partial · 19 none) não batia com as linhas da tabela (9 partial · 18 none); corrigido ao adicionar BR-034–037. Fontes de gaps e propostas: `proposed/testing/TEST-*` e `.ai/.temp/analyses/22-auditoria-testes.md`.

## Uso

- Consulta rápida: feature → BRs (na FEAT) → esta matriz → implementação + testes.
- Atualização: quando uma BR mudar de implementação, teste ou status — no mesmo fluxo da mudança (matriz de sincronização em `CONVENTIONS.md`).

## Evidências

- E1 — Dados consolidados da Fase 6 (testes) e Fase 7 (BRs); conferidos contra código em 2026-08-13 `[CONFIRMED: code, test]`

## Veja também

- [business-rules.md](Specs-Current-Domain-Business-Rules), [../system-map.md](Specs-Current-System-Map), [../testing/testing-strategy.md](Specs-Current-Testing-Testing-Strategy)
