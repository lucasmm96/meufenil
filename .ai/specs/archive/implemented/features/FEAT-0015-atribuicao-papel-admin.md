# FEAT-0015 — Fluxo de atribuição de papel admin

**Type:** FEAT
**Status:** IMPLEMENTED
**Issue:** #11
**Title:** Fluxo de atribuição de papel admin
**Created on:** 2026-08-14
**Decision:** A — UI administrativa no painel admin existente (FEAT-0012), com RPC SECURITY DEFINER como único caminho de escrita para `role`. Autorizado 2026-10-02.
**Approved by:** Lucas Martins Menezes
**Approved on:** 2026-10-02
**Implemented Through:** PR #113 (merge `6b33f37`, development, 2026-10-02)

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

- U-7.2 (análise 23); R-003 (análise 23); `admin.service.ts` (`toggleRoleUsuario`); security-model.md (fato da política UPDATE); `.ai/.temp/analyses/23-documentacao-product-domain.md`; `.ai/specs/current/security/security-model.md`.

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
**Decision:** A — UI administrativa no painel admin existente (FEAT-0012), com RPC SECURITY DEFINER como único caminho de escrita para `role`. Autorizado 2026-10-02.

## Open Questions

~~Quem pode atribuir admin?~~ Resolvido: apenas via RPC SECURITY DEFINER chamada por sessão admin autenticada (service_role executa o UPDATE). Escalada lateral bloqueada — nenhum admin pode promover outro via UI (RPC exige `is_admin_user` + `auth.uid() ≠ alvo_id`; coluna `role` com REVOKE UPDATE de `authenticated`).

~~Papel deve ser revogável pelo próprio admin?~~ Resolvido: não — RPC bloqueia auto-rebaixamento (`auth.uid() = alvo_id` → exceção).

## Acceptance Criteria

- AC1: botão "Tornar admin" / "Remover admin" visível na lista de usuários do painel admin para o admin logado; desabilitado na própria linha.
- AC2: chamada ao RPC `toggle_role_usuario(alvo_id, novo_role)` com sucesso atualiza `role` e recarrega a lista.
- AC3: tentativa de alterar o próprio role retorna erro (`Não é permitido alterar o próprio papel`).
- AC4: não-admin recebe erro de permissão negada ao chamar o RPC.
- AC5: `novo_role` fora de `{'admin', 'user'}` retorna erro de papel inválido.
- AC6: UPDATE direto de `role` via sessão `authenticated` é bloqueado pelo banco (REVOKE column-level).
- AC7: specs (BR-016, security-model, rpc.md, usuarios.md) atualizadas no mesmo commit.
