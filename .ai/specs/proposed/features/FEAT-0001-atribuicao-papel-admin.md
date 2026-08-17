# FEAT-0001 — Fluxo de atribuição de papel admin

**Type:** FEAT
**Status:** PROPOSED
**Issue:** #11
**Title:** Fluxo de atribuição de papel admin

## Problem

O papel `admin` (`usuarios.role = 'admin'`) concede privilégios significativos (painel, remoção de globais), mas NÃO existe fluxo de atribuição na aplicação — como o papel é concedido hoje é UNKNOWN (U-7.2).

## Current State

`usuarios.role` default `'user'`; `is_admin_user` verifica `role='admin'`; nenhum código de UI/service altera `role` (o service `toggleRoleUsuario` existe mas a UI não o usa); o RLS permite ao usuário atualizar a PRÓPRIA linha incluindo `role` (fato — security-model.md) `[CONFIRMED: code, database]`.

## Proposed State

Avaliar a criação de um fluxo explícito e restrito de atribuição/remoção do papel admin (decisão TBD — ver Alternatives).

## Motivation

- **FACTUAL:** ausência de fluxo documentado (U-7.2); `toggleRoleUsuario` já existe no service sem uso na UI `[CONFIRMED: code]`.
- **ASSUMPTION:** um fluxo explícito reduziria dependência de intervenção manual no banco (hipótese não validada).

## Evidence

- U-7.2 (análise 23); R-003 (análise 23); `admin.service.ts` (`toggleRoleUsuario`); security-model.md (fato da política UPDATE).

## Scope

Fluxo de gestão de papéis (UI admin e/ou CLI) + regra de quem pode atribuir.

## Out of Scope

Redefinição do modelo de papéis (ex.: múltiplos papéis); auditoria de acessos.

## Impacted Features

[FEAT-0012 Painel administrativo](../../current/features/FEAT-0012-painel-administrativo.md)

## Impacted Business Rules

BR-016

## Impacted Architecture / Frontend / Backend

Frontend: admin; Backend: N/A (ou novo RPC — TBD); Database: usuarios

## Impacted Security

[security-model](../../current/security/security-model.md) (papéis; política UPDATE)

## Impacted Tests

`admin.service.test.ts` (toggleRoleUsuario já testado no service)

## Dependencies

SEC-0001 (relacionado — autorização de funções)

## Risks

- Fato atual: usuário pode alterar a própria `role` via RLS — qualquer solução deve considerar essa política (risco a avaliar, sem correção nesta fase).

## Alternatives

A — UI administrativa para atribuir/remover role · B — comando CLI dedicado · C — manter atribuição manual no banco (status quo documentado)
**Decision:** TBD

## Open Questions

Quem pode atribuir admin? Papel deve ser revogável pelo próprio admin?

## Acceptance Criteria

TBD (depende da alternativa escolhida): fluxo documentado; testes; atualização de specs (BR-016, security-model).

## Evidence / References

`.ai/.temp/analyses/23-documentacao-product-domain.md` (U-7.2, R-003); `.ai/specs/current/security/security-model.md`
