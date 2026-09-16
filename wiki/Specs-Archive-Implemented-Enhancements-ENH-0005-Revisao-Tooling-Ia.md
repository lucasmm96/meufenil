# ENH-0005 — Revisão e melhoria do tooling de IA do projeto

**Type:** ENH
**Status:** IMPLEMENTED
**Title:** Revisão e melhoria do tooling de IA do projeto
**Issue:** #76
**Created on:** 2026-09-15

**Implemented Through:** commits `ccf8733` (Fase 4) + `bc880ef` (Fase 5, wiki) — branch `development` — 2026-09-15

## Problem

O tooling de IA do projeto (agents, skills, commands, configurações em `.claude/`) cresceu organicamente ao longo de múltiplas fases sem revisão holística de qualidade, consistência e lacunas — gerando sobreposição de responsabilidades, fronteiras mal definidas entre agentes e ausência de documentação pública consolidada. Adicionalmente, os prompts dos agentes cresceram sem auditoria de footprint, gerando custo de tokens desnecessário por redundância e contexto não essencial carregado a cada invocação; e certas tarefas hoje delegadas a agentes IA poderiam ser executadas por scripts determinísticos — mais baratos, mais rápidos e sem dependência de modelo. Por fim, não existe documentação orientada ao uso prático (how-to) do tooling, o que dificulta a onboarding e o uso eficiente por qualquer membro do projeto.

## Current State

O projeto possui agentes especializados em `.claude/agents/` (wiki-documenter, spec-manager, spec-assistant, github-manager, pr-manager, project-manager, release-manager, release-notes, test-manager e outros). Convenções gerais estão em `CLAUDE.md` (raiz) e `.ai/specs/CONVENTIONS.md`. Não existem skills locais (`.claude/skills/`) nem slash commands locais (`.claude/commands/`) criados pelo projeto. A documentação pública do tooling na wiki é ausente ou incompleta.

→ Estado atual em [`current/`](Specs-Archive-Implemented-Enhancements-.ai-Specs-Current) e agentes em [`.claude/agents/`](Specs-Archive-Implemented-Enhancements-.claude-Agents).

## Proposed State

Revisão holística conduzida em cinco fases sequenciais, com aprovação humana a cada etapa:

1. **Fase 1 — Descoberta e inventário:** percurso completo do repositório; inventário factual de todo tooling existente (agents, skills, commands, hooks, permissões, MCPs, output styles), com tags de evidência (`[CONFIRMED]`, `[INFERRED]`, `[ASSUMED]`, `[UNKNOWN]`); estimativa de footprint de tokens por agent (tamanho do prompt em caracteres, sobreposição com `CLAUDE.md` raiz); identificação de tarefas candidatas a substituição por script determinístico.
2. **Fase 2 — Plano:** documento em `.ai/.temp/analyses/` com inventário, oportunidades agrupadas por tema (achado + proposta + justificativa + impacto + risco + alternativas), ordem de execução sugerida e rascunho da estrutura wiki. Temas obrigatórios no plano: (a) melhorias de qualidade/consistência dos agents; (b) economia de tokens — redundância, boilerplate e contexto não essencial; (c) scripts determinísticos — tarefas candidatas a sair do domínio IA; (d) novas skills e commands; (e) outros itens de configuração; (f) estrutura da wiki how-to.
3. **Fase 3 — Decisão interativa:** apresentação do plano em blocos temáticos; para cada item, decisão humana registrada (aprovar / rejeitar / adiar / modificar). Sem avançar enquanto houver item sem decisão.
4. **Fase 4 — Execução:** para cada item aprovado, diff apresentado, confirmação explícita ("pode aplicar") aguardada, e então aplicado. Inclui: edições de agents existentes, criação de skills locais (`.claude/skills/<nome>/SKILL.md`), criação de slash commands (`.claude/commands/*.md`), e outros itens aprovados (hooks, output styles, permissões em `settings.json`, servidores MCP, `CLAUDE.md` por subdiretório).
5. **Fase 5 — Documentação na wiki (how-to):** somente após todas as execuções da Fase 4 aprovadas. Documentação em PT-BR em `meufenil.wiki.git` orientada ao **uso prático**, não à referência técnica — cada página é um how-to com exemplos reais extraídos do próprio repositório (invocações concretas, saídas esperadas, casos de erro comuns e como resolvê-los). Público: qualquer engenheiro do projeto que precise usar ou evoluir o tooling. Estrutura mínima: hub de índice linkando sub-páginas; sub-página por agent (quando invocar, como invocar, exemplo real, fronteira e stop conditions); sub-página por skill (o que é, quando carrega, exemplo de uso); sub-página por command (o que faz, quando usar, exemplo); sub-página de scripts determinísticos (quais existem, quando usar em vez de IA, como executar); sub-página de convenções transversais (evidências, fronteira humana, dedup); sub-página "como contribuir/evoluir o tooling".

