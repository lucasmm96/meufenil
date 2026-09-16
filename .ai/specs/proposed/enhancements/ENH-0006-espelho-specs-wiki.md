# ENH-0006 — Espelho das Specs do Projeto na Wiki

**Type:** ENH
**Status:** PROPOSED
**Title:** Espelho das Specs do Projeto na Wiki
**Issue:** #79
**Created on:** 2026-09-16

## Problem

Os 122 arquivos do Specification System (`.ai/specs/`) não são acessíveis publicamente sem clonar o repositório. Colaboradores externos, revisores e mantenedores precisam navegar pelo GitHub web UI (interface de árvore de arquivos) para ler qualquer spec, sem indexação, sem sidebar e sem contexto de navegação.

## Current State

- O wiki-documenter ([FEAT-0016](../../archive/implemented/features/FEAT-0016-geracao-automatica-de-documentacao-via-agente-wiki-documenter.md)) gera documentação pública *interpretativa* (8 páginas + 9 páginas de tooling via ENH-0005) a partir das specs — não espelha as specs originais.
- `.ai/specs/` contém 122 arquivos `.md` organizados em subdiretórios: `current/`, `proposed/`, `decisions/`, `templates/`, mais `README.md` e `CONVENTIONS.md`.
- `sync-wiki.yml` sincroniza `wiki/*.md` → GitHub wiki automaticamente a cada push em `master` ([`.github/workflows/sync-wiki.yml`](../../../../.github/workflows/sync-wiki.yml)).
- As specs não têm representação pública além do acesso via árvore de arquivos do GitHub.

## Proposed State

Uma nova seção "Specs do Projeto" na wiki, produzida como uma fase adicional do wiki-documenter:

- **Página hub** `Specs.md`: índice navegável organizado por seção (current/, proposed/, decisions/, templates/), com links para cada página espelho.
- **Páginas espelho**: cada arquivo `.md` de `.ai/specs/` copiado 1:1 (conteúdo exato, incluindo frontmatter YAML) para `wiki/` com nome derivado do path relativo.
- **Convenção de nomeação** [*ver Open Question 1*]: path relativo dentro de `.ai/specs/`, com `/` substituído por `-` e sem a extensão `.md` duplicada (ex.: `current/features/FEAT-0001-autenticacao.md` → `Specs-Current-Features-FEAT-0001-autenticacao.md`).
- **Integração**: `Home.md` ganha link para `Specs do Projeto`; `_Sidebar.md` ganha seção "Specs".
- **Mecanismo**: nova fase no wiki-documenter que itera `.ai/specs/**/*.md`, deriva nomes de páginas e copia os arquivos para `wiki/`. O workflow existente (`sync-wiki.yml`) trata a sincronização para o GitHub wiki sem alteração.
- **Incremental**: o controle de hash existente do wiki-documenter se aplica — um arquivo espelho só é regravado se o arquivo fonte mudou desde a última execução.

## Motivation

- **FACTUAL:** o projeto é spec-driven (SDD); as specs são a fonte de verdade. Não estão acessíveis em formato navegável publicamente.
- **FACTUAL:** o wiki-documenter já tem infraestrutura de controle incremental (`.wiki-state.json`) e acesso a todos os arquivos do repositório — estender é mais barato do que criar um novo mecanismo.
- **ASSUMPTION:** espelhar as specs na wiki facilita revisão e auditoria por colaboradores sem acesso direto ao repo local.
- **ASSUMPTION:** uma seção de specs bem indexada aumenta a transparência do projeto e a confiança de contribuidores externos.

## Evidence

- Draft em `proposed/draft/005-specs-reflected-on-wiki.md` (descartado após esta spec — ver housekeeping).
- `find .ai/specs -name "*.md" | wc -l` → 122 arquivos.
- FEAT-0016 (wiki-documenter) implementado e operacional com controle incremental via `.wiki-state.json`.
- ENH-0005 estendeu o wiki-documenter para documentar o tooling de IA — padrão de extensão validado.

## Scope

- Extensão do agente `wiki-documenter` (`.claude/agents/wiki-documenter.md`) com uma fase de spec-sync.
- Geração de `wiki/Specs.md` (hub navegável).
- Geração de até 122 páginas espelho em `wiki/` (uma por arquivo em `.ai/specs/`).
- Atualização de `wiki/Home.md` para incluir link para `Specs do Projeto`.
- Atualização de `wiki/_Sidebar.md` para incluir seção "Specs".
- Controle incremental por hash para as páginas espelho (via `.wiki-state.json` existente).

## Out of Scope

- Transformar ou interpretar o conteúdo das specs (responsabilidade do wiki-documenter existente).
- Reescrever links relativos internos dos arquivos espelhados.
- Criar uma nova ferramenta de sync (o wiki-documenter é o mecanismo).
- Alterar o workflow `sync-wiki.yml`.
- Tradução do conteúdo das specs.
- Filtrar ou omitir seções específicas das specs antes de espelhar.

## Impacted Features

