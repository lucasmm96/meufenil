# Template — Spec de Componente

**Uso:** documentação de um componente REUTILIZÁVEL em `current/frontend/components/<componente>.md`. Para PÁGINAS, usar `page-spec.md`. Componentes triviais podem ser agrupados em uma única spec por suíte (ex.: `login-as.md`).
**Regras:** documentar somente o que existe no código; ausência registrada como fato (`CONVENTIONS.md`, Evidence Model); props e comportamento derivados do código real; interações entre páginas e componentes ficam nas specs de página (link, não copie).

---

# Componente <Nome>

**Última verificação:** YYYY-MM-DD (commit <sha>)
**Código:** `src/react-app/components/<caminho>`

## Propósito e uso

[Preencher — o que o componente faz e ONDE é usado (consumidores, com links)]

## Props

[Preencher — interface real das props, com tipos; "Sem props" quando aplicável]

## Estado e dados

[Preencher — estado local, hooks/contexts consumidos; "Sem estado" quando aplicável]

## UI

[Preencher — estrutura visual, textos exatos, ícones, classes recorrentes (padrões do frontend/overview)]

## Comportamento / interações

[Preencher — eventos, validações, side effects, callbacks]

## Estados de UI

- **Loading:** [Preencher — ou "Não implementado"]
- **Empty:** [Preencher — ou "Não implementado"]
- **Error:** [Preencher — ou "Não implementado"]
- **Disabled/Read-only:** [Preencher — ou "Não implementado"]

## Responsividade / Acessibilidade

[Preencher — apenas o que existe; ausências registradas como fato]

## Testes

[Preencher — links; ou "Sem teste próprio" (ausência = fato)]

## Evidências

[Preencher — E1, E2...]

## Veja também

[Preencher — links]