## Motivation

**[CONFIRMED]** O tooling cresceu incrementalmente desde ADR-0012 sem revisão de conjunto — evidenciado pela ausência de revisão holística nos ADRs e histórico de fases.

**[INFERRED]** Há lacunas de automação endereçáveis por skills ou commands locais. Basis: volume de agentes especializados + ausência de qualquer skill/command local no repositório.

**[INFERRED]** Os prompts de agents acumulam contexto redundante (regras repetidas entre agents, boilerplate de stop conditions já coberto pelo `CLAUDE.md` raiz) que gera custo de tokens desnecessário a cada invocação. Basis: múltiplos agents criados em fases distintas sem revisão de sobreposição de conteúdo.

**[INFERRED]** Certas tarefas hoje delegadas a agentes IA (ex.: executar suite de testes, gerar relatório de status, sincronizar arquivos) são essencialmente determinísticas e poderiam ser implementadas como scripts shell/npm — eliminando o custo de tokens e a latência de modelo sem perda de resultado. Basis: ADR-0013 já estabelece o princípio de automações determinísticas para fluxos CI/CD; o mesmo princípio se aplica a sub-tarefas do tooling. Basis complementar: scripts existentes em `scripts/` demonstram que o projeto já adota essa abordagem para tarefas previsíveis.

**[ASSUMED]** A wiki carece de documentação orientada ao uso prático (how-to) do tooling. Precisa ser verificado em `meufenil.wiki.git` antes da Fase 5.

## Evidence

- Ausência de `.claude/skills/` e `.claude/commands/` no repositório.
- Agentes criados em múltiplas fases do ADR-0012 sem revisão holística posterior.
- Draft `004-ai-enhancement.md` elaborado pelo responsável do projeto como direcionamento (arquivado em `draft/archive/`).

## Scope

- Revisão dos agents em `.claude/agents/` (qualidade, consistência, fronteiras, sobreposição).
- Auditoria de footprint de tokens de cada agent (tamanho do prompt, sobreposição com `CLAUDE.md`, redundância interna) e identificação de oportunidades de redução sem perda de eficiência ou cobertura.
- Análise de quais tarefas hoje delegadas a agentes IA são candidatas a substituição ou complementação por scripts determinísticos (`scripts/`, npm scripts, hooks shell) — alinhada ao princípio ADR-0013.
- Criação de skills locais e slash commands locais onde houver valor aprovado.
- Avaliação e proposta de: hooks, output styles, permissões em `settings.json`, servidores MCP, `CLAUDE.md` por subdiretório.
- Documentação pública na wiki em formato **how-to didático** — orientada ao uso prático, com exemplos reais extraídos do próprio projeto, cobrindo todo tooling aprovado e implementado.

## Out of Scope

- Alterações em `current/` (nenhuma spec de estado atual modificada por esta proposta).
- Criação de Issues ou movimentação de Project (responsabilidade do github-manager e project-manager).
- Commits, push ou criação de branch/PR sem confirmação explícita do humano.
- Alterações de schema, migrations, RLS, RPC ou qualquer item HIGH RISK do sistema de negócio.
- Implementação de qualquer item sem decisão humana individual aprovada.

## Impacted Features

N/A — esta proposta afeta exclusivamente o tooling de IA, não features do sistema MeuFenil.

## Impacted Business Rules

N/A

## Impacted Architecture

- `.claude/agents/` — agents existentes podem ser editados.
- `.claude/skills/` — diretório pode ser criado com novas skills.
- `.claude/commands/` — diretório pode ser criado com novos slash commands.
- `.claude/settings.json` — pode receber permissões adicionais.
- `CLAUDE.md` (raiz e possíveis subdiretórios) — pode receber ajustes.
- `meufenil.wiki.git` — documentação pública produzida na Fase 5.

## Impacted Frontend / Backend / Database / Security / Tests

