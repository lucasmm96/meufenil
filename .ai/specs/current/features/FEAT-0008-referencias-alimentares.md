# Feature Spec: Referências alimentares

**ID:** FEAT-0008
**Tipo:** Current
**Status:** Implementada
**Última verificação:** 2026-09-04 (ENH-0004 — modelo canônico: `marca` separada, identidade imutável de globais, arquivamento sem perda de favoritos; canônico de marca revisto 2026-09-04 — sem marca = em branco)

## Purpose

Gestão do catálogo de alimentos com fenilalanina por 100g: busca, filtros, ordenação e paginação; criação/edição; favoritos; desativação/reativação/remoção — com regras distintas para referências globais (ANVISA/admin) e pessoais. Desde a ENH-0004, nome e marca são atributos separados (canônico revisto em 2026-09-04: marca não declarada = em branco `''`; `'Produto In Natura'` apenas como marca declarada pela fonte) e a identidade de globais é imutável (edição = arquivar + criar).

## Actors

- Usuário; Delegado; Admin

## Preconditions

- Usuário ativo definido

## Main Flow

1. Página lista referências com busca debounced (por nome OU marca — server-side), filtros (inativas/favoritas/customizadas — aplicados no SERVIDOR), ordenação (nome/fenil) e paginação client-side (10/20/50/100); desktop exibe Nome e Marca em colunas próprias (Marca ao lado de Nome, desde 2026-09-04); mobile combina via `nomeComMarca` quando há marca declarada `[CONFIRMED: code — Referencias.tsx, useReferencias.ts:28-56,182-194]`.
2. Criar/editar via `ModalReferencia` (nome + marca + fenil; marca opcional — em branco permanece EM BRANCO (não declarada), canônico revisto 2026-09-04; título dinâmico; validação NaN) `[CONFIRMED: code — ModalReferencia.tsx:48,90-107]`.
3. Favoritar (estrela) com reordenação client-side e rollback em erro `[CONFIRMED: code — useReferencias.ts:132-179]`.
4. Editar referência GLOBAL: confirm de arquivamento ("Arquivar e criar nova...") → RPC arquiva a atual → modal pré-preenchido (prop `initial` com nome/marca/fenil) para criar a nova — nunca UPDATE substantivo de global (guarda do service: `REFERENCIA_GLOBAL_IMUTAVEL`; BR-034) `[CONFIRMED: code — Referencias.tsx:66-94; referencias.service.ts:242-261]`.
5. Remover: textos distintos para global ("será arquivada... nunca são excluídas") e pessoal ("se houver registros associados, ela será apenas desativada") → service chama o RPC e trata o retorno (`'deleted'`/`'deactivated'`); SEM fallback de erro FK 23503 (eliminado na ENH-0004). Globais sempre arquivam (BR-037); pessoais: soft com vínculo, hard sem (BR-018) `[CONFIRMED: code — Referencias.tsx:96-127; referencias.service.ts:323-338]`.
6. Reativar: `RotateCcw` (visível só para inativas com permissão) → `confirm` → RPC `ativar_referencia` `[CONFIRMED: code]`.

## Alternative Flows

- Criação inline a partir do modal de registro (FEAT-0003).
- Admin gerencia referências globais (inclusive remoção) `[CONFIRMED: security]`.

## Error Flows

- Alertas exatos: "Informe um valor numérico válido para fenilalanina."; "Você não tem permissão para editar esta referência."; "Já existe uma referência ativa com esse nome e marca." (REFERENCIA_DUPLICADA — modal permanece aberto); "Referências globais não podem ser editadas..." (REFERENCIA_GLOBAL_IMUTAVEL — fluxo arquivar+criar); "Erro ao salvar/remover referência."; textos de remoção distintos global × pessoal (item 5 do Main Flow) `[CONFIRMED: code — Referencias.tsx:132-135,170-178]`.
- Erro de carregamento: box estático "Erro ao carregar referências" `[CONFIRMED: code]`.

## Business Rules

- [BR-011](../domain/business-rules.md), [BR-014](../domain/business-rules.md), [BR-015](../domain/business-rules.md), [BR-017](../domain/business-rules.md), [BR-018](../domain/business-rules.md), [BR-023](../domain/business-rules.md), [BR-024](../domain/business-rules.md), [BR-031](../domain/business-rules.md), [BR-032](../domain/business-rules.md), [BR-034](../domain/business-rules.md), [BR-035](../domain/business-rules.md), [BR-036](../domain/business-rules.md), [BR-037](../domain/business-rules.md)

## Frontend

- [pages/referencias](../frontend/pages/referencias.md), [components/modal-referencia](../frontend/components/modal-referencia.md)
- `useReferencias`, `referencias.service`, `useLayoutPerfil`, `layout.service`

## Backend

- RPCs: [ativar_referencia / remover_ou_desativar_referencia](../database/rpc.md) (via PostgREST)

## Database

- [referencias](../database/referencias.md), [referencias_favoritas](../database/referencias_favoritas.md), [registros](../database/registros.md) (vínculo), [triggers](../database/triggers.md) (nenhum trigger em `referencias` desde a ENH-0004 — os de normalização e de favoritos foram eliminados), [rpc](../database/rpc.md) (`remover_ou_desativar_referencia` redefinida na ENH-0004)

## Security

- [security-model](../security/security-model.md) (matriz de referencias; globais × pessoais; delegado)

## Tests

- `referencias.service.test.ts` (18 its: CRUD, busca nome+marca, sanitização da identidade, guarda de global), `useReferencias.test.ts` (5), `Referencias.test.tsx` (25), `lib/referencias.test.ts` (12 — novo na ENH-0004: `normalizarMarca`, `extrairMarcaDoNome`, `nomeComMarca`), suítes reais `rpc-ativar` (T2.0–T2.5) e `rpc-remover` (T3.0–T3.8, T3.7 = ENH-0004: global sempre arquiva — condicionado a `isEnh0004MigrationApplied`)
- **Coverage status:** PARTIALLY TESTED (fluxo arquivar+criar da página e desativação com favoritos preservados sem teste dedicado)

## Dependencies

- FEAT-0001, FEAT-0012 (gestão admin de globais)

## Related Features

- [FEAT-0003 Registro](FEAT-0003-registro-diario-consumo.md), [FEAT-0012 Admin](FEAT-0012-painel-administrativo.md)

## Evidence

- E1 — `Referencias.tsx`, `useReferencias.ts`, `referencias.service.ts` `[CONFIRMED: code]`
- E2 — Tabela/policies/RPCs: catálogo + migrations `[CONFIRMED: database, migration]`

## Unknowns

- Nenhum.
