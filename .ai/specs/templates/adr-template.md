# Template — ADR

**Uso:** decisões arquiteturais em `decisions/ADR-NNNN-titulo-curto.md` (numeração global, 0001 em diante).
**Regras:** os campos **Status** e **Origin** são obrigatórios. ADRs com `Origin: RECONSTRUCTED` **nunca** recebem data nem justificativa inventadas — data e motivação ficam `UNKNOWN` quando indeterminados. Consequências somente OBSERVED (com evidência); alternativas históricas apenas quando comprovadas. Nenhuma narrativa histórica fictícia (`CONVENTIONS.md`, Evidence Model).

**Status possíveis:**
- `Accepted` — vigente
- `Proposed` — em consideração (decisão ainda não tomada)
- `Superseded` — substituída (obrigatório apontar a substituta)
- `Rejected` — considerada e rejeitada (registro histórico)

**Origin possíveis:**
- `DOCUMENTED` — a decisão está explicitamente registrada em documentação (README, migration com referência, análise aprovada)
- `RECONSTRUCTED` — reconstruída a partir da implementação atual e outras evidências; sem registro histórico explícito
- `UNKNOWN` — não foi possível determinar a origem/intenção

---

# ADR-NNNN: <Título>

**Status:** Accepted | Proposed | Superseded | Rejected
**Substituída por:** ADR-MMMM   [apenas quando Status = Superseded]
**Origin:** DOCUMENTED | RECONSTRUCTED | UNKNOWN
**Data da decisão:** YYYY-MM-DD — ou `UNKNOWN` (não inventar)
**Reconstruída por engenharia reversa em:** YYYY-MM-DD   [apenas quando Origin = RECONSTRUCTED]

## Context

[Preencher — contexto factual atual; apenas o que as evidências suportam]

## Decision

[Preencher — a decisão arquitetural observável]

## Consequences (OBSERVED)

[Preencher — consequências OBSERVADAS com evidência por item; não apresentar inferência teórica como fato]

## Alternatives

[Preencher — "Não determinadas a partir das evidências disponíveis." quando não comprovadas; alternativas históricas documentadas podem ser citadas com evidência]

## Evidence

[Preencher — arquivos, migrations, git history, README; obrigatória]

## Related Specs

[Preencher — links]