- **Frontend:** N/A
- **Backend:** N/A
- **Database:** N/A
- **Security:** N/A (nenhuma alteração de autorização ou RLS)
- **Tests:** N/A (nenhum teste de aplicação afetado)

## Dependencies

Nenhuma.

## Risks

- **Edições de agents podem introduzir inconsistência com convenções do `.ai/`** — mitigado por leitura prévia das convenções antes de qualquer edição.
- **Skills/commands mal nomeados podem gerar confusão** — mitigado pelo processo de aprovação item a item.
- **Documentação na wiki pode divergir do tooling real** — mitigado pela regra de documentar somente o que estiver implementado e aprovado (Fase 5 após Fase 4 concluída).
- **[ASSUMED]** Versão instalada do Claude Code pode não suportar alguma primitiva proposta (skills locais, output styles) — mitigado pelo stop condition: propor como "pronto para quando suportado" e sinalizar.

## Alternatives

- **Alternativa A — Status quo:** manter o tooling sem revisão. Custo: drift acumula; documentação ausente permanece ausente. Risco: baixo imediato, médio no longo prazo.
- **Alternativa B — Revisão parcial (somente agents):** revisar apenas agents sem criar skills/commands. Mais conservador, menor esforço, menor valor.
- **Alternativa C — Esta proposta (revisão holística em fases):** maior esforço, decisão item a item, documentação completa ao final. Maior valor de longo prazo.

**Decision:** ACCEPTED
**Approved by:** Lucas Martins Menezes
**Approved on:** 2026-09-15

## Open Questions

1. Quais primitivas de Claude Code estão disponíveis na versão instalada? (skills locais, output styles, hooks — verificar antes da Fase 4)
2. Existe material na wiki atual sobre tooling de IA? (verificar `meufenil.wiki.git` antes da Fase 5)
3. Há algum agent ou item de tooling fora de `.claude/` que deva ser incluído no inventário?
4. Qual é a prioridade desta revisão em relação às propostas ativas (DEBT-0007, REF-0005, etc.)?
5. Existe baseline de tamanho/custo de tokens dos agents hoje que possa ser usado como referência para medir redução após a revisão?
6. Quais tarefas executadas hoje por agents são candidatas a scripts determinísticos? (a ser respondida na Fase 1 — não antecipar)

## Acceptance Criteria

- [x] Inventário factual de todo tooling de IA existente produzido e revisado, incluindo estimativa de footprint de tokens por agent e lista de tarefas candidatas a scripts determinísticos (Fase 1).
- [x] Plano de melhorias escrito em `.ai/.temp/analyses/` e aprovado item a item pelo humano, com os seis temas obrigatórios cobertos — incluindo "economia de tokens" e "scripts determinísticos" (Fases 2–3).
- [x] Auditoria de footprint de tokens dos agents concluída; oportunidades de redução identificadas, avaliadas no plano e — se aprovadas — aplicadas na Fase 4 sem remoção de cobertura funcional.
- [x] Para cada tarefa de agent identificada como candidata a script determinístico: proposta avaliada no plano (Fase 2–3); se aprovada, script criado/documentado na Fase 4.
- [x] Cada item aprovado implementado com diff apresentado e confirmação explícita antes de aplicar (Fase 4).
- [x] Wiki how-to publicada em PT-BR em `meufenil.wiki.git`, orientada ao uso prático com exemplos reais, cobrindo: agents, skills, commands, scripts determinísticos, convenções transversais e guia de contribuição (Fase 5).
- [x] Nenhuma alteração fora do escopo aprovado introduzida.
- [x] Nenhum commit/push/branch/PR criado sem confirmação explícita.

## References

- Draft original: `.ai/specs/proposed/draft/archive/004-ai-enhancement.md`
- Convenções do tooling: [`CLAUDE.md`](Specs-Archive-Implemented-Enhancements-CLAUDE) e [`.ai/specs/CONVENTIONS.md`](Specs-Archive-Implemented-Enhancements-.ai-Specs-CONVENTIONS)
- Agentes existentes: [`.claude/agents/`](Specs-Archive-Implemented-Enhancements-.claude-Agents)
- [ADR-0012](Specs-Archive-Implemented-Enhancements-.ai-Specs-Decisions) — lifecycle de fases (ADR-0012)
- [ADR-0013](Specs-Archive-Implemented-Enhancements-.ai-Specs-Decisions) — fluxos determinísticos (ADR-0013)