- [FEAT-0016](../../archive/implemented/features/FEAT-0016-geracao-automatica-de-documentacao-via-agente-wiki-documenter.md) — wiki-documenter (estendido, não alterado em comportamento existente).

## Impacted Business Rules

N/A

## Impacted Architecture

N/A — extensão do agente existente sem impacto arquitetural no sistema de produção.

## Impacted Frontend / Backend / Database / Security / Tests

- Frontend: N/A
- Backend: N/A
- Database: N/A
- Security: N/A — as specs são documentação interna já versionada no repo público; espelhá-las na wiki não expõe nada que não esteja no GitHub.
- Tests: N/A

## Dependencies

- FEAT-0016 (wiki-documenter) — implementado e operacional (pré-requisito satisfeito).
- ENH-0005 — não é bloqueante; padrão de extensão do wiki-documenter já validado.

## Risks

- **Escala de páginas**: 122 páginas + hub → wiki consideravelmente maior. Nomes longos derivados do path podem ser pouco legíveis.
- **Links relativos quebrados**: specs usam links relativos internos (ex.: `../current/features/FEAT-0001.md`) que não resolverão na wiki. O leitor verá conteúdo correto mas links sem destino. [*ver Open Question 2*]
- **Nomes colisão**: arquivos genéricos em múltiplos diretórios (`index.md`, `README.md`, `overview.md`) gerariam nomes colisores se o prefixo não incluir o path completo. A convenção de path completo mitiga, mas nomes ficam longos.
- **Frontmatter visível**: o YAML de frontmatter renderiza como texto em algumas visualizações GitHub Wiki; pode parecer "ruído" para quem lê sem contexto de spec.

## Alternatives

- **A. GitHub Action determinística** — workflow adicional que copia `.ai/specs/` para `wiki/` em cada push, sem IA. Simples e automático, mas sem controle incremental de hash nem hub gerado. Requer novo workflow (ADR-0013 permite workflows determinísticos).
- **B. Script local (npm/bash)** — comando `npm run sync-specs-wiki` rodado manualmente. Simples, zero dependência de IA, mas sem hub, sem integração com `Home.md`/`_Sidebar.md` e sem controle de estado.
- **C. Extensão do wiki-documenter** *(proposta)* — nova fase no agente existente. Reutiliza infraestrutura de hash, gera o hub, atualiza `Home.md` e `_Sidebar.md`. Custo: invocação manual e consumo de tokens do agente.

**Decision:** TBD — a escolha é humana e é obrigatória para ACCEPTED/IMPLEMENTED.

## Open Questions

1. **Convenção de nomeação das páginas**: a derivação `path/relativo/arquivo.md` → `Specs-Path-Relativo-Arquivo.md` (capitalizando cada segmento) é legível o suficiente? Alternativa: manter lowercase (`specs-path-relativo-arquivo.md`). Definir antes da implementação — afeta o hub e todos os links.

2. **Links relativos internos**: aceitar links quebrados na wiki (simpler, conteúdo correto), ou adicionar um cabeçalho automático "Ver no repositório: [link GitHub]" acima do conteúdo espelhado para facilitar navegação? A segunda opção requer uma linha de transformação mínima e afeta o "conteúdo exato".

3. **Granularidade do hub `Specs.md`**: listar todos os 122 arquivos diretamente com âncoras por seção, ou criar sub-hubs por diretório (ex.: `Specs-Current.md`, `Specs-Proposed.md`) com o `Specs.md` vinculando apenas aos sub-hubs? A primeira opção é mais simples; a segunda é mais navegável em escala.

## Acceptance Criteria

TBD até a Decision — cobrir as alternativas com chance real de decisão. Critérios mínimos esperados:

- [ ] Wiki-documenter contém fase de spec-sync que itera `.ai/specs/**/*.md`.
- [ ] Todos os 122 arquivos de `.ai/specs/` têm página correspondente em `wiki/` com conteúdo exato (incluindo frontmatter).
- [ ] Página `wiki/Specs.md` existe como hub com links para todas as páginas espelho, organizados por seção.
- [ ] `wiki/Home.md` contém link para `Specs do Projeto`.
- [ ] `wiki/_Sidebar.md` contém seção "Specs" com link para o hub.
- [ ] Execuções subsequentes do wiki-documenter regeneram apenas páginas cujas fontes mudaram (controle incremental comprovado).
- [ ] Nenhuma página da documentação pública existente é alterada ou removida.
- [ ] Open Questions 1–3 resolvidas antes da implementação.

## References

- Draft: `proposed/draft/005-specs-reflected-on-wiki.md` (arquivar após esta spec ser criada)
- [FEAT-0016](../../archive/implemented/features/FEAT-0016-geracao-automatica-de-documentacao-via-agente-wiki-documenter.md) — wiki-documenter
- [ENH-0005](../../archive/implemented/enhancements/ENH-0005-revisao-tooling-ia.md) — revisão do tooling de IA (precedente de extensão)
- [`.github/workflows/sync-wiki.yml`](../../../../.github/workflows/sync-wiki.yml) — workflow de sincronização
- [`.ai/specs/CONVENTIONS.md`](../../CONVENTIONS.md) — governança do Specification System
