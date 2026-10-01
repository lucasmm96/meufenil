# ENH-0013 — Biblioteca de scripts determinísticos para workflows de IA (`scripts/ai-workflows/`)

**Type:** ENH
**Status:** IMPLEMENTED
**Title:** Biblioteca de scripts determinísticos para workflows de IA (`scripts/ai-workflows/`)
**Issue:** #103
**Created on:** 2026-10-01
**Implemented Through:** commits 2edabdd, b275838, 707bd62 em `development` (2026-10-01)

## Problem

Processos com fluxo fixo e repetitivo nos workflows de IA do projeto consomem tokens desnecessariamente quando o agente os executa de forma dinâmica; esses processos são candidatos a encapsulamento em scripts determinísticos gerenciados pela IA.

## Current State

O projeto possui suporte robusto à IA em `.ai/specs/` (regras, especificações, convenções, playbooks, agentes) e scripts operacionais em `scripts/` (migrations, CLI, spec-github, wiki-precheck). A IA executa todos os seus workflows de forma dinâmica — interpretando o pedido, montando o fluxo e executando passo a passo a cada sessão, mesmo para processos de fluxo fixo e previsível `[CONFIRMED: filesystem]`. Não existe um diretório dedicado a scripts gerenciados pela IA dentro de `.ai/` `[CONFIRMED: filesystem]`.

## Proposed State

Criar o diretório `scripts/ai-workflows/` dentro de `scripts/` (ponto único de acesso para todos os scripts do projeto) como biblioteca de scripts determinísticos para processos elegíveis identificados na varredura documentada nesta spec. A IA mantém seu papel de gerenciamento e orquestração: invoca os scripts via Bash, analisa o output JSON estruturado e age sobre os resultados — sem gastar tokens refazendo dinamicamente o que é fixo. O processo de implementação exige, nesta ordem: (1) aprovação humana desta spec; (2) implementação dos scripts elegíveis confirmados na seção de análise abaixo; (3) documentação da interface em `scripts/ai-workflows/README.md`.

## Motivation

- **FACTUAL:** A IA executa múltiplos workflows repetitivos a cada sessão (sincronização de specs, verificação de release, execução de testes, atualização de índices) com fluxo previsível e pouco variável.
- **FACTUAL:** Scripts determinísticos já existem em `scripts/spec-github/` e `scripts/cli/` para automações operacionais, demonstrando que o padrão é viável e aceito no projeto. A biblioteca `scripts/spec-github/lib/specs.js` já implementa `listSpecs()` e `parseSpec()` reutilizáveis.
- **ASSUMPTION:** A fração de tokens gasta na fase de "entendimento e montagem dinâmica" de processos repetitivos é suficientemente significativa para justificar o investimento de criação e manutenção dos scripts (hipótese — não quantificada).
- **ASSUMPTION:** A maioria dos workflows candidatos possui fronteira clara entre a parte determinística (elegível a script) e a parte que exige interpretação da IA.

## Evidence

- Draft `007-local-scripts-possibility.md` (autoria do usuário, 2026-10-01) — arquivado em `proposed/draft/archive/`
- [ENH-0005](../../archive/implemented/enhancements/ENH-0005-revisao-tooling-ia.md) (Revisão e melhoria do tooling de IA — IMPLEMENTED)
- [ENH-0007](../../archive/implemented/enhancements/ENH-0007-compatibilidade-multi-ferramenta-ai-tooling.md) (Compatibilidade multi-ferramenta — IMPLEMENTED)
- Existência de playbooks em `.claude/playbooks/` e agentes em `.claude/agents/` que descrevem workflows parcialmente fixos
- Varredura completa documentada na seção "Análise Pré-Implementação" abaixo (2026-10-01)

## Scope

