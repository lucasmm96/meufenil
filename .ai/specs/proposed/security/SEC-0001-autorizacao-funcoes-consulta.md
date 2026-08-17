# SEC-0001 — Autorização das funções de consulta sem verificação interna

**Type:** SEC
**Status:** PROPOSED
**Issue:** #14
**Title:** Autorização das funções de consulta sem verificação interna

## Problem

Três funções SECURITY DEFINER de consulta não possuem verificação interna de autorização, apesar de nomes/conteúdo sensíveis: `get_estatisticas_admin` (agregados globais), `dashboard_hoje` e `dashboard_ultimos_dias` (aceitam qualquer `uid`) — e os grants de EXECUTE alcançam todas as roles.

## Current State

Fatos documentados na Fase 3: as funções existem como descritas; `get_estatisticas_admin` é chamada pelo painel admin (`admin.service.ts:75`); as dashboard_* não têm chamadores; grants amplos por default privileges `[CONFIRMED: database, code — rpc.md, security-model.md seção 10]`.

## Proposed State

AVALIAR restrição de acesso a essas funções (grants ou verificação interna) — decisão arquitetural, TBD. Não é correção imediata.

## Motivation

- **FACTUAL:** inconsistência documentada entre nome/finalidade ("admin", dados por usuário) e ausência de verificação; grants amplos são fato.
- **ASSUMPTION:** restringir reduziria exposição desnecessária (hipótese — a severidade não foi avaliada formalmente; nenhuma exploração documentada).

## Evidence

`.ai/specs/current/security/security-model.md` (seção 10 — RPC security); `.ai/specs/current/database/rpc.md`; Fase 3 (UNKNOWNs U-2.5/U-3.1 relacionados).

## Scope

get_estatisticas_admin, dashboard_hoje, dashboard_ultimos_dias (+ reavaliar grants de funções de trigger, se for o caso).

## Out of Scope

Reabertura da auditoria de segurança v1.6.1; alteração das policies RLS.

## Impacted Features

FEAT-0005 (dashboard), FEAT-0012 (admin)

## Impacted Security / Database

security-model.md; database/rpc.md

## Impacted Tests

GAP-012 (testes de autorização dessas funções)

## Dependencies

REF-0002 (destino das dashboard_* — avaliação conjunta).

## Risks

Mudança de grants pode quebrar chamadores (admin.service usa anon client com RPC — o RPC é executado via PostgREST com o JWT do usuário; restrição por grants afetaria quem pode chamar).

## Alternatives

A — restringir grants (ex.: authenticated/admin) · B — adicionar verificação interna (is_admin_user / uid próprio) · C — manter status quo documentado
**Decision:** TBD (decisão humana/arquitetural)

## Open Questions

Qual o princípio desejado para funções de consulta sensíveis? (U-2.5/U-3.1 ajudariam a responder)

## Acceptance Criteria

Decisão aplicada; specs (rpc.md, security-model) atualizadas; testes de autorização (TEST-0002).

## Evidence / References

`.ai/.temp/analyses/19-documentacao-security.md`; `.ai/.temp/analyses/25-documentacao-architecture-adrs.md` (ADR-0010)
