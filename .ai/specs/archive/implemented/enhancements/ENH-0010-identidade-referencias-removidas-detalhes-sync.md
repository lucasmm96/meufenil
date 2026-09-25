# ENH-0010 — Identidade das referências removidas nos detalhes técnicos do sync

**Type:** ENH
**Status:** IMPLEMENTED
**Decision:** Alternativa A (estágio `audit` separado). OQ-1: apenas `referencia_deletada` + `referencia_arquivada`. OQ-2: sem LIMIT.
**Approved by:** Lucas Martins Menezes
**Approved on:** 2026-09-25
**Title:** Identidade das referências removidas nos detalhes técnicos do sync
**Issue:** #91
**Created on:** 2026-09-25
**Implemented Through:** PR #92 (squash merge `964944c`, 2026-09-25) — estágio audit em `api/referencias-sync.ts`; spec FEAT-0017 atualizada

## Problem

O campo "Detalhes técnicos (estágios)" de um sync já mostra contagens de referências criadas, arquivadas e deletadas, mas não revela quais referências foram afetadas — impossibilitando auditoria e diagnóstico direto na interface.

## Current State

O estágio `apply` em `details.estagios` ([`current/features/FEAT-0017-sincronizacao-referencias-anvisa.md`](../current/features/FEAT-0017-sincronizacao-referencias-anvisa.md)) registra apenas contadores: `{ criadas, arquivadas, deletadas, equivalentes }`. Os dados de identidade das referências removidas ficam exclusivamente em `referencia_eventos` (tabela de auditoria), acessíveis somente via SQL direto no banco.

## Proposed State

Adicionar um estágio `audit` ao array `details.estagios` imediatamente após o `apply`, contendo a lista das referências afetadas (deletadas fisicamente ou arquivadas) com suas identidades:

```json
{
  "estagio": "audit",
  "status": "ok",
  "alteracoes": [
    { "tipo": "referencia_deletada", "referencia_id": "uuid", "identidade": { "nome": "...", "marca": "...", "fenil_mg_por_100g": 50.0 } },
    { "tipo": "referencia_arquivada", "referencia_id": "uuid", "identidade": { ... } }
  ]
}
```

Os dados de identidade são lidos de `referencia_eventos.detalhes` (JSONB gravado pela RPC `aplicar_sync_referencias` no momento do evento). O estágio é omitido quando não há alterações (`arquivadas = 0` e `deletadas = 0`).

## Motivation

- **FACTUAL:** `referencia_eventos` já contém todos os dados de identidade no campo `detalhes`, gravados pela RPC durante o apply (ENH-0009). A informação existe mas não é surfaceada na UI.
- **FACTUAL:** Após a ENH-0009, referências deletadas fisicamente deixam de existir na tabela `referencias` — o único registro de sua identidade é o evento em `referencia_eventos`.
- **ASSUMPTION:** Admins que executam syncs precisarão, com frequência, verificar quais referências foram removidas sem precisar acessar o banco diretamente.

## Evidence

- Pedido de usuário (2026-09-25) após executar o primeiro sync em produção pós-deploy da ENH-0009 (sync `32f0da39`).
- ENH-0009 (IMPLEMENTED): adicionou deleção física ao sync e coluna `deletadas` em `referencia_syncs`.

## Scope

- `api/referencias-sync.ts`: adicionar query em `referencia_eventos` após o estágio `apply` e incluir entrada `audit` em `details.estagios`.
- Somente para syncs futuros (não retroativo via código — fix retroativo do sync `32f0da39` é operação separada pontual).

## Out of Scope

- Paginação ou truncamento da lista de alterações (assumindo volume controlado; LIMIT 200 como guarda).
- Mudança no schema (`referencia_syncs`, `referencia_eventos`) — nenhuma migration necessária.
- Mudança no DTO (`referencias-sync.dto.ts`) — `details` já é `Record<string, unknown>`.
- Mudança no componente `JsonCodeBlock` ou `Admin.tsx` — o JSON já é renderizado como-está.
- Alterar histórico de syncs anteriores (fora do fix pontual solicitado).

## Impacted Features

- [`current/features/FEAT-0017-sincronizacao-referencias-anvisa.md`](../current/features/FEAT-0017-sincronizacao-referencias-anvisa.md) — seção de detalhes técnicos do estágio 7 (apply)

## Impacted Business Rules

N/A — nenhuma regra de negócio alterada; é enriquecimento de dado de auditoria existente.

## Impacted Architecture

N/A — sem impacto arquitetural; leitura adicional no mesmo fluxo existente.

## Impacted Frontend / Backend / Database / Security / Tests

- **Backend:** `api/referencias-sync.ts` — 1 query SELECT adicional após o apply
- **Frontend:** N/A — `JsonCodeBlock` renderiza o JSON como-está
- **Database:** N/A — sem migrations
- **Security:** N/A — query usa `supabase` (service_role) já presente no fluxo
- **Tests:** `api/referencias-sync.test.ts` — adicionar caso cobrindo o estágio `audit`

## Dependencies

Nenhuma. ENH-0009 é pré-requisito já IMPLEMENTED.

## Risks

- **Volume:** syncs com muitas alterações podem aumentar o tamanho de `details`. Mitigado com LIMIT 200.
- **Latência:** 1 query adicional após o apply. Impacto esperado: < 50ms (query simples por `sync_id` com índice).

## Alternatives

- **A (proposta):** Adicionar estágio `audit` em `details.estagios` na rota, lendo `referencia_eventos` pós-apply.
- **B:** Enriquecer o estágio `apply` existente com os dados (em vez de criar `audit` separado).
- **C:** Não alterar a rota; expor os dados via endpoint separado ou query dedicada na UI.

**Decision:** Alternativa A — estágio `audit` separado após `apply`. OQ-1: apenas `referencia_deletada` + `referencia_arquivada`. OQ-2: sem LIMIT. Aprovado por Lucas Martins Menezes em 2026-09-25.

## Open Questions

Nenhuma — todas resolvidas na aprovação (2026-09-25).

## Acceptance Criteria

- AC-1: Após um sync com referências deletadas ou arquivadas, `details.estagios` contém entrada `{ estagio: "audit", status: "ok", alteracoes: [...] }` com os dados de identidade corretos.
- AC-2: Syncs sem alterações (apenas equivalentes/criadas) NÃO geram entrada `audit`.
- AC-3: Cada item de `alteracoes` contém `tipo`, `referencia_id` e `identidade` com os dados do campo `detalhes` do evento correspondente.
- AC-4: A query adicional não falha nem impede a conclusão do sync em caso de erro (try/catch isolado).
- AC-5: Testes unitários cobrem o caso com e sem alterações.

## References

- [`current/features/FEAT-0017-sincronizacao-referencias-anvisa.md`](../current/features/FEAT-0017-sincronizacao-referencias-anvisa.md)
- [`archive/implemented/enhancements/ENH-0009-delecao-fisica-integrada-sync-simplificacao.md`](../archive/implemented/enhancements/ENH-0009-delecao-fisica-integrada-sync-simplificacao.md)
- `api/referencias-sync.ts` — estágio `apply` (linhas ~725–746)
- `supabase/migrations/20260923000000_enh_0009_delecao_fisica_sync_simplificacao.sql` — INSERT em `referencia_eventos` com campo `detalhes`