1. Reorganização de `scripts/` em subdiretórios por domínio (detalhada na seção "Organização de `scripts/`" abaixo), incluindo atualização de todas as referências afetadas
2. Criação do diretório `scripts/ai-workflows/` com os 6 scripts candidatos confirmados na análise abaixo
3. Migração e modernização de `scripts/wiki-precheck.js` → `scripts/ai-workflows/wiki-staleness.js` (CJS → ESM, write-file → stdout JSON)
4. Invocação via Bash, output em JSON estruturado, local-first sem dependência de API externa
5. Documentação da interface IA ↔ script em `scripts/ai-workflows/README.md` (convenção de invocação, schema de output, lifecycle de manutenção)

## Out of Scope

- Alteração do conteúdo dos scripts existentes em `scripts/spec-github/` ou CI/CD — a reutilização é por import, não por modificação; os caminhos de `spec-github/` também não mudam (CI depende deles)
- Automação sem supervisão da IA — a IA permanece como orquestradora e responsável pelo resultado
- Processos que exijam interpretação de conteúdo não-estruturado ou tomada de decisão contextual — esses permanecem dinâmicos
- Criação de `.ai/scripts/` como diretório independente — os scripts vivem em `scripts/ai-workflows/` (ponto único de acesso em `scripts/`)

## Impacted Features

N/A (tooling interno — não altera comportamento da aplicação para o usuário final)

## Impacted Business Rules

N/A

## Impacted Architecture

Potencial: [ADR-0013](../../decisions/ADR-0013-fluxos-automaticos-deterministicos.md) — ampliação do conceito de fluxos determinísticos para o contexto dos workflows internos de IA.

## Impacted Frontend / Backend / Database / Security / Tests

- **Frontend:** N/A
- **Backend:** N/A
- **Database:** N/A
- **Security:** N/A
- **Tests:** Todos os scripts em `scripts/ai-workflows/` devem ter testes automatizados seguindo o padrão de `scripts/spec-github/` (vitest, fixtures). Cobertura mínima obrigatória por script: (1) happy path — output JSON válido, exit code 0; (2) ao menos um error path — condição de falha esperada, exit code 1, mensagem em stderr. Scripts que dependem de git log ou filesystem usam fixtures locais (sem chamadas reais). A suite de testes de `scripts/ai-workflows/` deve ser integrada ao CI (W1) para garantir que nenhum script regrida silenciosamente.

## Dependencies

Nenhuma dependência de outra proposta ativa. Dependência técnica interna: `scripts/spec-github/lib/specs.js` e `scripts/spec-github/lib/release-traceability.js` — importáveis via ESM por scripts em `scripts/ai-workflows/` (mesma árvore de `scripts/`).

## Risks

- **Drift de manutenção:** scripts ficam desatualizados se os processos evoluírem sem que os scripts correspondentes sejam atualizados
- **Falsa segurança:** um processo que parece fixo pode ter exceções não mapeadas, causando silêncio ou output inválido quando a IA esperaria um resultado correto
- **Sobreposição:** scripts em `.ai/scripts/` podem duplicar responsabilidades com `scripts/spec-github/` ou skills existentes sem fronteira clara — documentar em README.md

## Alternatives

- **A — Status quo:** manter tudo dinâmico; a IA continua executando todos os processos sem scripts locais
- **B — Criar `scripts/ai-workflows/` (proposta):** ponto único de acesso em `scripts/`; separação por subdiretório (`ai-workflows/` vs `spec-github/` vs `cli/`); importação natural da lib existente — **escolha desta proposta** `[CONFIRMED: decisão do usuário 2026-10-01]`
- **C — Criar `.ai/scripts/` independente:** separação mais rígida entre tooling de IA e scripts operacionais — **descartado** pelo usuário; preferência por ponto único de acesso em `scripts/`
- **D — Skills encapsuladas:** envolver cada script em uma skill Claude Code em vez de expô-lo como arquivo invocável diretamente — descartado; Bash direto é suficiente e mais simples

**Decision:** B — `scripts/ai-workflows/` como ponto único em `scripts/`
**Approved by:** Lucas Martins Menezes
**Approved on:** 2026-10-01

## Open Questions

