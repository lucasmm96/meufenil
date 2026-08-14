# Página Sobre

**Última verificação:** 2026-08-13 (commit 6323664)
**Rota:** `/sobre` — `src/react-app/App.tsx:26`

## Propósito

Conteúdo institucional: história do projeto (comunidade PKU), links externos (LinkedIn do autor, Kuvan®, ANVISA) e instruções "Como Usar o App".

## Acesso

Skeleton se `!ready`; nenhuma outra restrição `[CONFIRMED: code — Sobre.tsx:7-15]`.

## Estado e dados

- Apenas `useAuth()` → `{ ready }`; conteúdo 100% estático (sem hooks de dados, sem services) `[CONFIRMED: code]`.

## UI

1. **Hero:** ícone `Heart` em caixa gradiente indigo→purple, título "Sobre o MeuFenil", subtítulo "Uma ferramenta criada com carinho para a comunidade PKU" `[CONFIRMED: code]`.
2. **Card "Minha História":** texto com links externos (`target="_blank" rel="noopener noreferrer"`): LinkedIn do autor, Kuvan®, tabela ANVISA (PowerBI); parágrafo destacado em `text-indigo-600` sobre o caráter sem fins lucrativos `[CONFIRMED: code — Sobre.tsx:32-95]`.
3. **Card "Como Usar o App":** lista de passos ("Configure seu Perfil", "Registre suas Refeições", "Crie Alimentos Personalizados" + itens seguintes do arquivo) `[CONFIRMED: code — Sobre.tsx:97-120+]`.
4. Rodapé do Layout compartilhado `[CONFIRMED: code]`.

## Estados de UI

- **Loading:** `LayoutSkeleton` + `SobreSkeleton` `[CONFIRMED: code]`.
- **Empty/Error:** não aplicável (conteúdo estático) `[CONFIRMED: ausência]`.

## Responsividade

`max-w-4xl mx-auto px-4 sm:px-6`; textos `text-2xl sm:text-4xl`; `text-left md:text-justify` no texto da história `[CONFIRMED: code]`.

## Acessibilidade

Links com `rel="noopener noreferrer"` (aqui SIM — diferentemente do Footer da Home); sem `aria-*` `[CONFIRMED: code]`.

## Testes

Nenhum `[CONFIRMED: ausência]`.

## Evidências

- E1 — `src/react-app/pages/Sobre.tsx` `[CONFIRMED: code]`

## Veja também

- [home.md](home.md) (outra página de conteúdo), [overview.md](../overview.md)
