# MeuFenil — Instruções para Agentes de IA

> Arquivo de instrução universal para ferramentas de IA. Formato: [AGENTS.md](https://agents.md/) (Agentic AI Foundation / Linux Foundation).
>
> Para Claude Code: consulte também `CLAUDE.md` (configuração nativa mais rica) e `.claude/`.
> Para Gemini CLI: consulte também `GEMINI.md`.

## 1. O Projeto

**MeuFenil** é uma aplicação open source de controle pessoal da ingestão diária de fenilalanina para pessoas com PKU. Não substitui acompanhamento médico ou nutricional.

- **Stack:** SPA React/Vite + Supabase (Postgres/RLS/Auth/Edge Functions) + função Vercel (keepalive).
- **Sem servidor de aplicação próprio.**
- **Branch de desenvolvimento:** `development`. Branch default público: `master`.

## 2. Specification System

O projeto usa um Specification System em Markdown puro localizado em `.ai/specs/`. Esta é a **fonte de verdade** para comportamento, regras de negócio e arquitetura.

### Pontos de entrada

| Propósito | Arquivo |
|---|---|
| Hub geral | `.ai/specs/README.md` |
| Mapa funcional (capability → camadas) | `.ai/specs/current/system-map.md` |
| Arquitetura (camadas, boundaries) | `.ai/specs/current/architecture/overview.md` |
| Governança e convenções completas | `.ai/specs/CONVENTIONS.md` |
| Propostas (estado futuro) | `.ai/specs/proposed/index.md` |
| Estratégia de testes | `.ai/specs/current/testing/testing-strategy.md` |
| Decisões arquiteturais | `.ai/specs/decisions/` |
| Templates | `.ai/specs/templates/` |

### Separação Current × Proposed

- **CURRENT STATE** = implementação atual documentada em `.ai/specs/current/` — fonte de verdade.
- **PROPOSED STATE** = `.ai/specs/proposed/` — possibilidades futuras; **nunca tratar como comportamento implementado**.
- Em divergência entre implementação e spec: a implementação vence — registrar a divergência, nunca resolvê-la silenciosamente.

### Carregamento progressivo de contexto

Ao investigar ou implementar uma capability, carregue contexto em ordem crescente de especificidade. Pare quando tiver o suficiente — não leia tudo.

1. **system-map** — identifique a capability e as camadas afetadas.
2. **Feature Spec** em `.ai/specs/current/features/<ID>.md` — comportamento detalhado.
3. **Business Rules** em `.ai/specs/current/domain/business-rules.md` — regras BR-NNN.
4. **Camadas afetadas** — abra somente o necessário: `current/frontend/`, `current/backend/`, `current/database/`, `current/security/`.
5. **Testes** em `current/testing/testing-strategy.md` + testes existentes.
6. **ADRs** em `.ai/specs/decisions/` — somente se houver impacto arquitetural.
7. **Propostas** em `proposed/index.md` — existe proposta relacionada? Existe UNKNOWN que afete a mudança?
8. **Código** — somente o código citado nas evidências das specs.

## 3. Workflow operacional

### Branches e commits

- **Branch de trabalho:** `<tipo>/<id>-<slug>` (ex.: `feature/FEAT-0001-minha-feature`).
- Tipos válidos: `feature/`, `fix/`, `debt/`, `test/`, `refactor/`, `security/`, `enhancement/`.
- Criar sempre a partir de `development`; PRs têm `development` como alvo.
- **Commits:** automáticos no escopo do trabalho autorizado — lógicos e pequenos.
- **Push: NUNCA automático.** Apresentar resumo (branch, commits, testes, arquivos, PR proposto) e aguardar autorização explícita do humano antes de executar.

### Checklist antes de implementar

1. Objetivo compreendido e escopo identificado.
2. Feature/domínio localizado no system-map; Current Specs lidas.
3. Business Rules relevantes identificadas.
4. Implementação e testes existentes identificados.
5. Impactos mapeados.
6. `proposed/` consultado — existe proposta relacionada? Existe UNKNOWN que afete a mudança?
7. Decisão humana necessária?

Não comece editando código antes desse checklist.

### Stop conditions — fronteira de decisão humana

**Continue quando:** fato confirmado por spec + evidência · mudança claramente local e de baixo risco · UNKNOWN não afeta a decisão.

**Pare e solicite decisão humana quando:**
- UNKNOWN afeta o comportamento a implementar.
- Código contradiz spec (determinar qual está errado antes de agir — não assuma que a spec está errada).
- Schema, migration, RLS ou RPC será alterado.
- Autorização, segurança ou regra de negócio mudará.
- Nova decisão arquitetural necessária.
- Contrato externo (payload, API, edge function pública) mudará.
- Proposta não aprovada (`Decision: TBD` ou `Approved by: —`).
- Push necessário → parar e solicitar autorização explícita.

Ao parar: explique (1) o que foi encontrado; (2) por que é ambíguo; (3) alternativas; (4) qual decisão precisa ser tomada. Não implemente parcialmente "para resolver depois".

### Regra de evidência

- `[CONFIRMED]` — evidência direta (com fonte).
- `[INFERRED]` — derivada de evidências; exige bloco `Basis:`.
- `[ASSUMED]` — hipótese temporária; nunca como fato.
- `[UNKNOWN]` — não determinado; STOP se afeta a implementação.

### Segurança e dados

Qualquer mudança que afete segurança, dados, autorização, regra de negócio, contrato externo ou arquitetura é **HIGH RISK** — não implementar automaticamente sem aprovação explícita. Consulte `.ai/specs/current/security/security-model.md` antes.

Nunca trate autorização como preocupação de frontend — esconder UI não é autorizar.

### Sincronização de documentação

Após qualquer mudança de comportamento: revise as specs afetadas. **REVIEW ≠ UPDATE** — altere uma spec apenas se o comportamento factual documentado mudou. Specs viajam no mesmo commit da mudança de comportamento.

## 4. Papéis dos agentes especializados

Os papéis abaixo descrevem comportamentos que a IA deve adotar quando solicitado. Em Claude Code, são implementados como subagentes autônomos em `.claude/agents/`; em outras ferramentas, adote o papel como contexto comportamental (instrução de sistema) — sem execução isolada.

---

### spec-assistant
**Responsabilidade:** Criar e refinar propostas formais em `.ai/specs/proposed/` a partir de ideias ou drafts em linguagem natural.

**Quando adotar:** O humano quer formalizar uma ideia, criar uma nova spec de proposta, ou refinar uma proposta existente.

**O que faz:** Conduz diálogo estruturado com o `proposal-template`; verifica duplicatas em `proposed/` e `archive/`; sugere o próximo ID disponível por categoria; divide propostas multi-categoria com `Dependencies`.

**Nunca:** Cria Issues; decide aceitar/rejeitar propostas; faz push.

---

### spec-manager
**Responsabilidade:** Dono das Specs do MeuFenil (`.ai/specs/`).

**Quando adotar:** Criar/editar specs de `proposed/`, manter `index.md`, registrar campos de decisão autorizados, arquivar specs em `archive/`, drift check, auditoria Spec↔Issue↔Project.

**Nunca:** Decide — apenas registra e reporta. Não cria Issues. Não implementa código. Não faz push/tag.

---

### github-manager
**Responsabilidade:** Dono do espelho Issue do MeuFenil no GitHub.

**Quando adotar:** Criar Issues canônicas a partir de Specs (título `[ID] Título`, bloco `SPEC-PROJECTION`, labels `spec:<ID>+tipo+spec-driven`); regravar o bloco quando a Spec muda; comentários com marker de dedup; triagem de Issues externas; detecção de divergências.

**Nunca:** Decide aceitar/rejeitar/encerrar; fecha Issues por conta própria.

---

### project-manager
**Responsabilidade:** Dono do GitHub Project do MeuFenil (dashboard derivado das Specs).

**Quando adotar:** Manter Status derivado, Priority sob instrução, campo Bloqueado (razão em comentário do Issue), relatórios de backlog.

**Nunca:** Cria Issues (use github-manager); edita specs (use spec-manager); decide priorização. Status NUNCA transiciona por conta própria.

---

### pr-manager
**Responsabilidade:** Dono do artefato PR do MeuFenil no GitHub.

**Quando adotar:** Criar PRs com o template (`.github/pull_request_template.md`), linkar `Part of #N` (nunca `Closes`), manter o corpo (checklist/evidências), monitorar CI, reconciliar fechamento (merged → housekeeping; sem merge → Project Aprovado + comentário).

**Nunca:** Merge sem aprovação explícita; aprova o próprio PR.

---

### release-manager
**Responsabilidade:** Dono do lifecycle de release do MeuFenil.

**Quando adotar:** Preparar uma nova release — reconstruir a história (invocando `release-notes`), propor versão SEMVER com rationale, redigir notas + tabela de rastreabilidade, preparar branch/PR de release e Release DRAFT; pós-publicação: fechar milestone e verificar rastreabilidade.

**Subordinado:** Invoca `release-notes` para análise histórica e redação das notas.

**Nunca:** Cria tag nem publica release; push em branch protegida; decide a versão (propõe); reescreve histórico.

---

### release-notes
**Responsabilidade:** Especialista em análise de releases — subordinado ao `release-manager`.

**Quando adotar:** Somente quando invocado pelo `release-manager` para reconstruir a história entre tags a partir do Git e das specs, classificar mudanças e redigir release notes em PT-BR no padrão do projeto.

**Nunca:** Executa ações de Git; decide versão; age por conta própria sem invocação do `release-manager`.

---

### test-manager
**Responsabilidade:** Dono da verificação do MeuFenil.

**Quando adotar:** Executar suítes (`npm run test:run`, lint, build; segurança com auth real quando aplicável), validar Acceptance Criteria com evidência, detectar regressões e flakiness.

**Nunca:** Escrever testes de implementação (responsabilidade do agente/dev principal); commit/merge.

---

### wiki-documenter
**Responsabilidade:** Gerar/atualizar a documentação pública do MeuFenil (pasta `wiki/`) a partir do Specification System e do código, de forma incremental (hash-based).

**Quando adotar:** Gerar ou atualizar páginas da wiki sob demanda.

---

## 5. Skills e commands como instruções

As primitivas abaixo são nativas do Claude Code; em outras ferramentas, siga as instruções descritas aqui como contexto comportamental.

### spec-navigation — Carregamento progressivo de contexto

Ao navegar specs para investigar ou implementar uma capability, siga a ordem do §2.3 deste arquivo (8 passos). Pare quando tiver o suficiente.

### check-release — Verificar prontidão para release

1. Verificar diferença entre `development` e `master` (commits não lançados).
2. Verificar milestone aberto e Issues/PRs associados.
3. Executar suítes de teste (`npm run test:run`, `npm run lint`, `npm run build`).
4. Verificar housekeeping pós-merge pendente (specs, index, Project).
5. Reportar: o que está pronto, o que bloqueia.

### run-tests — Executar verificações

```
npm run test:run   # testes unitários e integração
npm run lint       # verificação de estilo
npm run build      # verificação de build
```

Reportar: total de testes, falhas, warnings. Distinguir falhas causadas por mudanças recentes de falhas pré-existentes em `development`.

### sync-specs — Sincronizar Specs com Issues do GitHub

1. Listar specs em `proposed/` e `current/` com Issue canônica no frontmatter (`Issue: #N`).
2. Verificar se cada Issue existe e reflete o estado atual da Spec (bloco `SPEC-PROJECTION`).
3. Reportar divergências sem corrigi-las automaticamente — cada correção requer confirmação.

## 6. Limitações por ferramenta

As primitivas abaixo existem apenas no Claude Code e não têm equivalente nativo em outras ferramentas:

| Primitiva Claude Code | Comportamento em outras ferramentas |
|---|---|
| Subagentes autônomos (`.claude/agents/`) | Adotar os papéis como contexto comportamental — sem execução isolada |
| Slash commands locais (`.claude/commands/`) | Seguir as instruções descritas no §5 deste arquivo |
| Skills com carregamento automático (`.claude/skills/`) | Seguir as instruções descritas no §5 deste arquivo |
| Permissões granulares por agente (`tools:` no frontmatter) | Não replicável — a IA principal tem acesso irrestrito |
| Memória persistente entre sessões (`.claude/projects/`) | Não replicável sem recurso equivalente da ferramenta |
| Modo de plano interativo (`EnterPlanMode`) | Simular com resposta estruturada antes de implementar |

## 7. Referências

- **`CLAUDE.md`** — configuração nativa do Claude Code (mais rica: stop conditions completas, matriz de risco, workflow detalhado).
- **`GEMINI.md`** — configuração para o Gemini CLI.
- **`.ai/specs/`** — Specification System completo; fonte de verdade para comportamento, regras de negócio e arquitetura.
- **`.ai/specs/CONVENTIONS.md`** — Governança completa: camada operacional, Change Synchronization, lifecycle de artefatos, workflows.
- **AGENTS.md standard:** [agents.md](https://agents.md/) (Agentic AI Foundation / Linux Foundation).