Resolvidas em sessão de refinamento (2026-10-01):

1. **Critério de elegibilidade:** processo elegível = fluxo previsível e sem necessidade de leitura/interpretação de conteúdo não-estruturado. `[CONFIRMED: decisão do usuário 2026-10-01]`

2. **Escopo da varredura:** todos os workflows do projeto — incluindo CI/CD e scripts operacionais existentes — não apenas os workflows de IA. `[CONFIRMED: decisão do usuário 2026-10-01]`

3. **Interface de invocação:** Bash direto (ferramenta já disponível e com permissão no Claude Code). Sem infraestrutura adicional. `[CONFIRMED: decisão do usuário 2026-10-01]`

4. **Formato de output:** JSON estruturado (machine-readable). `[CONFIRMED: decisão do usuário 2026-10-01]`

Abertas — resolvidas durante a varredura (2026-10-01):

5. **Localização e compartilhamento de código:** os scripts vivem em `scripts/ai-workflows/` (ponto único de acesso em `scripts/`); por estarem na mesma árvore de `scripts/`, importam naturalmente de `scripts/spec-github/lib/` via ESM sem acoplamento extra. `[CONFIRMED: decisão do usuário 2026-10-01]`

6. **Dados do GitHub nos scripts:** local-first — scripts usam apenas arquivos locais e git log; sem chamadas à API do GitHub; campos não deriváveis localmente ficam `null` no JSON de output. Todos os 6 candidatos são viáveis neste modelo: PR numbers vêm de commits de merge no git log; Issue numbers vêm do frontmatter das specs. `[CONFIRMED: recomendação aceita 2026-10-01]`

## Acceptance Criteria

- AC1: Reorganização de `scripts/` concluída conforme estrutura definida na seção "Organização de `scripts/`"; todas as referências afetadas atualizadas; CI verde
- AC2: Diretório `scripts/ai-workflows/` criado; `README.md` documenta convenção de invocação Bash, schema JSON de output, regras de lifecycle/manutenção e distinção frente aos demais subdiretórios
- AC3: Os 6 scripts candidatos implementados e funcionais, invocáveis via `node scripts/ai-workflows/<script>.js [args]`; `wiki-staleness.js` é a migração modernizada de `wiki-precheck.js`
- AC4: Cada script retorna JSON válido em stdout; erros em stderr; exit code 0 (sucesso) / 1 (falha); comportamento local-first (sem dependência de GITHUB_TOKEN)
- AC5: IA invoca ao menos um script via Bash, lê o JSON de output e age corretamente — demonstrado end-to-end em um workflow real
- AC6: Todos os scripts em `scripts/ai-workflows/` têm testes automatizados seguindo o padrão de `scripts/spec-github/` (vitest, fixtures); cobertura mínima por script: happy path (JSON válido, exit 0) + ao menos um error path (exit 1, stderr); suite integrada ao CI (W1)
- AC7: Nenhuma regressão nos workflows existentes; `npm run cli`, `npm run spec:github:*`, CI/CD e migrations funcionando com os novos paths

---

## Análise Pré-Implementação — Survey de Processos (2026-10-01)

> Esta seção documenta a varredura completa realizada antes da aprovação formal, conforme solicitado. Serve de insumo direto para a fase de implementação — ao ser aprovada, a implementação parte desta análise sem necessidade de nova varredura.

### Escopo varrido

| Área | Artefatos analisados |
|---|---|
| GitHub Actions (CI/CD) | W1 `ci.yml`, W2 `spec-sync.yml`, W3 `issue-responder.yml`, W4 `issue-reconcile.yml`, W6 `release-verify.yml`, W7 `release-gate.yml`, W8 `vercel-dev-alias.yml` |
| Scripts operacionais | `scripts/apply-supabase-migrations.sh`, `scripts/wiki-precheck.js`, `scripts/provisionar-ator-sistema.js`, `scripts/spec-github/` (sync, project-sync, release-gate, release-verify, reconcile, issue-responder, pre-release-check, lib/), `scripts/cli/` |
| Agentes de IA | `github-manager`, `spec-manager`, `project-manager`, `release-manager`, `release-notes`, `test-manager`, `wiki-documenter`, `spec-assistant` |
| Playbooks | `workflow-nova-feature.md`, `workflow-bug.md`, `workflow-spec-implementation.md` |
| npm scripts | `package.json` (build, test, lint, cli, spec:github:*, spec:project:*) |

