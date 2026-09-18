# ENH-0007 — Compatibilidade multi-ferramenta do AI Tooling

**Type:** ENH
**Status:** IMPLEMENTED
**Title:** Compatibilidade multi-ferramenta do AI Tooling
**Issue:** #84
**Created on:** 2026-09-17

**Implemented Through:** `AGENTS.md` (instrução universal) + `GEMINI.md` (wrapper Gemini CLI) criados na raiz — branch `enhancement/ENH-0007-compatibilidade-multi-ferramenta` — PR `Part of #84` — 2026-09-18

## Problem

O tooling de IA do projeto foi construído integralmente para Claude Code, com CLAUDE.md e `.claude/` como pontos de entrada proprietários. Se o dev optar por outra ferramenta — Codex, GitHub Copilot, Cursor, Windsurf, Gemini CLI ou outras — ela não encontra ponto de entrada equivalente para compreender o Specification System, as convenções de trabalho, os papéis dos agentes especializados e os fluxos operacionais, limitando a portabilidade do tooling ao Claude Code.

## Current State

O tooling de IA é composto por:

- **`CLAUDE.md`** (raiz): manual operacional completo — convenções, workflows, stop conditions, fronteira de decisão humana. Formato e localização específicos do Claude Code.
- **`.claude/agents/`**: 9 agentes especializados com papéis e fronteiras bem definidos — primitiva Claude Code-específica.
- **`.claude/commands/`**: 3 slash commands locais (`check-release`, `run-tests`, `sync-specs`) — primitiva Claude Code-específica.
- **`.claude/skills/`**: 1 skill local (`spec-navigation`) com carregamento progressivo de contexto — primitiva Claude Code-específica.
- **`.ai/specs/`**: Specification System completo em Markdown puro — universalmente legível por qualquer ferramenta com acesso a arquivos.

Ausência de qualquer arquivo de contexto para ferramentas além do Claude Code.

→ Tooling atual em [`CLAUDE.md`](../../CLAUDE.md), [`.claude/`](../../.claude/) e [`.ai/specs/`](../).

## Proposed State

Abordagem híbrida: `AGENTS.md` como arquivo de contexto universal (padrão de facto do mercado) complementado por arquivos nativos condicionais — sem alterar CLAUDE.md, `.claude/` ou `.ai/specs/`.

### Componente 1 — `AGENTS.md` na raiz (universal)

`AGENTS.md` é o padrão gerido pela Agentic AI Foundation sob a Linux Foundation, lido nativamente por Codex, GitHub Copilot, Cursor, Windsurf, Amp, Devin, Jules do Google e outros. Claude Code também o lê (CLAUDE.md permanece seu formato nativo mais rico).

Conteúdo de `AGENTS.md`:
- Descrição do projeto e localização do Specification System (`.ai/specs/`).
- Instruções de navegação progressiva de contexto (equivalente ao §3 do CLAUDE.md, sem sintaxe Claude Code-específica).
- Convenções essenciais: branches, commits, stop conditions, fronteira de decisão humana.
- **Papéis dos agentes especializados** — cada papel descrito como "comportamento que a IA deve adotar quando solicitado": nome, responsabilidade, quando invocar, o que pode/não pode fazer, stop conditions. Tradução da estrutura `.claude/agents/` para linguagem neutra, sem primitivas de subagente.
- Representação das skills e commands relevantes como seções de instrução (sem primitivas Claude Code).
- Referência a CLAUDE.md (Claude Code) e a GEMINI.md (Gemini CLI, se necessário) para configuração nativa mais rica.

### Componente 2 — `CLAUDE.md` (inalterado)

Permanece como está. Nenhuma alteração.

### Componente 3 — `GEMINI.md` (condicional)

Criado somente se a Fase 1 confirmar que o Gemini CLI não lê AGENTS.md nativamente e que o gap é significativo o suficiente para justificar um arquivo separado.

### Componente 4 — Arquivos por ferramenta (condicional)

