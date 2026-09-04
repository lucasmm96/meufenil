# Traceability — Business Rule × Implementation × Spec × Test

**Última verificação:** 2026-09-04 (ENH-0004 — BR-018/023/024 atualizadas; BR-034–037 adicionadas)

Índice/matriz de rastreabilidade VERSIONADA (consolidação da Fase 12 — antes vivia apenas em `.ai/.temp/analyses/23`). Responde: qual implementação realiza a BR? qual spec documenta? qual teste cobre? qual o estado de cobertura?

**Status de cobertura:** `tested` = coberto por teste real/mockado com cenários · `partial` = parte dos cenários · `none` = sem teste identificado. Não inventar testes — coluna Testes reflete os arquivos reais (Fase 6).

| Rule | Tipo | Implementation | Spec | Tests | Coverage |
|---|---|---|---|---|---|
| BR-001 | cálculo | `AdicionarRegistro.tsx:94-95` | [business-rules.md](business-rules.md) · [adicionar-registro](../frontend/components/adicionar-registro.md) | `useCreateRegistro.test.tsx` (hook; fórmula no componente) | partial |
| BR-002 | cálculo | `Dashboard.tsx:47` | [dashboard](../frontend/pages/dashboard.md) | — | none |
| BR-003 | cálculo | `Dashboard.tsx:173` | idem | — | none |
| BR-004 | UI | `Dashboard.tsx:220-233` | idem | — | none |
| BR-005 | cálculo | `Historico.tsx:46-52,137-172` | [historico](../frontend/pages/historico.md) | — | none |
| BR-006 | cálculo | `estatisticas.service.ts:31-73` | [estatisticas](../frontend/pages/estatisticas.md) | `estatisticas.service.test.ts`, `useEstatisticas.test.ts` | tested |
| BR-007 | cálculo | `Exames.tsx:82-97` | [exames](../frontend/pages/exames.md) | — | none |
| BR-008 | UI | `Exames.tsx:334-336,386-388` | idem | — | none |
| BR-009 | cálculo | `admin.service.ts:16,86` | [admin](../frontend/pages/admin.md) | `admin.service.test.ts` | tested |
| BR-010 | validação | `AdicionarRegistro.tsx:89,132` | [adicionar-registro](../frontend/components/adicionar-registro.md) | — | none |
| BR-011 | validação | `ModalReferencia.tsx:48` | [modal-referencia](../frontend/components/modal-referencia.md) | services (parcial) | partial |
| BR-012 | validação | `Exames.tsx:44-56` | [exames](../frontend/pages/exames.md) | — | none |
| BR-013 | validação | `delegar-acesso/index.ts:141-146` + policy | [security-model](../security/security-model.md) | — | none |
| BR-014 | ownership | policies RLS | [security-model](../security/security-model.md) | T1–T3 (parcial) | partial |
| BR-015 | delegação | 15 policies + 2 RPCs | idem | T2.3, T3.4 | partial |
| BR-016 | autorização | `is_admin_user` | idem · [rpc](../database/rpc.md) | T1/T2/T3 | tested |
| BR-017 | autorização | RPC + policy | [rpc](../database/rpc.md) · [referencias](../database/referencias.md) | T3.6, T3.7 | tested |
| BR-018 | lifecycle | RPC `remover_ou_desativar_referencia` + policy (sem fallback 23503 desde ENH-0004) | [rpc](../database/rpc.md) · [referencias](../frontend/pages/referencias.md) | T3.3, T3.7 | tested |
| BR-019 | validação | policy INSERT | [registros](../database/registros.md) | — | none |
| BR-020 | delegação | índice parcial | [delegacoes_acesso](../database/delegacoes_acesso.md) | — | none |
| BR-021 | delegação | edge function + policy | [edge-function-delegar-acesso](../backend/edge-function-delegar-acesso.md) | — | none |
| BR-022 | delegação | edge function + `AuthContext` | [security-model](../security/security-model.md) | — | none |
| BR-023 | UI | `Referencias.tsx:54-58,66-127` + guard do service | [referencias](../frontend/pages/referencias.md) | service (guarda de global) | partial |
| BR-024 | lifecycle | RPCs + policy (sem trigger de favoritos desde ENH-0004) | [rpc](../database/rpc.md) · [triggers](../database/triggers.md) | T2/T3 (parcial) | partial |
| BR-025 | lifecycle | `handle_new_user` | [triggers](../database/triggers.md) · [usuarios](../database/usuarios.md) | indireto (AV) | partial |
| BR-026 | exclusão | `delete-account/index.ts` | [edge-function-delete-account](../backend/edge-function-delete-account.md) | — | none |
| BR-027 | retenção | `fn_trim_background_job_executions` + trigger | [triggers](../database/triggers.md) | — | none |
| BR-028 | UI | `Dashboard.tsx:75` + `ConsentimentoLGPD.tsx` | [consentimento-lgpd](../frontend/components/consentimento-lgpd.md) | `dashboard.service.test.ts` (parcial) | partial |
| BR-029 | exportação/exclusão | `Perfil.tsx:72-160` | [perfil](../frontend/pages/perfil.md) | — | none |
| BR-030 | UI | `AdicionarRegistro.tsx:53-84` | [adicionar-registro](../frontend/components/adicionar-registro.md) | — | none |
| BR-031 | UI | `useReferencias.ts:132-179` | [referencias](../frontend/pages/referencias.md) | hook (parcial) | partial |
| BR-032 | UI | `useReferencias.ts:28-56,182-194` | idem | service/hook (parcial) | partial |
| BR-033 | cálculo | `dashboard.service.ts:34-43` | [dashboard](../frontend/pages/dashboard.md) | `dashboard.service.test.ts` | tested |
| BR-034 | lifecycle (identidade) | guard `referencias.service.ts:242-261` + `Referencias.tsx:66-94` (arquivar+criar) | [business-rules](business-rules.md) · [referencias](../database/referencias.md) | `referencias.service.test.ts` (guarda de global) | partial |
| BR-035 | modelo de dados | migration 20260904000000 + `lib/referencias.ts` + service (busca nome/marca) | [referencias](../database/referencias.md) · [modal-referencia](../frontend/components/modal-referencia.md) | `lib/referencias.test.ts`, `referencias.service.test.ts` | tested |
| BR-036 | lifecycle | ausência de trigger (DROPs na 20260904000000) | [triggers](../database/triggers.md) · [referencias_favoritas](../database/referencias_favoritas.md) | — | none |
| BR-037 | lifecycle | RPC `remover_ou_desativar_referencia` (20260904000000, linhas 96-164) | [rpc](../database/rpc.md) · [referencias](../database/referencias.md) | T3.7 | tested |

**Resumo:** 37 BRs — 8 tested · 11 partial · 18 none. Recontagem em 2026-09-04: o resumo anterior (8 partial · 19 none) não batia com as linhas da tabela (9 partial · 18 none); corrigido ao adicionar BR-034–037. Fontes de gaps e propostas: `proposed/testing/TEST-*` e `.ai/.temp/analyses/22-auditoria-testes.md`.

## Uso

- Consulta rápida: feature → BRs (na FEAT) → esta matriz → implementação + testes.
- Atualização: quando uma BR mudar de implementação, teste ou status — no mesmo fluxo da mudança (matriz de sincronização em `CONVENTIONS.md`).

## Evidências

- E1 — Dados consolidados da Fase 6 (testes) e Fase 7 (BRs); conferidos contra código em 2026-08-13 `[CONFIRMED: code, test]`

## Veja também

- [business-rules.md](business-rules.md), [../system-map.md](../system-map.md), [../testing/testing-strategy.md](../testing/testing-strategy.md)