---

### Tier 1 — Já determinísticos (fora do escopo de `.ai/scripts/`)

Estes processos são **completamente scriptados** e **não consomem tokens de IA**. Não são candidatos.

| Processo | Script | Por que fora do escopo |
|---|---|---|
| CI: lint + testes + build | W1 `ci.yml` → npm scripts | GitHub Actions, sem IA |
| Spec ↔ Issue sync | W2 `spec-sync.yml` → `sync.js` | GitHub Actions, sem IA; exporta `runSync()` para reutilização |
| Resposta estática a Issues externas | W3 `issue-responder.yml` → `issue-responder.js` | GitHub Actions, sem IA |
| Detecção de divergência Issue/Spec | W4 `issue-reconcile.yml` → `reconcile.js` | GitHub Actions, sem IA |
| Verificação de release pós-publicação | W6 `release-verify.yml` → `release-verify.js` | GitHub Actions, sem IA |
| Gate de produção (PR → master) | W7 `release-gate.yml` → `release-gate.js` | GitHub Actions, sem IA |
| Alias Vercel dev | W8 `vercel-dev-alias.yml` | GitHub Actions, sem IA |
| Aplicação de migrations | `apply-supabase-migrations.sh` | Bash script operacional |
| Pre-release check local | `pre-release-check.js` | Já invocado via skill; determinístico |
| Project sync | `project-sync.js` | Já invocado via `spec:project:sync`; determinístico |
| CLI de operações DB | `scripts/cli/` | Operacional, sem contexto de IA workflow |

---

### Tier 2 — Não elegíveis (exigem interpretação da IA)

| Processo | Por que não elegível |
|---|---|
| Workflow de Bug (diagnóstico e correção) | Exige compreensão de comportamento, contexto de erros e julgamento |
| Criação de proposta de spec (spec-assistant) | Exige entender ideia em linguagem natural e conduzir diálogo |
| Escrita de release notes (release-notes agent) | Exige interpretar mudanças e compor narrativa |
| Geração de páginas wiki (Guia-Usuario, Arquitetura, etc.) | Exige composição narrativa a partir de múltiplas fontes |
| Avaliação de documentação pós-mudança (sync specs) | Exige julgamento sobre o que mudou e o que atualizar |
| Implementação de feature/bug (decisões de código) | Exige raciocínio arquitetural e julgamento contextual |

---

### Tier 3 — Candidatos elegíveis (6 scripts confirmados)

#### S-001 — `spec-index-check.js`

**Problema atual:** A cada sessão em que precisa sugerir um próximo ID de spec ou verificar consistência do catálogo, a IA lê manualmente `proposed/index.md` + listagens de diretórios de cada categoria + arquivos de `archive/`. Estimativa: 8–12 leituras de arquivo por invocação; repetido em praticamente todas as sessões de spec work.

**O que o script faz:** Lê todos os arquivos `.md` em `proposed/<categoria>/` e `archive/*/categoria>/`, parseia ID e status de cada um, verifica consistência com `proposed/index.md` (linhas sem arquivo correspondente, arquivos sem linha no index), computa o próximo ID disponível por categoria.

**Pode reutilizar:** `scripts/spec-github/lib/specs.js` → `listSpecs()`, `parseSpec()` (ver OQ-5)

**Invocação:** `node scripts/ai-workflows/spec-index-check.js`

