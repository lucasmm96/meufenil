# ENH-0008 — Title Case dinâmico para exibição de referências alimentares

**Type:** ENH
**Status:** ACCEPTED
**Title:** Title Case dinâmico para exibição de referências alimentares
**Issue:** #87
**Created on:** 2026-09-18
**Decision:** ACCEPTED
**Approved by:** Lucas Martins Menezes
**Approved on:** 2026-09-18

## Problem

O catálogo de referências alimentares contém itens com caixa inconsistente entre si: itens do seed histórico estão em Sentence/Title Case ("Alimento achocolatado em pó"), enquanto itens criados pelo sync ANVISA/Power BI estão em ALL CAPS ("ALIMENTO ACHOCOLATADO EM PÓ") — conforme o formato nativo da fonte. O frontend exibe o dado bruto, expondo essa inconsistência visual ao usuário em todos os pontos de exibição.

## Current State

- `lib/referencias.ts` — `nomeComMarca` monta a apresentação combinada `nome (Marca: X)` sem normalização de caixa ([FEAT-0008](../../current/features/FEAT-0008-referencias-alimentares.md))
- `Referencias.tsx` — coluna desktop exibe `r.nome` e `marcaExibida` diretamente do banco
- `Admin.tsx` — função local `nomeComMarcaSync` (separador `—`) exibe identidades do sync sem normalização
- Banco de dados armazena verbatim por design (`src/shared/referencias-sync/canonical.ts`: "O VALOR persistido nunca é normalizado aqui (verbatim, fidelidade §3/§6)") — comportamento correto e intencional ([FEAT-0017](../../current/features/FEAT-0017-sincronizacao-referencias-anvisa.md))
- `nome_alimento` nos registros é computado ao vivo via `nomeComMarca` em `registros.service.ts:100–101` (sem snapshot — comentário "Join ao vivo preservado (sem snapshot — ENH-0004)")

## Proposed State

Adicionar `toTitleCase` em `lib/referencias.ts` e aplicar dinamicamente em todos os pontos de exibição de `nome`/`marca` no frontend — sem tocar banco, sync, regras de negócio ou lógica de serviço.

### Função utilitária

```typescript
export function toTitleCase(text: string): string {
  return text
    .toLowerCase()
    .split(" ")
    .map(word => word ? word[0].toUpperCase() + word.slice(1) : word)
    .join(" ");
}
```

**Nota de implementação:** usar `split(" ").map` e não regex `\b`. O `\b` do JS é ASCII-only e não encontra limite de palavra em caracteres acentuados — "ÁCIDO" com `\b` resultaria em "ácido" em vez de "Ácido". Title Case simples (todas as palavras capitalizadas, inclusive preposições) foi a forma escolhida.

### Pontos de mudança

| Arquivo | Mudança |
|---|---|
| `src/react-app/lib/referencias.ts` | Adicionar `toTitleCase` exportada; modificar `nomeComMarca` para aplicar `toTitleCase` em `nome` e `marcaNormalizada` antes de compor |
| `src/react-app/pages/Referencias.tsx` | Linha 550: `{r.nome}` → `{toTitleCase(r.nome)}`; linha 556–558: aplicar `toTitleCase` em `marcaExibida` no ponto de renderização |
| `src/react-app/pages/Admin.tsx` | Modificar `nomeComMarcaSync` (linha 922) para aplicar `toTitleCase` em `nome` e `marca` |

### Pontos sem mudança

| Arquivo | Por quê |
|---|---|
| `src/react-app/components/ModalReferencia.tsx` inputs (linhas 36–37) | Form inputs devem exibir o valor verbatim armazenado — o usuário precisa ver exatamente o que está editando/salvando |
| `src/react-app/lib/referencias.ts` — `normalizarMarca` | Papel semântico (variantes de "sem marca"), não de formatação |
| Banco, sync pipeline, RPCs, edge functions | Fora do escopo — fidelidade verbatim da origem permanece intacta |

### Cobertura automática (via `nomeComMarca`)

Modificar `nomeComMarca` cobre os seguintes pontos **sem alterar esses arquivos diretamente**:

| Arquivo | Linhas | Via |
|---|---|---|
| `AdicionarRegistro.tsx` | 135, 217, 226, 246 | `nomeComMarca` |
| `Referencias.tsx` | 74, 99, 404, 464, 609 | `nomeComMarca` |
| `registros.service.ts` | 100–101 | `nomeComMarca` → `nome_alimento` |
| `Historico.tsx` | 183 | via `registros.service.ts` |
| `Dashboard.tsx` | — | via `registros.service.ts` |

## Motivation

- **[FACTUAL]** O banco armazena verbatim por design; a inconsistência de caixa entre seed (Sentence Case) e sync (ALL CAPS) é estrutural e permanecerá à medida que o sync cria novos itens da ANVISA.
- **[FACTUAL]** Separar "valor persistido" de "valor exibido" aumenta a fidelidade ao dado de origem — o banco reflete exatamente o que a ANVISA entrega; o display aplica a convenção visual do produto independentemente da fonte.
- **[FACTUAL]** `nomeComMarca` é o ponto central de exibição; modificá-la cobre 9 pontos de uso automaticamente sem tocar os arquivos consumidores.

## Evidence

- Análise de raiz sessão meuFenil013 (2026-09-18): itens ALL CAPS em dev confirmados como provenientes do sync FEAT-0017 — comportamento por design (`canonical.ts`: "verbatim, fidelidade §3/§6")
- Seed `migrations/dados.sql`: 2.959 itens em Sentence Case — nenhuma ocorrência ALL CAPS (confirmado por grep)
- `registros.service.ts:98`: comentário "Join ao vivo preservado (sem snapshot — ENH-0004)" confirma que `nome_alimento` é dinâmico

## Scope

- `toTitleCase` em `lib/referencias.ts` + testes unitários
- Modificação de `nomeComMarca` (cobre automaticamente 9 pontos de uso)
- 2 pontos diretos em `Referencias.tsx` (colunas desktop: `r.nome` e `marcaExibida`)
- `nomeComMarcaSync` em `Admin.tsx` (3 pontos de uso: pendências, propostas, eventos)
- Atualização de testes impactados em `lib/referencias.test.ts` e revisão de `registros.service.test.ts`

## Out of Scope

- Banco de dados, migrations, RLS, RPCs
- Pipeline de sync ANVISA/Power BI (`src/shared/referencias-sync/`, `src/shared/powerbi/`)
- Edge functions
- Inputs de formulário (`ModalReferencia`)
- Nomes de usuário (não são referências alimentares)
- Normalização de hifens internos (ex.: "CAJU-LIMÃO" → "Caju-limão" em vez de "Caju-Limão") — aceito como limitação do split por espaço

## Impacted Features

- [FEAT-0008 Referências alimentares](../../current/features/FEAT-0008-referencias-alimentares.md) — display de nome/marca em todos os fluxos da página
- [FEAT-0003 Registro diário](../../current/features/FEAT-0003-registro-diario-consumo.md) — `nome_alimento` exibido em `Historico.tsx` (via `nomeComMarca` em `registros.service.ts`)
- [FEAT-0005 Dashboard](../../current/features/FEAT-0005-dashboard.md) — exibição de referência selecionada (via `registros.service.ts`)
- [FEAT-0012 Painel administrativo](../../current/features/FEAT-0012-painel-administrativo.md) — `Admin.tsx` usa `nomeComMarcaSync`
- [FEAT-0017 Sincronização de referências](../../current/features/FEAT-0017-sincronizacao-referencias-anvisa.md) — display de pendências/curadoria/eventos no admin

## Impacted Business Rules

N/A — mudança exclusivamente de apresentação, sem alteração de regras de negócio.

## Impacted Architecture

N/A — sem impacto arquitetural.

## Impacted Frontend / Backend / Database / Security / Tests

- **Frontend:** `lib/referencias.ts`, `Referencias.tsx`, `Admin.tsx` (ver Scope e Proposed State)
- **Backend:** N/A
- **Database:** N/A
- **Security:** N/A
- **Tests:**
  - `src/react-app/lib/referencias.test.ts` — adicionar suite `toTitleCase`; atualizar casos de `nomeComMarca` com input ALL CAPS (os expected values mudam)
  - `src/react-app/services/registros.service.test.ts` — revisar expected `nome_alimento`: mocks com `nome`/`marca` ALL CAPS resultarão em Title Case

