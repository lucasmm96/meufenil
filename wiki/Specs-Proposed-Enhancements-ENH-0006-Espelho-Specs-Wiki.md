# ENH-0006 — Espelho das Specs do Projeto na Wiki

**Type:** ENH
**Status:** ACCEPTED
**Title:** Espelho das Specs do Projeto na Wiki
**Issue:** #79
**Created on:** 2026-09-16

## Problem

Os 122 arquivos do Specification System (`.ai/specs/`) não são acessíveis publicamente sem clonar o repositório. Colaboradores externos, revisores e mantenedores precisam navegar pelo GitHub web UI (interface de árvore de arquivos) para ler qualquer spec, sem indexação, sem sidebar e sem contexto de navegação.

## Current State

- O wiki-documenter ([FEAT-0016](Specs-Archive-Implemented-Features-FEAT-0016-Geracao-Automatica-De-Documentacao-Via-Agente-Wiki-Documenter)) gera documentação pública *interpretativa* (8 páginas + 9 páginas de tooling via ENH-0005) a partir das specs — não espelha as specs originais.
- `.ai/specs/` contém 122 arquivos `.md` organizados em subdiretórios: `current/`, `proposed/`, `decisions/`, `templates/`, mais `README.md` e `CONVENTIONS.md`.
- `sync-wiki.yml` sincroniza `wiki/*.md` → GitHub wiki automaticamente a cada push em `master` ([`.github/workflows/sync-wiki.yml`](https://github.com/lucasmm96/meufenil/blob/master/.github/workflows/sync-wiki.yml)).
- As specs não têm representação pública além do acesso via árvore de arquivos do GitHub.

## Proposed State

Uma nova seção "Specs do Projeto" na wiki, produzida como uma fase adicional do wiki-documenter:

- **Hub principal** `Specs.md`: página de entrada com links para sub-hubs por diretório de primeiro nível (`current/`, `proposed/`, `decisions/`, `templates/`).
- **Sub-hubs por diretório** (ex.: `Specs-Current.md`, `Specs-Proposed.md`): índice das páginas daquele subdiretório, agrupado por subdiretório interno quando aplicável (ex.: `current/features/`, `current/frontend/`).
- **Páginas espelho**: cada arquivo `.md` de `.ai/specs/` copiado para `wiki/` com nome derivado do path relativo e conteúdo com links reescritos (ver abaixo). Conteúdo do corpo e frontmatter preservados.
- **Convenção de nomeação**: path relativo dentro de `.ai/specs/`, prefixado com `Specs-`, cada segmento com primeira letra maiúscula, separados por `-`. Exemplo: `current/features/FEAT-0001-autenticacao.md` → `Specs-Current-Features-FEAT-0001-Autenticacao.md`. Identidades como `FEAT-0001` mantêm uppercase; palavras após `-` recebem maiúscula.
- **Reescrita de links**:
  - Links relativos entre specs (`.md` dentro de `.ai/specs/`) → convertidos para nome de página wiki correspondente.
  - Links relativos para código/scripts fora de `.ai/specs/` → convertidos para URL absoluta do GitHub apontando para `master` (ex.: `https://github.com/lucasmm96/meufenil/blob/master/scripts/apply.sh`).
  - Links externos (`https://`) e âncoras (`#secao`) → mantidos como estão.
- **Integração**: `Home.md` ganha link para "Specs do Projeto"; `_Sidebar.md` ganha seção "Specs" com link para `Specs.md`.
- **Mecanismo**: nova fase no wiki-documenter que itera `.ai/specs/**/*.md`, deriva nomes de páginas, reescreve links e copia os arquivos para `wiki/`. O workflow existente (`sync-wiki.yml`) trata a sincronização para o GitHub wiki sem alteração.
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
- Geração de `wiki/Specs.md` (hub principal) e sub-hubs por diretório de primeiro nível.
- Geração de até 122 páginas espelho em `wiki/` (uma por arquivo em `.ai/specs/`), com links reescritos.
- Atualização de `wiki/Home.md` para incluir link para `Specs do Projeto`.
- Atualização de `wiki/_Sidebar.md` para incluir seção "Specs".
- Controle incremental por hash para as páginas espelho (via `.wiki-state.json` existente).

## Out of Scope

- Transformar ou interpretar o conteúdo das specs (responsabilidade do wiki-documenter existente).
- Criar uma nova ferramenta de sync (o wiki-documenter é o mecanismo).
- Alterar o workflow `sync-wiki.yml`.
- Tradução do conteúdo das specs.
- Filtrar ou omitir seções específicas das specs antes de espelhar.

## Impacted Features

- [FEAT-0016](Specs-Archive-Implemented-Features-FEAT-0016-Geracao-Automatica-De-Documentacao-Via-Agente-Wiki-Documenter) — wiki-documenter (estendido, não alterado em comportamento existente).

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

- **Escala de páginas**: 122 páginas espelho + hub + sub-hubs → wiki consideravelmente maior. Nomes longos derivados do path são menos legíveis que nomes semânticos, mas são determinísticos e únicos.
- **Nomes colisão**: arquivos genéricos em múltiplos diretórios (`index.md`, `README.md`, `overview.md`) gerariam nomes colisores sem o path completo como prefixo. A convenção de path completo mitiga — `Specs-Current-Backend-Overview.md` vs `Specs-Proposed-Overview.md`.
- **Frontmatter visível**: o YAML de frontmatter renderiza como texto em algumas visualizações GitHub Wiki; pode parecer "ruído" para quem lê sem contexto de spec.
- **Links para branches divergentes**: links para código/scripts apontam para `master`; se o código em `development` divergir significativamente, o link pode referenciar versão desatualizada. Risco baixo dado o fluxo dev → master do projeto.
- **Complexidade de reescrita de links**: resolver links relativos (ex.: `../../archive/implemented/features/FEAT-0016.md`) exige resolução de path relativo ao arquivo fonte. Risco de link incorreto se a lógica não for bem testada.

## Alternatives

- **A. GitHub Action determinística** — workflow adicional que copia `.ai/specs/` para `wiki/` em cada push, sem IA. Simples e automático, mas sem controle incremental de hash nem hub gerado. Requer novo workflow (ADR-0013 permite workflows determinísticos).
- **B. Script local (npm/bash)** — comando `npm run sync-specs-wiki` rodado manualmente. Simples, zero dependência de IA, mas sem hub, sem integração com `Home.md`/`_Sidebar.md` e sem controle de estado.
- **C. Extensão do wiki-documenter** *(proposta)* — nova fase no agente existente. Reutiliza infraestrutura de hash, gera o hub, atualiza `Home.md` e `_Sidebar.md`. Custo: invocação manual e consumo de tokens do agente.

**Decision:** C — Extensão do wiki-documenter. ACCEPTED.
**Approved by:** Lucas Martins Menezes
**Approved on:** 2026-09-16

## Open Questions

Todas resolvidas em 2026-09-16:

1. **Convenção de nomeação** — **RESOLVIDA:** seguir padrão existente da wiki (PascalCase por segmento, separado por `-`). Exemplo: `current/features/FEAT-0001-autenticacao.md` → `Specs-Current-Features-FEAT-0001-Autenticacao.md`.

2. **Links relativos** — **RESOLVIDA:** spec→spec convertidos para nome de página wiki; spec→código/scripts convertidos para URL GitHub apontando para `master`; externos e âncoras mantidos como estão.

3. **Granularidade do hub** — **RESOLVIDA:** sub-hubs por diretório. `Specs.md` linka para `Specs-Current.md`, `Specs-Proposed.md`, `Specs-Decisions.md`, `Specs-Templates.md`; cada sub-hub lista os arquivos daquele diretório.

## Acceptance Criteria

- [ ] Wiki-documenter contém fase de spec-sync que itera `.ai/specs/**/*.md`.
- [ ] Todos os arquivos de `.ai/specs/` têm página correspondente em `wiki/` com nome seguindo a convenção `Specs-<Path-Derivado>.md`.
- [ ] Links entre specs são reescritos para nomes de página wiki. Links para código/scripts apontam para `https://github.com/lucasmm96/meufenil/blob/master/<path>`. Links externos e âncoras não são alterados.
- [ ] `wiki/Specs.md` existe como hub principal com links para sub-hubs (`Specs-Current.md`, `Specs-Proposed.md`, `Specs-Decisions.md`, `Specs-Templates.md`).
- [ ] Sub-hubs existem e listam os arquivos do respectivo diretório, agrupados por subdiretório quando aplicável.
- [ ] `wiki/Home.md` contém link para "Specs do Projeto".
- [ ] `wiki/_Sidebar.md` contém seção "Specs" com link para `Specs.md`.
- [ ] Execuções subsequentes do wiki-documenter regeneram apenas páginas cujas fontes mudaram (controle incremental comprovado por log).
- [ ] Nenhuma página da documentação pública existente é alterada ou removida.

## References

- Draft: `proposed/draft/005-specs-reflected-on-wiki.md` (arquivar após esta spec ser criada)
- [FEAT-0016](Specs-Archive-Implemented-Features-FEAT-0016-Geracao-Automatica-De-Documentacao-Via-Agente-Wiki-Documenter) — wiki-documenter
- [ENH-0005](Specs-Archive-Implemented-Enhancements-ENH-0005-Revisao-Tooling-Ia) — revisão do tooling de IA (precedente de extensão)
- [`.github/workflows/sync-wiki.yml`](https://github.com/lucasmm96/meufenil/blob/master/.github/workflows/sync-wiki.yml) — workflow de sincronização
- [`.ai/specs/CONVENTIONS.md`](Specs-CONVENTIONS) — governança do Specification System