**Schema de output JSON:**
```json
{
  "nextIds": {
    "FEAT": "FEAT-0016",
    "ENH": "ENH-0014",
    "REF": "REF-0006",
    "DEBT": "DEBT-0009",
    "SEC": "SEC-0002",
    "TEST": "TEST-0006"
  },
  "consistency": {
    "ok": true,
    "missingFromIndex": [],
    "missingFiles": [],
    "pathMismatches": []
  },
  "activeCounts": { "PROPOSED": 11, "ACCEPTED": 0 },
  "generatedAt": "2026-10-01T13:00:00Z"
}
```

**Responsabilidade da IA após o output:** Apresentar próximo ID ao usuário; se `consistency.ok = false`, surfacear as discrepâncias; nunca decidir como resolver.

**Complexidade estimada:** Baixa — lógica de listagem e parsing já existe em `specs.js`.

---

#### S-002 — `release-context.js`

**Problema atual:** A cada release, o release-manager lê `package.json`, executa `git log`, lê múltiplos arquivos de spec para identificar o que está na release, constrói mentalmente o contexto para escrever as notas e a tabela §23. São ~10–20 operações sequenciais de leitura + git, todas determinísticas.

**O que o script faz:** Compila todo o contexto estruturado necessário para preparar uma release — versão atual, última tag, commits desde a última tag, IDs de spec referenciados nos commits, detalhes das specs correspondentes, proposta de bump SEMVER (FEAT → minor, qualquer outro → patch), e dados brutos para montar a tabela §23.

**Pode reutilizar:** `scripts/spec-github/lib/specs.js`, `scripts/spec-github/lib/release-traceability.js` (ver OQ-5)

**Invocação:** `node scripts/ai-workflows/release-context.js [--since=v1.16.0]`

**Schema de output JSON:**
```json
{
  "currentVersion": "1.16.0",
  "lastTag": "v1.16.0",
  "commitsSinceLastTag": [
    { "sha": "fa6f656", "message": "docs(FEAT-0002): ...", "specIds": ["FEAT-0002"] }
  ],
  "specsInRelease": [
    { "id": "ENH-0013", "type": "ENH", "title": "...", "issue": null, "status": "IMPLEMENTED" }
  ],
  "proposedBump": "minor",
  "proposedVersion": "v1.17.0",
  "traceabilityRows": [
    { "spec": "ENH-0013", "issue": null, "pr": null, "title": "...", "type": "ENH" }
  ],
  "missingIssues": ["ENH-0013"],
  "generatedAt": "2026-10-01T13:00:00Z"
}
```

**Responsabilidade da IA após o output:** Escrever a narrativa das notas de release, confirmar/ajustar versão proposta com o usuário, montar o corpo do PR de release.

**Nota:** Campos `issue` e `pr` em `traceabilityRows` dependem de dados locais (frontmatter da spec) + git log; a chamada à API para verificar estado do PR/Issue é coberta pela OQ-6.

**Complexidade estimada:** Média — envolve git log parsing + spec parsing + lógica de SEMVER.

---

#### S-003 — `wiki-staleness.js`

**Problema atual:** O agente wiki-documenter, ao ser invocado, lê `wiki/.wiki-state.json` e computa hashes de cada arquivo-fonte para determinar quais páginas precisam de regeneração. Esse cálculo é puramente mecânico (lista de arquivos → hash SHA-256 → comparação) mas é executado pela IA, consumindo tokens no processo de reasoning sobre quais arquivos ler e quais comparar.

**O que o script faz:** Lê `wiki/.wiki-state.json` (ou retorna estado vazio se não existir), computa o hash atual dos arquivos-fonte para cada página conhecida pelo wiki-documenter, compara com os hashes armazenados, retorna lista de páginas obsoletas com as fontes que mudaram.

**Pode reutilizar:** Lógica de mapeamento página → fontes (replicar o mapeamento definido no wiki-documenter agent)

**Invocação:** `node scripts/ai-workflows/wiki-staleness.js`

