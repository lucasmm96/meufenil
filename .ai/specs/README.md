# Specification System — MeuFenil

**Status do sistema:** COMPLETO e CONSOLIDADO (Fases 0–12 — 2026-08-13): 89+ arquivos cobrindo Current State, Proposed State, ADRs, templates e governança.
**Governança:** [`CONVENTIONS.md`](./CONVENTIONS.md) — leia antes de criar ou alterar qualquer arquivo deste diretório.

> Este arquivo é o HUB do Specification System, para humanos e para IA. Não é uma enciclopédia — o conteúdo vive nos documentos especializados, alcançáveis pelos links abaixo.

## 1. Objetivo

Registrar, de forma rigorosa e verificável, o conhecimento necessário para que futuras implementações (por IA ou humana) sigam os padrões, regras e características **reais** do MeuFenil — sem redescobrir o sistema, sem suposições confundidas com fatos e sem propostas tratadas como realidade.

## 2. Fonte da verdade

**A realidade atual é soberana.** Fonte: código atual, banco atual, migrations, testes, configurações e comportamento implementado — complementados por documentação existente (como evidência) e histórico Git. A documentação deste diretório é uma projeção verificável dessa realidade. Divergência → a realidade vence, e a divergência é registrada (protocolo em `CONVENTIONS.md`).

## 3. Current State × Proposed State

- **`current/`** — aquilo que realmente existe e está implementado ("como funciona hoje"). Somente comportamento evidenciado.
- **`proposed/`** — melhorias, features futuras, refactors, dívidas, segurança e testes possíveis ("como poderia ser"). NUNCA comportamento atual; nada é implementado apenas por estar documentado (status inicial: PROPOSED).

Nenhum documento de `current/` contém propostas; nenhum documento de `proposed/` é fonte de comportamento atual.

## 4. Estrutura de diretórios

```
.ai/specs/
├── README.md               ← você está aqui (hub)
├── CONVENTIONS.md          ← governança: evidência, nomenclatura, workflows,
│                             stop conditions, decisões humanas, sincronização
├── templates/              ← formatos canônicos (9 templates)
├── current/                ← ══ ESTADO ATUAL ══
│   ├── system-map.md       ← índice FUNCIONAL (capability → camadas) — ponto de partida
│   ├── product/            ← o que é o produto + glossário de termos
│   ├── domain/             ← modelo conceitual + regras de negócio (BR-NNN) + traceability
│   ├── architecture/       ← índice ARQUITETURAL (camadas, boundaries, data flows)
│   ├── features/           ← specs das 14 features atuais (FEAT-0001..0014)
│   ├── frontend/           ← overview + 9 páginas + 5 componentes
│   ├── backend/            ← keepalive, edge functions, background jobs, CLI
│   ├── database/           ← 7 tabelas + rpc + triggers
│   ├── security/           ← modelo de segurança + secrets/ambientes
│   └── testing/            ← estratégia de testes (infra e resultados)
├── decisions/              ← ══ DECISÕES ══ 11 ADRs (Origin: DOCUMENTED/RECONSTRUCTED/UNKNOWN)
└── proposed/               ← ══ ESTADO PROPOSTO ══ catálogo (index.md) com 14 propostas
    ├── features/ enhancements/ refactors/ technical-debt/ security/ testing/
```

## 5. Como navegar (IA e humanos)

1. **Funcional:** `current/system-map.md` → linha da capability → Feature Spec → Business Rules → camadas (frontend/backend/database/security) → testes.
2. **Arquitetural:** `current/architecture/overview.md` → camadas → ADRs (`decisions/`).
3. **Conceitual:** `current/product/` + `current/domain/` (glossário, modelo, BRs, traceability).
4. **Evolução:** `proposed/index.md` → proposta → Current State afetado.

Regras de navegação: nunca implementar sem ler a spec correspondente; área sem spec → PARAR e solicitar documentação; spec diz UNKNOWN → reportar lacuna, nunca preencher com conhecimento genérico; caminho de arquivo = contrato (ex.: `current/database/usuarios.md` sempre documenta `public.usuarios`); leitura progressiva (mapa → spec → código citado nas evidências).

## 6. Classificação de evidências

Toda afirmação relevante em `current/` carrega classificação e origem:

| Tag | Significado |
|---|---|
| `[CONFIRMED]` | Evidência direta (código, migration, teste, config versionada, git, UI). |
| `[INFERRED]` | Derivada de evidências — obrigatório bloco **Basis:**. |
| `[ASSUMED]` | Hipótese temporária — sempre com o que falta confirmar. |
| `[UNKNOWN]` | Não determinado — com **Evidence Needed:** quando útil. |

Regras duras: nunca apresentar sem tag; ausência de evidência = UNKNOWN; **ausência também é informação factual** ("não existe mecanismo X" é fato de Current; "deveria existir" é proposta). Detalhes em `CONVENTIONS.md` seção 3.

## 7. Workflows e decisões

- **Feature:** Feature → Specification → Review → Implementation Plan → Implementation → Tests → Documentation Update (nenhuma feature sem spec).
- **Bug:** Bug → Reproduzir → Teste que demonstra o problema → Correção → Teste passa → Avaliar impacto nas specs → Atualizar quando necessário.
- **Proposta:** PROPOSED → (decisão humana) → ACCEPTED → IMPLEMENTATION → IMPLEMENTED (ou REJECTED/SUPERSEDED) — ver `CONVENTIONS.md` seções 8 e 10.
- **Stop conditions e fronteira de decisão humana** (schema/RLS/RPC/segurança/negócio/arquitetura = parar e pedir aprovação): `CONVENTIONS.md` seções 13 e 14.
- **Sincronização de mudanças** (o que revisar/atualizar por tipo de mudança): `CONVENTIONS.md` seção 11.

## 8. Relação com código, análises e Git

- Specs citam código por caminho relativo com linha; viajam **no mesmo commit** da mudança de comportamento.
- `.ai/.temp/analyses/` é o laboratório local (**NÃO versionado**, por design): relatórios de fases e investigações — material de trabalho e evidência histórica, nunca fonte primária do Current State.
- `.ai/specs/` é versionado: é o conhecimento durável do projeto.

## 9. Links essenciais

- Governança: [`CONVENTIONS.md`](./CONVENTIONS.md)
- Mapa funcional (ponto de partida): [`current/system-map.md`](./current/system-map.md)
- Mapa arquitetural: [`current/architecture/overview.md`](./current/architecture/overview.md)
- Templates: [`templates/`](./templates/)
- Catálogo de propostas: [`proposed/index.md`](./proposed/index.md)
- ADRs: [`decisions/`](./decisions/)
