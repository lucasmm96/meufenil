# ENH-0012 — Ajuste retroativo de formatação das referências globais para fidelidade verbatim com a ANVISA

**Type:** ENH
**Status:** ACCEPTED
**Title:** Ajuste retroativo de formatação das referências globais para fidelidade verbatim com a ANVISA
**Issue:** #99
**Created on:** 2026-09-28
**Decision:** ACCEPTED
**Approved by:** Lucas Martins Menezes
**Approved on:** 2026-09-28

## Problem

O catálogo de referências globais contém dados cujo formato diverge do que a ANVISA entrega na origem: os ~2.959 itens do seed histórico foram armazenados em Sentence/Title Case antes de o princípio de verbatim fidelidade (FEAT-0017, §3/§6) ser estabelecido. O resultado é que a comparação do sync — case-sensitive — não consegue identificar esses itens como correspondentes aos seus pares na ANVISA, gerando risco de duplicação e violando a invariante de que o banco deve refletir exatamente o dado da origem.

## Current State

- `supabase/migrations/dados.sql` — ~2.959 referências globais do seed histórico em Sentence/Title Case ("Arroz agulhinha", "Alimento achocolatado em pó")
- `src/shared/referencias-sync/canonical.ts` — princípio verbatim declarado: "O VALOR persistido nunca é normalizado aqui (verbatim, fidelidade §3/§6)" — cobre apenas itens criados pelo sync; não retroativo
- Motor de comparação M3 (`construirPlanoSync`) — comparação por identidade `nome+marca`, case-sensitive; seed em Sentence Case não bate com ANVISA em ALL CAPS → esses itens são tratados como ausentes da origem
- Ver [FEAT-0017](../../archive/implemented/features/FEAT-0017-sincronizacao-referencias-anvisa.md) e [ENH-0009](../../archive/implemented/enhancements/ENH-0009-delecao-fisica-integrada-sync-simplificacao.md)

## Proposed State

### 1. Validação do pipeline de sync

Auditoria confirmatória do pipeline de sync: verificar que `nome`, `marca` e `fenil_mg_por_100g` são armazenados exatamente como recebidos da origem — sem normalização de caixa, formatação, arredondamento ou qualquer transformação de valor. Cobre `canonical.ts`, `aplicar_sync_referencias` e qualquer transformação intermediária entre extração e persistência.

### 2. Script de ajuste retroativo

Script pontual que:

1. Executa extração ANVISA em tempo real (nova extração antes de rodar — ver OQ2)
2. Para cada referência global ativa no catálogo, busca correspondente na ANVISA por comparação **case-insensitive** de `nome+marca` (normalizado apenas para fins de lookup — não para persistência)
3. Quando encontra correspondência: atualiza `nome` e `marca` no banco para o valor verbatim da ANVISA
4. Quando não encontra correspondência: mantém o registro sem alteração e registra no log de execução
5. **Nunca altera `fenil_mg_por_100g`** — apenas formatação de texto (`nome`, `marca`)

O script é idempotente: executado múltiplas vezes produz o mesmo resultado.

## Motivation

- **[FACTUAL]** O princípio verbatim (FEAT-0017 §3/§6) estabelece que o banco deve refletir o dado exato da origem; o seed histórico foi criado antes desse princípio e não está em conformidade `[CONFIRMED: canonical.ts + dados.sql]`
- **[FACTUAL]** A comparação M3 é case-sensitive; seed em Sentence Case e ANVISA em ALL CAPS resulta em identidades distintas — os itens do seed não são reconhecidos como existentes, gerando risco de duplicação no próximo sync `[INFERRED: análise do motor M3 + ausência de normalização no lookup]`
- **[FACTUAL]** ENH-0008 (Title Case dinâmico) aplica formatação de exibição sobre o dado do banco; se o banco não reflete a origem, a cadeia banco → display fica desconectada da realidade `[INFERRED: análise da sessão meuFenil019]`

## Evidence

- Sessão meuFenil019 (2026-09-28): análise do princípio verbatim e do gap retroativo
- `src/shared/referencias-sync/canonical.ts`: "O VALOR persistido nunca é normalizado aqui (verbatim, fidelidade §3/§6)"
- `supabase/migrations/dados.sql`: seed em Sentence Case — grep confirma ausência de ALL CAPS
- ENH-0008 spec: "inconsistência ALL CAPS × Sentence Case confirmada" (sessão meuFenil013)

## Scope

- Auditoria do pipeline de sync (código + testes validando verbatim)
- Script pontual de ajuste retroativo (`nome`, `marca`) — idempotente
- Log de execução: itens atualizados × itens sem correspondência na ANVISA
- Testes de regressão: sync não modifica formatting/valores; itens atualizados são corretamente identificados pelo sync pós-ajuste

## Out of Scope

- `fenil_mg_por_100g` — nenhuma alteração de valor
- Referências pessoais (`is_global = false`)
- Pipeline de extração e validação ANVISA — mantido sem alterações
- ENH-0008 (Title Case dinâmico) — depende desta spec
- Alterações de RLS, schema ou RPCs

## Impacted Features