**Schema de output JSON:**
```json
{
  "staleExists": true,
  "stale": [
    {
      "page": "Funcionalidades.md",
      "currentHash": "abc123",
      "storedHash": "def456",
      "changedSources": ["current/features/FEAT-0003-registro-ingestao.md"]
    }
  ],
  "fresh": ["Home.md", "Guia-Usuario.md"],
  "new": [],
  "generatedAt": "2026-10-01T13:00:00Z"
}
```

**Responsabilidade da IA após o output:** Regenerar apenas as páginas com `stale`; páginas em `fresh` são ignoradas.

**Complexidade estimada:** Baixa-média — hash de arquivos em Node.js é trivial; o mapeamento página → fontes precisa ser extraído do wiki-documenter.

---

#### S-004 — `spec-impl-readiness.js`

**Problema atual:** Antes de iniciar implementação de qualquer spec, a IA lê o arquivo da spec para verificar Status, Decision, Open Questions pendentes, Issue number e dependências. São verificações estruturais (campo a campo) que não exigem interpretação — mas a IA lê o arquivo inteiro e faz o raciocínio sequencial a cada vez.

**O que o script faz:** Dado um ID de spec, localiza o arquivo, extrai os campos de prontidão (Status, Decision, presença de "TBD" nas Open Questions resolvidas, Issue number, Dependencies), verifica via git se o branch `spec/<id>` existe local e remotamente, e retorna um relatório de prontidão com lista de bloqueadores.

**Invocação:** `node scripts/ai-workflows/spec-impl-readiness.js --spec ENH-0013`

**Schema de output JSON:**
```json
{
  "specId": "ENH-0013",
  "filePath": ".ai/specs/proposed/enhancements/ENH-0013-...",
  "found": true,
  "status": "PROPOSED",
  "decision": "TBD",
  "openQuestionsHavePendingTBD": false,
  "issueNumber": null,
  "dependencies": [],
  "localBranchExists": false,
  "remoteBranchExists": false,
  "blockers": [
    "Decision não definido (requer ACCEPTED para implementar)",
    "Issue number ausente no frontmatter"
  ],
  "canProceed": false,
  "generatedAt": "2026-10-01T13:00:00Z"
}
```

**Responsabilidade da IA após o output:** Comunicar ao usuário o estado de prontidão; se `canProceed = true`, iniciar implementação; se não, surfacear `blockers` sem resolver por conta própria.

**Complexidade estimada:** Baixa — leitura e parsing de um único arquivo + dois comandos git.

---

#### S-005 — `spec-housekeeping-status.js`

**Problema atual:** Após o merge de uma spec em `master`, a IA segue o checklist do CLAUDE.md §13 verificando cada passo de housekeeping item por item: arquivo arquivado?, index.md atualizado?, `Implemented Through` preenchido?, Issue number conhecido?. São verificações estruturais repetidas a cada release/merge.

**O que o script faz:** Dado um ID de spec, verifica mecanicamente cada etapa do housekeeping pós-merge: se o arquivo está em `proposed/` ou já em `archive/implemented/`, se a linha correspondente em `index.md` indica `IMPLEMENTED`, se o campo `Implemented Through:` está preenchido, se o `Issue:` tem número. Retorna lista de passos pendentes.

**Invocação:** `node scripts/ai-workflows/spec-housekeeping-status.js --spec ENH-0013`

**Schema de output JSON:**
```json
{
  "specId": "ENH-0013",
  "steps": {
    "specInProposed": true,
    "specArchivedToImplemented": false,
    "indexLineExists": true,
    "indexLineShowsImplemented": false,
    "implementedThroughFilled": false,
    "issueNumberKnown": false
  },
  "remaining": [
    "Mover spec para archive/implemented/enhancements/",
    "Atualizar linha em proposed/index.md para IMPLEMENTED",
    "Preencher campo Implemented Through na spec",
    "Issue number ausente — verificar se Issue foi criada"
  ],
  "allDone": false,
  "generatedAt": "2026-10-01T13:00:00Z"
}
```

