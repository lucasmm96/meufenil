# Traceability — Business Rule × Implementation × Spec × Test

**Última verificação:** 2026-08-13 (commit 6323664)

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
| BR-010 | validação | `AdicionarRegistro.tsx:92,318-327` | [adicionar-registro](../frontend/components/adicionar-registro.md) | — | none |
| BR-011 | validação | `ModalReferencia.tsx:31-39` | [modal-referencia](../frontend/components/modal-referencia.md) | services (parcial) | partial |
| BR-012 | validação | `Exames.tsx:44-56` | [exames](../frontend/pages/exames.md) | — | none |
| BR-013 | validação | `delegar-acesso/index.ts:141-146` + policy | [security-model](../security/security-model.md) | — | none |
| BR-014 | ownership | policies RLS | [security-model](../security/security-model.md) | T1–T3 (parcial) | partial |
| BR-015 | delegação | 15 policies + 2 RPCs | idem | T2.3, T3.4 | partial |
| BR-016 | autorização | `is_admin_user` | idem · [rpc](../database/rpc.md) | T1/T2/T3 | tested |
| BR-017 | autorização | RPC + policy | [rpc](../database/rpc.md) · [referencias](../database/referencias.md) | T3.6, T3.7 | tested |
| BR-018 | lifecycle | RPC + policy + UI fallback | [rpc](../database/rpc.md) · [referencias](../frontend/pages/referencias.md) | T3.3 | tested |
| BR-019 | validação | policy INSERT | [registros](../database/registros.md) | — | none |
| BR-020 | delegação | índice parcial | [delegacoes_acesso](../database/delegacoes_acesso.md) | — | none |
| BR-021 | delegação | edge function + policy | [edge-function-delegar-acesso](../backend/edge-function-delegar-acesso.md) | — | none |
| BR-022 | delegação | edge function + `AuthContext` | [security-model](../security/security-model.md) | — | none |
| BR-023 | UI | `Referencias.tsx:44-48` | [referencias](../frontend/pages/referencias.md) | — | none |
| BR-024 | lifecycle | RPCs + trigger + policy | [rpc](../database/rpc.md) · [triggers](../database/triggers.md) | T2/T3 (parcial; trigger sem teste) | partial |
| BR-025 | lifecycle | `handle_new_user` | [triggers](../database/triggers.md) · [usuarios](../database/usuarios.md) | indireto (AV) | partial |
| BR-026 | exclusão | `delete-account/index.ts` | [edge-function-delete-account](../backend/edge-function-delete-account.md) | — | none |
| BR-027 | retenção | `fn_trim_background_job_executions` + trigger | [triggers](../database/triggers.md) | — | none |
| BR-028 | UI | `Dashboard.tsx:75` + `ConsentimentoLGPD.tsx` | [consentimento-lgpd](../frontend/components/consentimento-lgpd.md) | `dashboard.service.test.ts` (parcial) | partial |
| BR-029 | exportação/exclusão | `Perfil.tsx:72-160` | [perfil](../frontend/pages/perfil.md) | — | none |
| BR-030 | UI | `AdicionarRegistro.tsx:53-84` | [adicionar-registro](../frontend/components/adicionar-registro.md) | — | none |
| BR-031 | UI | `useReferencias.ts:126-168` | [referencias](../frontend/pages/referencias.md) | hook (parcial) | partial |
| BR-032 | UI | `useReferencias.ts:35-61` | idem | service/hook (parcial) | partial |
| BR-033 | cálculo | `dashboard.service.ts:34-43` | [dashboard](../frontend/pages/dashboard.md) | `dashboard.service.test.ts` | tested |

**Resumo:** 33 BRs — 6 tested · 8 partial · 19 none. Fontes de gaps e propostas: `proposed/testing/TEST-*` e `.ai/.temp/analyses/22-auditoria-testes.md`.

## Uso

- Consulta rápida: feature → BRs (na FEAT) → esta matriz → implementação + testes.
- Atualização: quando uma BR mudar de implementação, teste ou status — no mesmo fluxo da mudança (matriz de sincronização em `CONVENTIONS.md`).

## Evidências

- E1 — Dados consolidados da Fase 6 (testes) e Fase 7 (BRs); conferidos contra código em 2026-08-13 `[CONFIRMED: code, test]`

## Veja também

- [business-rules.md](business-rules.md), [../system-map.md](../system-map.md), [../testing/testing-strategy.md](../testing/testing-strategy.md)
