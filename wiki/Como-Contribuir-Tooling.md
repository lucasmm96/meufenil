# Como Contribuir com o Tooling de IA

Guia para criar, evoluir ou corrigir agents, skills, slash commands e scripts do MeuFenil.

**Leia também:** [Ferramentas de IA](Ferramentas-IA) · [Convenções de Tooling](Convencoes-Tooling)

---

## Princípio geral

Mudanças no tooling de IA seguem o mesmo fluxo spec-driven das features de produto:
1. Ideia → proposta em `proposed/enhancements/` via `spec-assistant`.
2. Aprovação humana (Decision: ACCEPTED).
3. Implementação em work branch `enhancement/<ID>-<slug>`.
4. PR → aprovação → merge → housekeeping.

Mudanças pequenas (correção de referência quebrada, typo factual inequívoco) podem ser feitas diretamente, sem proposta formal — com commit descritivo e registro no CHANGELOG/notas da próxima release.

---

## Criar ou editar um agent

**Localização:** `.claude/agents/<nome>.md`

**Estrutura obrigatória (frontmatter YAML + body Markdown):**

```markdown
---
name: nome-do-agent
description: Uma linha clara: quando invocar e quando NÃO invocar.
tools: Read, Grep, Glob, Bash, Write, Edit
---

# Agente: nome-do-agent

## Descrição
...

> **Regras absolutas:** ver CLAUDE.md §8/§11/§12. [regras específicas do agent]

## Responsabilidades
...

## Quando NÃO invocar
...

## Stop conditions (fronteira humana)
PARE e reporte quando: [condições específicas do agent]
```

**Regras para agents:**
- A `description` determina quando o Claude seleciona o agent — seja específico sobre quando invocar E quando não invocar.
- **Não duplique** o bloco "Regras transversais" (§15.0 do Blueprint) — já coberto pelo CLAUDE.md raiz. Use a linha `> **Regras absolutas:** ver CLAUDE.md §8/§11/§12.` + regras específicas do agent.
- Não inclua o boilerplate de formato das stop conditions ("Explique: (1) achado; (2) por que é ambíguo...") — já coberto pelo CLAUDE.md §8.
- Tools: liste somente os tools que o agent realmente usa.
- Idempotência: documente como o agent evita duplicação.

**Verificar antes de criar:** existe um agent que já faz isso? Consulte `.claude/agents/` e o inventário em `.ai/.temp/analyses/51-enh0005-tooling-ia-inventario-plano.md`.

---

## Criar ou editar uma skill

**Localização:** `.claude/skills/<nome>/SKILL.md`

**Estrutura obrigatória:**

```markdown
---
name: nome-da-skill
description: >
  Trigger words e contexto de quando carregar. O Claude usa isso para decidir
  se carrega a skill automaticamente. Use palavras-chave relevantes.
---

# Conteúdo da skill

Instruções, tabelas de referência, ou contexto detalhado que seria carregado
apenas quando necessário — em vez de ocupar espaço fixo no CLAUDE.md.
```

**Regras para skills:**
- A `description` é crítica — ela determina o carregamento automático. Use palavras-chave específicas que o usuário provavelmente usará ao acionar o contexto.
- Use skills para contexto que é relevante em apenas um subconjunto das sessões (não para regras globais, que ficam no CLAUDE.md).
- Exemplo: `spec-navigation` só é relevante quando o usuário está navegando specs ou implementando features.

**Skills globais** (válidas em todos os projetos): instaladas em `~/.claude/skills/<nome>/SKILL.md` — não edite aqui.

---

## Criar ou editar um slash command

**Localização:** `.claude/commands/<nome>.md`

**Estrutura:** texto de instrução puro (Markdown) — o Claude executa as instruções quando o usuário digita `/<nome>`.

```markdown
Faça X seguindo estes passos:

1. Execute `npm run y` e apresente o resultado.
2. Se resultado Z, informe W.
...
```

**Regras para commands:**
- Sem frontmatter YAML (diferente de agents e skills).
- Limite a tarefas bem definidas e frequentes — se exige julgamento contextual, use um agent.
- Inclua safeguards (dry-run antes do real, confirmação antes de ações irreversíveis).
- Referência a agents: "Para [tarefa mais complexa], use o agent `nome-do-agent` via ferramenta Agent."

---

## Criar ou editar um script determinístico

**Localização:** `scripts/`

**Regras (ADR-0013):**
- Scripts não chamam IA — são 100% determinísticos.
- Se a lógica requer síntese, julgamento ou redação: use um agent, não um script.
- Scripts existentes: `scripts/spec-github/`, `scripts/cli/`, `scripts/wiki-precheck.js`, `scripts/apply-supabase-migrations.sh`.
- Novos scripts: adicione entrada em `package.json` se for um workflow de uso frequente.
- Teste o dry-run antes de implementar o modo "real".

---

## Fluxo de aprovação para mudanças no tooling

```
Ideia → spec-assistant (formalizar como ENH-XXXX em proposed/enhancements/)
      → spec-manager (registrar, manter index.md)
      → github-manager (criar Issue canônica)
      → APROVAÇÃO HUMANA (Decision: ACCEPTED na spec)
      → work branch enhancement/enh-XXXX-slug
      → Implementação (agent/skill/command/script)
      → Tests (se aplicável)
      → PR (Part of #N)
      → Aprovação humana → merge
      → Housekeeping (arquivar spec, fechar Issue, atualizar Project)
      → Atualizar esta wiki (se necessário)
```

Para mudanças menores (correções, typos, referências quebradas):
```
Identificar → corrigir diretamente → commit descritivo → registrar em notas da próxima release
```

---

## Checklist antes de submeter uma mudança de tooling

- [ ] Não duplica bloco "Regras transversais" em agents.
- [ ] Description do agent é específica (quando invocar E quando NÃO).
- [ ] Skill tem description com trigger words relevantes.
- [ ] Script não chama IA; tem dry-run se aplicável.
- [ ] Esta wiki foi atualizada se o comportamento mudou.
- [ ] ENH spec (se criada) foi arquivada e Issue fechada após merge.
