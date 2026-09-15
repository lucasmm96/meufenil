---
name: spec-navigation
description: >
  Progressive context loading for the MeuFenil Specification System.
  Load when navigating specs, implementing a feature, looking up the system map,
  understanding business rules, locating which spec covers a capability, or before
  reading code to understand existing behavior. Explains the 8-step loading order:
  system-map → Feature Spec → Business Rules → layers → testing → architecture/ADRs.
---

# Navegação no Specification System — Progressive Context Loading

Ao implementar ou investigar uma capability, carregue contexto em ordem crescente de especificidade. Pare quando tiver o suficiente — não leia tudo.

## Ordem de carregamento (8 passos)

1. **system-map** → `.ai/specs/current/system-map.md` — mapa funcional completo. Identifique a capability e as camadas afetadas antes de abrir qualquer outro arquivo.
2. **Feature Spec** → `.ai/specs/current/features/<FEAT-ID>.md` — comportamento detalhado da capability.
3. **Business Rules** → `.ai/specs/current/domain/business-rules.md` (BR-NNN) + `.ai/specs/current/domain/traceability.md` — regras que a implementação deve respeitar.
4. **Camadas afetadas** → abra somente as camadas relevantes: `current/frontend/`, `current/backend/`, `current/database/`, `current/security/`.
5. **Testing** → `.ai/specs/current/testing/testing-strategy.md` + testes existentes — antes de criar testes, verifique o que já existe.
6. **Architecture/ADRs** → `.ai/specs/current/architecture/overview.md` + `.ai/specs/decisions/` — somente se houver impacto arquitetural.
7. **Proposed** → `.ai/specs/proposed/index.md` — existe proposta relacionada? Existe UNKNOWN que afete a mudança?
8. **Código** — somente o código citado nas evidências das specs.

## Pontos de entrada rápidos

| Propósito | Arquivo |
|---|---|
| Hub geral | `.ai/specs/README.md` |
| Mapa funcional | `.ai/specs/current/system-map.md` |
| Arquitetura | `.ai/specs/current/architecture/overview.md` |
| Governança | `.ai/specs/CONVENTIONS.md` |
| Propostas | `.ai/specs/proposed/index.md` |
| Testes | `.ai/specs/current/testing/testing-strategy.md` |
| ADRs | `.ai/specs/decisions/` |
| Templates | `.ai/specs/templates/` |

## Regra de evidência

Só modifique uma spec se o comportamento factual documentado mudou (**REVIEW ≠ UPDATE**). Specs viajam no mesmo commit da mudança de comportamento.
