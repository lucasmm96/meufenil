# Skills e Slash Commands

Skills e slash commands do MeuFenil — atalhos e contexto carregado sob demanda.

**Leia também:** [Ferramentas de IA](Ferramentas-IA) · [Como Contribuir com o Tooling](Como-Contribuir-Tooling)

---

## Skills

Skills são arquivos de instrução carregados automaticamente pelo Claude Code quando o contexto da conversa os aciona. Reduzem o footprint do CLAUDE.md principal mantendo contexto detalhado disponível apenas quando necessário.

### spec-navigation (projeto)

**Localização:** `.claude/skills/spec-navigation/SKILL.md`

**Quando é carregada automaticamente:** ao navegar specs, implementar features, localizar capabilities no system-map, buscar business rules, ou antes de ler código para entender comportamento existente.

**O que contém:** os 8 passos de Progressive Context Loading do Specification System:

1. `system-map` → identifique a capability e camadas afetadas
2. Feature Spec → comportamento detalhado
3. Business Rules → BR-NNN e traceability
4. Camadas afetadas → frontend / backend / database / security
5. Testing → testing-strategy + testes existentes
6. Architecture/ADRs → somente com impacto arquitetural
7. Proposed → existe proposta relacionada? UNKNOWN relevante?
8. Código → somente o citado nas evidências

**Tabela de pontos de entrada rápidos** (system-map, arquitetura, governança, propostas, testes, ADRs, templates) também está incluída na skill.

### Skills globais (caveman)

Skills instaladas globalmente que funcionam em todos os projetos Claude Code:

| Skill | Propósito |
|---|---|
| `caveman` | Modo de fala primitivo/simplificado |
| `caveman-compress` | Compressão do histórico de contexto |
| `caveman-help` | Ajuda sobre as skills caveman |
| `caveman-manage` | Gestão das skills caveman |
| `caveman-optimize` | Otimização de prompts |
| `caveman-stats` | Estatísticas de uso |

---

## Slash Commands

Slash commands são arquivos em `.claude/commands/*.md` — invocados com `/nome-do-command` na sessão Claude Code. São instruções prontas para tarefas rotineiras.

### /run-tests

**Localização:** `.claude/commands/run-tests.md`

**O que faz:**
1. Executa `npm run test:run` (vitest run — suíte completa)
2. Executa `npm run lint` (eslint)
3. Executa `npm run build` (tsc -b && vite build)

Reporta: comando executado · resultado (passou/falhou) · contagem de testes/erros · falhas detalhadas.

Testes de segurança pulados sem `SUPABASE_SERVICE_ROLE_KEY` são registrados como SKIP (não como falha).

**Quando usar:** verificação rotineira antes de commit ou push. Para validação de ACs com evidência, use o agent `test-manager`.

### /sync-specs

**Localização:** `.claude/commands/sync-specs.md`

**O que faz:**
1. Executa `npm run spec:github:sync:dry` e apresenta o output completo (dry-run).
2. Pergunta confirmação: "Confirma a execução do sync real? (sim/não)".
3. Somente após confirmação executa `npm run spec:github:sync`.
4. Reporta: Issues criadas, atualizadas, ignoradas.

**Importante:** o sync nunca fecha Issues (fechamento é decisão humana — D-12).

**Quando usar:** após criar/editar specs em `proposed/` e querer sincronizar com o GitHub.

### /check-release

**Localização:** `.claude/commands/check-release.md`

**O que faz:**
- Executa `npm run spec:github:gate:dry` e interpreta o resultado:
  - **Verde:** lista o que foi verificado, confirma que a release pode prosseguir.
  - **Vermelho:** lista cada item bloqueador e o que precisa ser resolvido.
- Indica o próximo passo (preparar release ou resolver bloqueadores).

**Quando usar:** antes de invocar o `release-manager` para uma nova release.