**Responsabilidade da IA após o output:** Executar os passos listados em `remaining` na ordem correta (arquivar, atualizar index, fechar Issue via github-manager se aplicável, atualizar Project).

**Complexidade estimada:** Baixa — verificações de existência de arquivo, leitura de campos em dois arquivos (spec + index.md).

---

#### S-006 — `test-summary.js`

**Problema atual:** O agente test-manager executa `npm run test:run` e lê o output textual do vitest para extrair counts, falhas e skips. O output do vitest é formatado para leitura humana (com cores ANSI, símbolos, timestamps); a IA precisa parsear texto não-estruturado para extrair dados estruturados.

**O que o script faz:** Executa vitest com o reporter JSON (`--reporter=json`), parseia o output estruturado e retorna um resumo compacto. Inclui contagens, nomes dos testes que falharam e testes pulados com razão inferida.

**Invocação:** `node scripts/ai-workflows/test-summary.js [--coverage]`

**Schema de output JSON:**
```json
{
  "summary": {
    "total": 197,
    "passed": 197,
    "failed": 0,
    "skipped": 3
  },
  "failed": [],
  "skipped": [
    { "name": "security > RLS policies > ...", "reason": "SUPABASE_SERVICE_ROLE_KEY ausente" }
  ],
  "duration": 12.4,
  "passed": true,
  "generatedAt": "2026-10-01T13:00:00Z"
}
```

**Responsabilidade da IA após o output:** Relatar resultado ao usuário; se `passed = false`, investigar `failed` e decidir ação; se `skipped` contém testes de segurança, registrar como comportamento esperado (skip condicional — testing-strategy.md).

**Complexidade estimada:** Baixa — vitest já possui `--reporter=json`; o script é wrapper fino.

---

### Processos descartados durante a varredura (elegíveis em teoria, não priorizados)

| Processo | Razão da não priorização |
|---|---|
| Wrapper JSON para `sync.js --dry-run` | `sync.js` já exporta `runSync()` com relatório estruturado; a IA pode chamar `npm run spec:github:sync:dry` e receber output legível; não gera valor suficiente para justificar novo script |
| Spec-sync phase do wiki-documenter (transformação de links) | Elevada complexidade de manutenção do mapeamento de links; benefício moderado; pode ser considerado em versão futura como S-007 |
| Branch status geral | Coberto por S-004 no contexto de implementação; generalizar para outros branches aumentaria complexidade sem caso de uso claro |

---

## Organização de `scripts/` (2026-10-01)

> Análise e plano de reorganização do diretório `scripts/` em subdiretórios por domínio, elaborada em conjunto com a varredura de ENH-0013. Faz parte do escopo de implementação desta spec.

### Estrutura atual (problemas)

```
scripts/
  apply-supabase-migrations.sh   ← raiz — sem agrupamento
  provisionar-ator-sistema.js    ← raiz — sem agrupamento
  wiki-precheck.js               ← raiz — sem agrupamento; já é o S-003 conceptualmente
  url-encode.js                  ← raiz — utilitário avulso
  cli/                           ← DB CLI, logicamente pertence ao domínio de banco
  spec-github/                   ← automação GitHub (bem organizado, não muda)
```

### Estrutura proposta

```
scripts/
  spec-github/                        ← inalterado (CI/CD depende dos paths)
  ai-workflows/                       ← NOVO — scripts de suporte aos workflows de IA
    spec-index-check.js
    release-context.js
    wiki-staleness.js                 ← migrado+modernizado de wiki-precheck.js
    spec-impl-readiness.js
    spec-housekeeping-status.js
    test-summary.js
    README.md
  db/                                 ← NOVO — tudo relacionado a banco de dados
    cli/                              ← movido de scripts/cli/
      commands/
        diag.js
        list.js
        login-oauth.js
        run-sql.js
        seed-referencia.js
      db.js
      env.js
      index.js
      parseArgs.js
      utils.js
    apply-supabase-migrations.sh      ← movido da raiz
    provisionar-ator-sistema.js       ← movido da raiz
  utils/                              ← NOVO — utilitários avulsos
    url-encode.js                     ← movido da raiz
```

