# Ferramentas de IA do MeuFenil

O MeuFenil usa **Claude Code** como plataforma de IA interativa. Toda invocação é manual — nenhum fluxo automático (CI/CD) chama IA (ADR-0013). Este hub descreve como o tooling está organizado.

## Visão geral

```
Sessão Claude Code (interativa)
├── Agents (.claude/agents/*.md)     — especialistas por artefato/domínio
├── Skills (.claude/skills/*/SKILL.md) — contexto carregado sob demanda
├── Slash Commands (.claude/commands/*.md) — atalhos para tarefas rotineiras
└── Scripts (scripts/*.js / *.sh)    — lógica determinística, sem IA
```

As regras absolutas de comportamento estão em **CLAUDE.md** (raiz) — carregado em toda sessão.

## Agents disponíveis

| Agent | Artefato | Quando invocar |
|---|---|---|
| `github-manager` | Issues GitHub | Criar/atualizar Issues a partir de Specs |
| `pr-manager` | Pull Requests | Criar PRs com o template do projeto |
| `project-manager` | GitHub Project | Sincronizar status do backlog |
| `release-manager` | Lifecycle de release | Preparar uma nova release (branch, notas, draft) |
| `release-notes` | Release notes | Reescrever histórico de commits em notas estruturadas |
| `spec-manager` | Specs (proposed/) | Criar/editar specs formais, arquivar, auditar |
| `spec-assistant` | Rascunhos → Specs | Transformar ideias em specs formais via diálogo |
| `test-manager` | Verificação | Executar suítes e validar ACs com evidência |
| `wiki-documenter` | Documentação (wiki/) | Gerar/atualizar páginas da wiki (hash-based) |

Mais detalhes: [Agentes de Gestão de Projeto](Agentes-Gestao-Projeto) · [Agentes de Release](Agentes-Release) · [Agentes de Spec](Agentes-Spec) · [Agente de Verificação](Agente-Verificacao) · [Agente Wiki](Agente-Wiki)

## Skills disponíveis

| Skill | Quando é carregada |
|---|---|
| `spec-navigation` | Ao navegar specs, implementar features, buscar o system-map |
| `caveman` _(global)_ | Quando o usuário usa modo de fala primitivo |

Mais detalhes: [Skills e Commands](Skills-e-Commands)

## Slash Commands

| Command | O que faz |
|---|---|
| `/run-tests` | Executa `test:run`, `lint`, `build` e reporta resultado |
| `/sync-specs` | Sync dry-run + confirmação → `spec:github:sync` |
| `/check-release` | Executa o gate de release (`spec:github:gate:dry`) |

## Scripts determinísticos

Lógica sem IA em `scripts/`:

- `scripts/spec-github/` — sync Spec↔Issue, Project sync, gate de release, verificação pós-release, reconciliação, resposta a Issues externas
- `scripts/cli/` — CLI interna Supabase
- `scripts/wiki-precheck.js` — hash-based precheck para wiki incremental
- `scripts/apply-supabase-migrations.sh` — aplicação de migrations

Mais detalhes: [Scripts Determinísticos](Scripts-Deterministicos)

## Convenções e fronteiras

- **Fronteira humana (D-12/D-13):** decisões de negócio, aprovações, push, tag e publicação de release são sempre humanas.
- **Evidências:** `[CONFIRMED]` · `[INFERRED]` · `[ASSUMED]` · `[UNKNOWN]` — nunca preencha UNKNOWN por conveniência.
- **Sem IA em automação:** GitHub Actions é 100% determinístico (ADR-0013).

Mais detalhes: [Convenções de Tooling](Convencoes-Tooling) · [Como Contribuir com o Tooling](Como-Contribuir-Tooling)
