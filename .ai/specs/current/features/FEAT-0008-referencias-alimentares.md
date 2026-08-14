# Feature Spec: Referências alimentares

**ID:** FEAT-0008
**Tipo:** Current
**Status:** Implementada
**Última verificação:** 2026-08-13 (commit 6323664)

## Purpose

Gestão do catálogo de alimentos com fenilalanina por 100g: busca, filtros, ordenação e paginação; criação/edição; favoritos; desativação/reativação/remoção — com regras distintas para referências globais (ANVISA/admin) e pessoais.

## Actors

- Usuário; Delegado; Admin

## Preconditions

- Usuário ativo definido

## Main Flow

1. Página lista referências com busca debounced, filtros (inativas/favoritas/customizadas — aplicados no SERVIDOR), ordenação (nome/fenil) e paginação client-side (10/20/50/100) `[CONFIRMED: code — Referencias.tsx, useReferencias.ts]`.
2. Criar/editar via `ModalReferencia` (nome + fenil; título dinâmico; validação NaN) `[CONFIRMED: code]`.
3. Favoritar (estrela) com reordenação client-side e rollback em erro `[CONFIRMED: code — useReferencias.ts:126-168]`.
4. Remover: confirm com aviso "⚠️ Se houver registros associados, ela será apenas desativada." → RPC decide soft/hard delete; fallback UI para FK 23503 `[CONFIRMED: code, database]`.
5. Reativar: `RotateCcw` (visível só para inativas com permissão) → `confirm` → RPC `ativar_referencia` `[CONFIRMED: code]`.

## Alternative Flows

- Criação inline a partir do modal de registro (FEAT-0003).
- Admin gerencia referências globais (inclusive remoção) `[CONFIRMED: security]`.

## Error Flows

- Alertas exatos: "Informe um valor numérico válido para fenilalanina.", "Você não tem permissão para editar esta referência.", "Já existe uma referência com esse nome." (REFERENCIA_DUPLICADA, modal permanece aberto), "Erro ao salvar/remover referência.", "Esta referência possui registros associados... DESATIVADA..." `[CONFIRMED: code — Referencias.tsx:88-143]`.
- Erro de carregamento: box estático "Erro ao carregar referências" `[CONFIRMED: code]`.

## Business Rules

- [BR-011](../domain/business-rules.md), [BR-014](../domain/business-rules.md), [BR-015](../domain/business-rules.md), [BR-017](../domain/business-rules.md), [BR-018](../domain/business-rules.md), [BR-023](../domain/business-rules.md), [BR-024](../domain/business-rules.md), [BR-031](../domain/business-rules.md), [BR-032](../domain/business-rules.md)

## Frontend

- [pages/referencias](../frontend/pages/referencias.md), [components/modal-referencia](../frontend/components/modal-referencia.md)
- `useReferencias`, `referencias.service`, `useLayoutPerfil`, `layout.service`

## Backend

- RPCs: [ativar_referencia / remover_ou_desativar_referencia](../database/rpc.md) (via PostgREST)

## Database

- [referencias](../database/referencias.md), [referencias_favoritas](../database/referencias_favoritas.md), [registros](../database/registros.md) (vínculo), [triggers](../database/triggers.md) (normalização + limpeza de favoritos)

## Security

- [security-model](../security/security-model.md) (matriz de referencias; globais × pessoais; delegado)

## Tests

- `referencias.service.test.ts` (4: get/create ok/erro), `useReferencias.test.ts` (4), suítes reais `rpc-ativar` (T2.0–T2.5) e `rpc-remover` (T3.0–T3.8)
- **Coverage status:** PARTIALLY TESTED (update/activate/remove/favorito sem teste de service; página e políticas de favoritas sem teste)

## Dependencies

- FEAT-0001, FEAT-0012 (gestão admin de globais)

## Related Features

- [FEAT-0003 Registro](FEAT-0003-registro-diario-consumo.md), [FEAT-0012 Admin](FEAT-0012-painel-administrativo.md)

## Evidence

- E1 — `Referencias.tsx`, `useReferencias.ts`, `referencias.service.ts` `[CONFIRMED: code]`
- E2 — Tabela/policies/RPCs: catálogo + migrations `[CONFIRMED: database, migration]`

## Unknowns

- Nenhum.