### Decisões de design

- **`spec-github/` inalterado:** CI/CD (W2, W4, W6, W7, W8) referencia paths diretamente nos YAMLs; renomear quebraria todos os workflows.
- **`cli/` → `db/cli/`:** a pasta é exclusivamente operações de banco via Supabase — semanticamente pertence a `db/`. Import interno de `provisionar-ator-sistema.js` (`./cli/env.js`) continua válido após a mudança porque os dois arquivos ficam dentro de `db/` juntos.
- **`wiki-precheck.js` → `ai-workflows/wiki-staleness.js`:** o script já faz o que S-003 propunha (hash de fontes para detectar páginas obsoletas). A implementação de S-003 é a migração e modernização deste arquivo (CJS → ESM; write-file → stdout JSON), não a criação de um novo.
- **`utils/`:** reservado para utilitários one-off sem domínio definido. Atualmente contém apenas `url-encode.js`.

### Referências a atualizar na implementação

Arquivos que referenciam paths que mudam. Wiki (`wiki/`) é regenerada pelo wiki-documenter ao atualizar as specs — não listada como atualização manual.

| Path que muda | Arquivos a atualizar manualmente |
|---|---|
| `scripts/cli/` → `scripts/db/cli/` | `package.json` (npm script `cli`), `scripts/db/cli/index.js` (help string interna), `CLAUDE.md` (referência à CLI), `.ai/specs/current/backend/cli.md`, `.ai/specs/current/backend/overview.md`, `.ai/specs/current/architecture/overview.md`, `.ai/specs/current/security/secrets-and-environments.md`, `.ai/specs/current/database/referencias.md` |
| `scripts/apply-supabase-migrations.sh` → `scripts/db/` | `package.json` (npm script `supabase:migrations:apply`), `CLAUDE.md`, `README.md` (2 ocorrências), `.ai/specs/current/backend/cli.md`, `.ai/specs/current/backend/overview.md`, `.ai/specs/current/architecture/overview.md`, `.ai/specs/current/security/secrets-and-environments.md`, `.ai/specs/current/database/overview.md`, `.ai/specs/decisions/ADR-0009-*.md` |
| `scripts/provisionar-ator-sistema.js` → `scripts/db/` | `.ai/specs/current/backend/api-referencias-sync.md`, `.ai/specs/current/features/FEAT-0017-*.md`, `.ai/specs/current/database/rpc.md` (comentários); import interno inalterado |
| `scripts/wiki-precheck.js` → `scripts/ai-workflows/wiki-staleness.js` | `wiki/Agente-Wiki.md` (1 referência) |
| `scripts/url-encode.js` → `scripts/utils/` | Nenhuma referência externa |

### Nota sobre `provisionar-ator-sistema.js` — import interno

O script importa `./cli/env.js`. Após a reorganização, tanto ele quanto `cli/` estão dentro de `db/`, então o path relativo `./cli/env.js` permanece correto sem nenhuma alteração.

---

## References

- Draft original arquivado: `.ai/specs/proposed/draft/archive/007-local-scripts-possibility.md`
- [ENH-0005](../../archive/implemented/enhancements/ENH-0005-revisao-tooling-ia.md) — Revisão e melhoria do tooling de IA
- [ENH-0007](../../archive/implemented/enhancements/ENH-0007-compatibilidade-multi-ferramenta-ai-tooling.md) — Compatibilidade multi-ferramenta do AI Tooling
- [ADR-0013](../../decisions/ADR-0013-fluxos-automaticos-deterministicos.md) — Fluxos automáticos determinísticos sem IA
- `scripts/spec-github/lib/specs.js` — `listSpecs()`, `parseSpec()` (reutilizáveis por S-001, S-002)
- `scripts/spec-github/lib/release-traceability.js` — `buildTraceabilityTable()` (reutilizável por S-002)
