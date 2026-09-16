# Template — Feature Spec (Current × Proposed)

**Uso:** especificação de uma feature. O MESMO template atende os dois estados; o campo **Tipo** muda o regime das seções:

| Campo | Em `current/features/` | Em `proposed/features/` |
|---|---|---|
| Tipo | `Current` | `Proposed` |
| Pergunta que responde | "Como esta feature realmente funciona hoje?" | "Como esta feature futura deverá funcionar?" |
| Regime das seções | descreve o que EXISTE, com evidências | descreve requisitos do que DEVERÁ existir |
| `## Evidence` | obrigatória | não se aplica (substituída por `## Unknowns`/`## Open Questions`) |

**Localização:** `current/features/FEAT-NNNN-<slug>.md` ou `proposed/features/FEAT-NNNN-<slug>.md`.
**Regras:** feature specs agregam specs de camada POR LINKS — não repetem conteúdo de `database/`, `frontend/` etc. Seções não aplicáveis recebem **N/A**; informações que deveriam existir mas não foram determinadas recebem **UNKNOWN** (com o que falta descobrir). Seções sem sentido para a feature podem ser omitidas. Em `current/`: sem evidência → `UNKNOWN` explícito, nunca preenchimento por inferência.

---

# Feature Spec: <Nome da Feature>

**ID:** FEAT-NNNN
**Tipo:** Current | Proposed
**Status:** [Current: Implementada | Em evolução] — [Proposed: PROPOSED | ACCEPTED | IMPLEMENTATION | IMPLEMENTED | REJECTED | SUPERSEDED]

## Purpose

[Preencher — o que a feature entrega, em uma frase]

## Actors

[Preencher — quem usa; N/A quando não houver ator humano]

## Preconditions

[Preencher — condições para os fluxos; N/A quando não houver]

## Main Flow

[Preencher — fluxo principal em passos, com evidências em Current]

## Alternative Flows

[Preencher — variações; "Nenhum identificado" quando for o caso]

## Error Flows

[Preencher — erros e comportamentos observados/esperados]

## Business Rules

[Preencher — links para `current/domain/business-rules.md` (BR-NNN); N/A quando não houver]

## Frontend

[Preencher — páginas/componentes/hooks/services; links para `current/frontend/`; N/A quando não houver]

## Backend

[Preencher — edge functions/API/RPCs; links para `current/backend/` e `current/database/rpc.md`; N/A quando não houver]

## Database

[Preencher — tabelas/RPCs/triggers; links para `current/database/`; N/A quando não houver]

## Security

[Preencher — link para `current/security/security-model.md` quando houver autorização; N/A quando não houver]

## Tests

[Preencher — arquivos de teste reais + coverage status (Fase 6); "NONE" quando não houver]

## Dependencies

[Preencher — dependências da feature; "Nenhuma" quando não houver]

## Related Features

[Preencher — links para outras FEATs; N/A quando não houver]

## Evidence

[Preencher — obrigatória em Current: lista E1, E2... com classificação e origem]

## Unknowns

[Preencher — obrigatória quando houver: item + evidência necessária; "Nenhum" quando não houver]
