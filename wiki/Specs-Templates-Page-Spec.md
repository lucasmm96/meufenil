# Template T3 — Spec de Página

**Uso:** documentação de uma página em `current/frontend/pages/<pagina>.md` (nome do arquivo = slug da rota).
**Regras:** documentar SOMENTE o que existe no código — acessibilidade, responsividade e estados de UI descritos a partir do código real; ausência registrada como fato (`CONVENTIONS.md`, seção 2). Padrões de código compartilhados ficam em `current/frontend/overview.md` (linkar, não copiar).

---

# Página <Nome>

**Última verificação:** YYYY-MM-DD (commit <sha>)
**Rota:** `<caminho>` — definida em `src/react-app/App.tsx`

## Propósito

[Preencher — o que a página faz para o usuário]

## Composição

[Preencher — componentes usados, com links para `current/frontend/components/`]

## Estado e dados

[Preencher — hooks, services e DTOs consumidos, com links; contexto global (AuthContext) quando aplicável]

## Fluxos de interação

[Preencher — ações do usuário → efeitos (navegação, mutação, estados)]

## Estados de UI

- **Loading:** [Preencher — skeleton/loader observado no código; ou "Não implementado" (ausência = fato)]
- **Empty:** [Preencher — ou "Não implementado"]
- **Error:** [Preencher — ou "Não implementado"]

## Responsividade

[Preencher — breakpoints e classes observadas no código]

## Acessibilidade observada

[Preencher — apenas o que existe no código (aria, focus, rótulos...); ausências registradas como fato]

## Validação

[Preencher — regras reais de validação (ex.: Zod, limites de campos)]

## Erros possíveis

[Preencher — códigos `AppError` observados nos services/hooks usados pela página]

## Testes existentes

[Preencher — links; ou "Sem teste colocalizado" (ausência = fato)]

## Evidências

[Preencher — E1, E2...]

## Veja também

[Preencher — links: feature spec correspondente em `current/features/`, overview do frontend, system-map]