Criados somente se a Fase 1 identificar ferramentas-alvo que não leem AGENTS.md e que justifiquem um arquivo nativo dedicado. Ferramentas já cobertas por AGENTS.md não recebem arquivo adicional.

### Sequência de implementação

Nenhum arquivo criado ou modificado antes das fases:

1. **Fase 1 — Gap analysis:** verificar convenções nativas de cada ferramenta-alvo principal; confirmar o que cada uma lê/não lê; determinar necessidade do GEMINI.md e de outros arquivos condicionais.
2. **Fase 2 — Plano detalhado aprovado:** estrutura e conteúdo completos do AGENTS.md; decisão sobre componentes condicionais; aprovação humana antes de qualquer criação.
3. **Fase 3 — Implementação item a item:** cada arquivo/seção apresentado com confirmação explícita antes de aplicar.
4. **Fase 4 — Validação:** teste com as ferramentas disponíveis; documentação de limitações por ferramenta.

## Motivation

**[CONFIRMED]** AGENTS.md é um padrão emergente lido nativamente por Codex, GitHub Copilot, Cursor, Windsurf, Amp, Devin e Jules do Google — gerido pela Agentic AI Foundation sob a Linux Foundation. Evidência: [agents.md](https://agents.md/); [AGENTS.md Spec 2026](https://www.morphllm.com/agents-md-guide); [Cross-tool guide 2026](https://www.deployhq.com/blog/ai-coding-config-files-guide).

**[CONFIRMED]** Claude Code lê AGENTS.md além de CLAUDE.md (CLAUDE.md permanece o formato nativo mais rico). Evidência: [AGENTS.md vs CLAUDE.md 2026](https://dev.to/pederaa/agentsmd-vs-claudemd-which-context-file-should-your-coding-agents-use-in-2026-2ngb).

**[CONFIRMED]** Gemini CLI usa GEMINI.md como arquivo nativo; compatibilidade com AGENTS.md a verificar na Fase 1. Evidência: [cross-tool guide](https://www.deployhq.com/blog/ai-coding-config-files-guide).

**[CONFIRMED]** `.ai/specs/` é Markdown puro, universalmente legível — a principal lacuna não é o Specification System (já genérico), mas a ausência de um ponto de entrada que descreva papéis, convenções e fluxos no formato que as ferramentas reconhecem. Evidência: estrutura do diretório; ausência de AGENTS.md no repositório.

**[INFERRED]** Os papéis dos agentes Claude (`.claude/agents/`) não têm equivalente como primitiva de execução em outras ferramentas, mas podem ser representados como "papéis de comportamento" em linguagem natural — qualquer ferramenta entende instruções de papel em texto. Basis: natureza das primitivas de agente no Claude Code vs. arquitetura de instrução de sistema das demais ferramentas.

**[INFERRED]** A prática recomendada no ecossistema 2026 é: instruções compartilhadas em AGENTS.md + configuração nativa rica no arquivo da ferramenta. Basis: múltiplas fontes do setor (deployhq, morphllm, augmentcode) convergindo na mesma recomendação.

## Evidence

- Draft original: `.ai/specs/proposed/draft/archive/006-generic-ai-tooling.md`.
- ENH-0005 (IMPLEMENTED) — tooling Claude Code revisado e estabilizado em 2026-09-15; pré-requisito satisfeito.
- AGENTS.md standard: [agents.md](https://agents.md/) (Agentic AI Foundation / Linux Foundation).
- Suporte por ferramenta documentado em [deployhq.com/blog/ai-coding-config-files-guide](https://www.deployhq.com/blog/ai-coding-config-files-guide).

## Scope

- Gap analysis: convenções nativas de Codex, GitHub Copilot, Cursor, Windsurf, Gemini CLI, Amp e de outras ferramentas relevantes identificadas na Fase 1.
- Criação de `AGENTS.md` na raiz em conformidade com o padrão Agentic AI Foundation.
- Tradução dos papéis de `.claude/agents/` para linguagem neutra no AGENTS.md (sem primitivas Claude Code).
- Representação das skills e commands relevantes como seções de instrução no AGENTS.md.
- Criação condicional de `GEMINI.md` e outros arquivos nativos se justificados na Fase 1.
- Documentação de limitações por ferramenta (o que não é replicável sem primitivas Claude Code).

## Out of Scope

- Alteração de `CLAUDE.md` ou `.claude/` (agentes, skills, commands) — extensão apenas.
- Alteração de `.ai/specs/` — já universalmente legível.
- Criação de arquivos por ferramenta já cobertos nativamente por AGENTS.md.
- Alterações em features, regras de negócio, schema, segurança ou infraestrutura do sistema MeuFenil.
- Nenhuma implementação antes de gap analysis e plano aprovados.

## Impacted Features

N/A — exclusivamente tooling de IA.

## Impacted Business Rules

N/A

## Impacted Architecture

- **`AGENTS.md`** (raiz): novo arquivo de contexto universal — adição.
- **`GEMINI.md`** (raiz): novo arquivo condicional para Gemini CLI — adição se necessário.
- **`CLAUDE.md`** e **`.claude/`**: sem alteração.
- **`.ai/specs/`**: sem alteração.

## Impacted Frontend / Backend / Database / Security / Tests

- **Frontend:** N/A
- **Backend:** N/A
- **Database:** N/A
- **Security:** N/A
- **Tests:** N/A

## Dependencies

- ENH-0005 (IMPLEMENTED) — tooling Claude Code revisado; estado atual estável e documentado. Pré-requisito satisfeito.

## Risks

- **[INFERRED] Drift entre AGENTS.md e CLAUDE.md:** dois arquivos de contexto podem divergir ao longo do tempo. Mitigação: AGENTS.md referencia `.ai/specs/` como fonte de verdade e não duplica conteúdo — aponta para ele. CLAUDE.md mantém o detalhamento Claude Code-específico separado.
- **[INFERRED] Papéis em texto têm interpretação variável por ferramenta:** sem primitivas de execução, diferentes ferramentas podem interpretar os papéis de forma diferente. Mitigação: documentar explicitamente que outras ferramentas adotam papéis como contexto comportamental, não como subagentes; documentar limitações.
- **[ASSUMED] Padrão AGENTS.md ainda em evolução:** a Agentic AI Foundation geriu o padrão a partir de 2026; futuras revisões podem exigir atualização. Mitigação: AGENTS.md como fonte primária; arquivos nativos como wrappers — mudanças futuras concentradas em um ponto.
- **[UNKNOWN]** Compatibilidade do Gemini CLI com AGENTS.md — pode eliminar a necessidade de GEMINI.md ou exigir abordagem diferente. Verificar na Fase 1.

## Alternatives

- **Alternativa A — AGENTS.md único (sem arquivos condicionais):** cobrir todas as ferramentas com AGENTS.md e aceitar limitações para Gemini CLI. Simples de manter; pode deixar Gemini sem suporte adequado.
- **Alternativa B — Arquivo por ferramenta (sem universal):** criar um arquivo nativo para cada ferramenta-alvo. Compatibilidade máxima por ferramenta; manutenção multiplicada; sem fonte de verdade única.
- **Alternativa C — Híbrido (esta proposta):** AGENTS.md como fonte universal + arquivos nativos condicionais onde necessário. Equilíbrio entre compatibilidade e manutenibilidade; complexidade moderada.
- **Alternativa D — Status quo:** manter somente CLAUDE.md. Zero esforço; portabilidade zero para outras ferramentas.

**Decision:** Alternativa C — Híbrido: `AGENTS.md` como instrução universal + `GEMINI.md` condicional para o Gemini CLI (confirmada gap analysis Fase 1: Gemini CLI não lê AGENTS.md automaticamente, requer configuração manual).
**Approved by:** Lucas Martins Menezes
**Approved on:** 2026-09-18

## Open Questions

1. **Gemini CLI lê AGENTS.md nativamente?** → **RESOLVED:** Parcialmente — requer configuração manual via `context.fileName` em `settings.json`. Arquivo nativo padrão é `GEMINI.md`. **Decisão:** criar `GEMINI.md` mínimo com referência a `AGENTS.md` e instrução de configuração.
2. **Há alguma ferramenta-alvo que o dev já usa hoje além do Claude Code?** → **RESOLVED:** Nenhuma atualmente; objetivo é preparar o projeto para adoção futura de qualquer ferramenta (Cursor, Copilot, Windsurf, Gemini CLI, etc.).
3. **Cobertura de papéis no AGENTS.md:** → **RESOLVED:** Todos os 9 agentes — os 8 de invocação direta (`spec-assistant`, `spec-manager`, `github-manager`, `project-manager`, `pr-manager`, `release-manager`, `test-manager`, `wiki-documenter`) + `release-notes` descrito como subordinado do `release-manager`.
4. **Idioma do AGENTS.md:** → **RESOLVED:** PT-BR — consistência com `CLAUDE.md` e `.ai/specs/`.

## Acceptance Criteria

- [ ] Gap analysis produzido: convenções nativas de cada ferramenta-alvo verificadas; lista do que cada uma lê/não lê documentada; necessidade de GEMINI.md e arquivos condicionais determinada.
- [ ] Plano detalhado (estrutura e conteúdo completos do AGENTS.md) produzido e aprovado pelo humano antes de qualquer criação de arquivo.
- [ ] `AGENTS.md` criado na raiz em conformidade com o padrão Agentic AI Foundation, contendo: contexto do projeto, referência ao Specification System, convenções essenciais de trabalho, papéis dos agentes como comportamento neutro, representação de skills e commands relevantes.
- [ ] Qualquer ferramenta que lê AGENTS.md nativamente (Codex, Copilot, Cursor, Windsurf, Amp) consegue: localizar o Specification System (`.ai/specs/`); identificar convenções de trabalho (branches, stop conditions, fronteira humana); adotar os papéis dos agentes especializados quando solicitado.
- [ ] `CLAUDE.md` e `.claude/` sem nenhuma alteração.
- [ ] `.ai/specs/` sem nenhuma alteração.
- [ ] Limitações por ferramenta documentadas (o que não é replicável sem primitivas Claude Code).
- [ ] `GEMINI.md` criado se necessário (condicional à Fase 1); ausente se AGENTS.md for suficiente.
- [ ] Implementação item a item com confirmação explícita antes de cada mudança.
- [ ] Nenhuma feature, regra de negócio, schema ou segurança do sistema MeuFenil alterada.

## References

- Draft original: `.ai/specs/proposed/draft/archive/006-generic-ai-tooling.md`
- ENH-0005 (IMPLEMENTED): [`.ai/specs/archive/implemented/enhancements/ENH-0005-revisao-tooling-ia.md`](../../archive/implemented/enhancements/ENH-0005-revisao-tooling-ia.md)
- Tooling atual: [`CLAUDE.md`](../../CLAUDE.md), [`.claude/agents/`](../../.claude/agents/), [`.ai/specs/`](../)
- AGENTS.md standard: [agents.md](https://agents.md/) (Agentic AI Foundation / Linux Foundation)
- Suporte por ferramenta (2026): [deployhq.com/blog/ai-coding-config-files-guide](https://www.deployhq.com/blog/ai-coding-config-files-guide)
- Comparativo AGENTS.md vs CLAUDE.md: [dev.to/pederaa/agentsmd-vs-claudemd](https://dev.to/pederaa/agentsmd-vs-claudemd-which-context-file-should-your-coding-agents-use-in-2026-2ngb)
- Guia AGENTS.md (2026): [morphllm.com/agents-md-guide](https://www.morphllm.com/agents-md-guide)
- Convenções: [`.ai/specs/CONVENTIONS.md`](../CONVENTIONS.md)