- [FEAT-0017 — Sincronização de referências](../../archive/implemented/features/FEAT-0017-sincronizacao-referencias-anvisa.md) — correção do gap retroativo do princípio verbatim
- [FEAT-0008 — Referências alimentares](../../current/features/FEAT-0008-referencias-alimentares.md) — catálogo alinhado ao verbatim da origem

## Impacted Business Rules

N/A — sem alteração de regras de negócio; ajuste de fidelidade de dado à origem.

## Impacted Architecture

N/A — sem impacto arquitetural; script pontual e auditoria de código existente.

## Impacted Frontend / Backend / Database / Security / Tests

- **Frontend:** N/A
- **Backend:** N/A — pipeline de sync inalterado
- **Database:** UPDATE em `referencias` (`nome`, `marca`) para itens do seed com correspondência na ANVISA — sem DDL, sem migration de schema
- **Security:** N/A
- **Tests:** novos testes validando verbatim fidelity do sync; testes de regressão pós-ajuste (sync não cria duplicatas dos itens atualizados)

## Dependencies

Nenhuma.

## Risks

- **[MÉDIO]** Itens do seed sem correspondência na ANVISA permanecem em Sentence Case — não é erro; é o estado correto para itens que não existem na origem. O log os identifica.
- **[BAIXO]** Script idempotente — reexecução segura; sem risco de dupla atualização.
- **[BAIXO]** `fenil_mg_por_100g` explicitamente excluído do script — risco de alteração de valor = zero.

## Alternatives

- **A. Não fazer o ajuste retroativo:** banco permanece com seed em Sentence Case; ENH-0008 funciona mas o dado exibido não tem relação direta com a origem; sync pode criar duplicatas para itens do seed. **Decision:** TBD
- **B. Ajuste via SQL simples (uppercase tudo):** não corresponde ao verbatim da ANVISA — a ANVISA pode ter formatação distinta de ALL CAPS puro. **Decision:** descartada — verbatim exige lookup real na origem.
- **C. Deixar o sync corrigir gradualmente:** com comparação case-sensitive, itens do seed não são reconhecidos como correspondentes e o ajuste não ocorre naturalmente. **Decision:** descartada.

**Decision:** ACCEPTED — ajuste retroativo via extração em tempo real + script idempotente; itens sem par na ANVISA mantidos sem alteração. **Approved by:** Lucas Martins Menezes **Approved on:** 2026-09-28

## Open Questions

1. **Itens do seed sem correspondência na ANVISA:** manter sem alteração (comportamento proposto) ou flag para revisão manual? **RESOLVIDA:** manter sem alteração — itens sem par na ANVISA ficam como estão; o log os registra. Não tocar o que não tem origem confirmada. `[Decisão: Lucas Martins Menezes, 2026-09-28]`
2. **Mecanismo de extração:** o script usa extração ANVISA em tempo real (requer conectividade) ou um snapshot do último payload de sync? **RESOLVIDA:** extração em tempo real — o script dispara uma nova extração antes de rodar, garantindo dados atualizados da origem. `[Decisão: Lucas Martins Menezes, 2026-09-28]`

## Acceptance Criteria

- **AC1 (Sync — auditoria de código):** revisão confirmada de `src/shared/referencias-sync/canonical.ts` e da RPC `aplicar_sync_referencias` — nenhuma transformação de `nome`, `marca` ou `fenil_mg_por_100g` entre origem e persistência (sem `toLowerCase`, `toUpperCase`, trim não trivial, arredondamento ou equivalente).
- **AC2 (Sync — teste de verbatim):** dado um payload de sync com `nome: "ARROZ AGULHINHA"` e `marca: "TIO JOÃO"`, o registro persistido no banco contém exatamente `nome = "ARROZ AGULHINHA"` e `marca = "TIO JOÃO"` — sem normalização aplicada.
- **AC3 (Script — ajuste retroativo):** script atualiza `nome` e `marca` dos registros do seed para o valor verbatim da ANVISA quando há correspondência case-insensitive.
- **AC4 (Script — sem alteração de valor):** `fenil_mg_por_100g` inalterado em todos os registros após execução do script.
- **AC5 (Script — idempotência):** segunda execução do script não produz novos UPDATEs.
- **AC6 (Script — log):** execução produz log com: total avaliado, itens atualizados (nome/marca → verbatim ANVISA), itens sem correspondência (mantidos).
- **AC7 (Pós-ajuste — sync):** após o script, uma execução de sync não gera `referencia_criada` para itens que foram atualizados (motor M3 os identifica corretamente como existentes).

## References

- [FEAT-0017 — spec arquivada](../../archive/implemented/features/FEAT-0017-sincronizacao-referencias-anvisa.md)
- [ENH-0008 — Title Case dinâmico](enhancements/ENH-0008-title-case-exibicao-referencias.md) — depende desta spec; **não implementar ENH-0008 antes desta**
- [ENH-0009 — Deleção física integrada](../../archive/implemented/enhancements/ENH-0009-delecao-fisica-integrada-sync-simplificacao.md)
- `src/shared/referencias-sync/canonical.ts`
- `supabase/migrations/dados.sql`
- Sessão meuFenil019 (2026-09-28): análise do gap retroativo e definição da proposta