## Dependencies

Nenhuma.

## Risks

- **[BAIXO]** Tests com input já capitalizado (`nomeComMarca("Arroz", "Tio João")`) não quebram — `toTitleCase` é idempotente para esses casos. Apenas testes com input ALL CAPS precisam ter expected value atualizado.
- **[BAIXO]** `registros.service.test.ts` — caso algum mock use nome/marca em ALL CAPS, o expected `nome_alimento` muda. Provável que os mocks existentes já estejam em caixa adequada.
- **[ACEITO]** Palavras separadas por hífen (ex.: "CAJU-LIMÃO") resultarão em "Caju-limão" pelo split de espaço — limitação conhecida e aceita (ver Out of Scope).

## Alternatives

- **A. CSS `text-transform: capitalize`:** não funciona para ALL CAPS (capitaliza a primeira letra, mas não faz lowercase das demais — "ARROZ" permanece "ARROZ"). Descartada.
- **B. Normalização no banco na criação/sync:** mudaria o princípio de verbatim fidelidade. Descartada — confirmado pelo usuário que o banco deve manter verbatim.
- **C. Regex `\b` no JS:** não compatível com acentuação portuguesa. Descartada em favor de `split(" ").map`.

**Decision:** ACCEPTED — `toTitleCase` via `split(" ").map`, aplicado dinamicamente no frontend em todos os pontos de exibição.
**Approved by:** Lucas Martins Menezes
**Approved on:** 2026-09-18

## Open Questions

N/A — todas as questões foram resolvidas antes da aprovação:
- Incluir Admin.tsx: **sim**
- `ModalReferencia` inputs: **verbatim (sem mudança)**
- Granularidade do Title Case: **simples (todas as palavras), sem exceção para preposições**

## Acceptance Criteria

- **AC1:** `toTitleCase` exportada de `lib/referencias.ts`; suite de testes unitários com: input ALL CAPS ("ALIMENTO ACHOCOLATADO EM PÓ" → "Alimento Achocolatado Em Pó"), input com acentos ("ÁCIDO FÓLICO" → "Ácido Fólico"), input já capitalizado (idempotência — "Arroz" → "Arroz"), input vazio ("" → ""), input com espaços múltiplos.
- **AC2:** `nomeComMarca("ARROZ", "TIO JOÃO")` retorna `"Arroz (Marca: Tio João)"`.
- **AC3:** `nomeComMarca("Arroz", "Tio João")` retorna `"Arroz (Marca: Tio João)"` (idempotente).
- **AC4:** `nomeComMarca("ALIMENTO ACHOCOLATADO EM PÓ", "")` retorna `"Alimento Achocolatado Em Pó"` (sem marca).
- **AC5:** Coluna desktop `Nome` em `Referencias.tsx` exibe Title Case independentemente do case armazenado.
- **AC6:** Coluna desktop `Marca` em `Referencias.tsx` exibe Title Case (ou "—" quando sem marca).
- **AC7:** `Admin.tsx` — pendências, propostas e eventos de sync exibem Title Case em nome/marca.
- **AC8:** `ModalReferencia` — inputs `nome` e `marca` continuam exibindo o valor verbatim armazenado.
- **AC9:** Banco de dados, sync pipeline e demais camadas inalterados (nenhuma migration, nenhuma mudança em edge functions ou RPCs).
- **AC10:** Suítes de teste passam sem falhas novas; expected values impactados atualizados.

## References

- [FEAT-0008 Referências alimentares](../../current/features/FEAT-0008-referencias-alimentares.md)
- [FEAT-0017 Sincronização de referências](../../current/features/FEAT-0017-sincronizacao-referencias-anvisa.md)
- Análise de raiz: sessão meuFenil013 (2026-09-18) — itens ALL CAPS = ANVISA verbatim; inconsistência estrutural confirmada
- Work branch sugerida: `enhancement/ENH-0008-title-case-referencias`
