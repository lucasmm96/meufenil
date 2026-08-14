# Convenções do Specification System — MeuFenil

**Aprovado em:** 2026-08-13 — Fase 0 v2; consolidado na Fase 12 (governança completa)
**Status:** Vigente
**Alteração:** apenas via protocolo de divergência (seção 12) ou decisão explícita do autor do projeto.

Este documento é a GOVERNANÇA do Specification System — regras de escrita, evidência, nomenclatura, workflows, lifecycle e fronteiras de decisão. Toda spec criada ou alterada deve seguir estas regras. **A IA deve ler este arquivo antes de criar ou alterar qualquer conteúdo em `.ai/specs/`.** Ele é um documento de governança — não uma cópia das specs.

---

## 1. Source of Truth

- A implementação atual (código, banco, migrations, testes, configuração) é a fonte da verdade do Current State. A documentação é uma projeção VERIFICÁVEL dessa realidade — transcrição completa da realidade e somente da realidade.
- Não preencher lacunas com conhecimento genérico; não assumir intencionalidade de decisões apenas porque existem no código.
- Quando documentação e implementação divergem: a implementação vence; a divergência é registrada e tratada (seção 12).
- Documentação existente (README, análises) é evidência secundária — validar contra o estado atual antes de incorporar.

## 2. Current vs Proposed

- `current/` = **realidade atual**; `proposed/` = **possibilidades futuras**. Separação estrutural, absoluta.
- `current/` não contém linguagem prescritiva ("deveria", "poderia ser", "recomenda-se"); não depende de `proposed/`.
- `proposed/` pode referenciar `current/` (campo "Current State"); nunca descreve comportamento atual além do necessário para contextualizar; uma proposta NÃO altera a realidade documentada.
- **Ausência é informação factual:** "Não existe mecanismo X atualmente" = Current State (correto); "O sistema deveria possuir X" = Proposed State (incorreto em `current/`). Não transformar ausência em recomendação automaticamente.

## 3. Evidence Model

| Tag | Significado | Regra de uso |
|---|---|---|
| `[CONFIRMED]` | Evidência direta (código, migration, teste, config versionada, git, UI). | Sempre acompanhada da fonte. |
| `[INFERRED]` | Conclusão derivada de evidências, mas não declarada explicitamente. | Obrigatório bloco **Basis:** com as evidências utilizadas. |
| `[ASSUMED]` | Hipótese temporária. | Nunca apresentada como fato; sempre com o que falta para confirmar. |
| `[UNKNOWN]` | Não determinado. | Sempre com **Evidence Needed:** (o que seria necessário descobrir), quando útil. |

- Fontes: `code` · `database` · `migration` · `test` · `configuration` · `documentation` · `git history` · `runtime behavior` · `UI` · `inference`.
- Nunca apresentar INFERRED/ASSUMED/UNKNOWN sem a tag. Nunca preencher UNKNOWN por inferência. Nunca promover INFERRED a CONFIRMED sem evidência nova.
- Sintaxe inline: `[CONFIRMED: code, src/.../arquivo.ts:linha]`. Toda spec de `current/` termina com seção `## Evidências` (lista E1, E2... com classificação e origem).
- Cabeçalho obrigatório em specs de `current/`: `**Última verificação:** YYYY-MM-DD (commit <sha>)`.

## 4. Naming

- Arquivos: `kebab-case` minúsculo; conteúdo pt-BR; identificadores técnicos (RLS, RPC, DTO, hook) em inglês.
- Diretórios estruturais em inglês: `current`, `proposed`, `decisions`, `templates`, `features`, `enhancements`, `refactors`, `technical-debt`, `security`, `testing`.
- **IDs por categoria** (numeração sequencial POR categoria, 4 dígitos):

| Prefixo | Diretório | Significado |
|---|---|---|
| `FEAT-NNNN` | proposed/features/ · current/features/ | feature |
| `ENH-NNNN` | proposed/enhancements/ | enhancement |
| `REF-NNNN` | proposed/refactors/ | refactor |
| `DEBT-NNNN` | proposed/technical-debt/ | technical debt |
| `SEC-NNNN` | proposed/security/ | segurança |
| `TEST-NNNN` | proposed/testing/ | testes |
| `ADR-NNNN` | decisions/ | decisão arquitetural (numeração global) |
| `BR-NNN` | domain/business-rules.md | regra de negócio (3 dígitos — **regra de compatibilidade**: IDs existentes NÃO são renomeados por estética; novas BRs seguem 3 dígitos; se o contador ultrapassar 999, migrar para 4 dígitos em bloco) |

- Feature specs atuais: `current/features/FEAT-NNNN-<slug>.md`; relatórios de análise: `.ai/.temp/analyses/NN-descricao.md`.
- Caminho de arquivo = contrato: identidade estável; mudança de caminho exige atualizar todos os links.

## 5. Specification Hierarchy & Document Responsibilities

Hierarquia de navegação (verificada na Fase 11):

```
.ai/specs/README.md          → hub (porta de entrada)
current/system-map.md         → índice FUNCIONAL (capability → camadas)
current/architecture/overview.md → índice ARQUITETURAL
current/features/FEAT-NNNN    → comportamento ponta-a-ponta (agrega por LINKS)
current/product/ + domain/    → o que o sistema É (glossário, modelo, BRs, traceability)
current/{frontend,backend,database,security,testing} → detalhe canônico por camada
decisions/ADR-NNNN            → decisões arquiteturais
proposed/ + index.md          → possibilidades futuras
templates/                    → formatos (fonte canônica dos formatos)
```

**Matriz de responsabilidade canônica (um lar por fato — "link, não copie"):**

| Conhecimento | Lar canônico |
|---|---|
| Como uma feature funciona ponta-a-ponta | `current/features/FEAT-NNNN-*.md` |
| Regra de negócio | `current/domain/business-rules.md` (BR-NNN) |
| Rastreabilidade BR × implementação × teste | `current/domain/traceability.md` |
| Significado de um termo | `current/product/glossary.md` |
| Política de uma tabela | `current/database/<tabela>.md` |
| Autorização transversal | `current/security/security-model.md` |
| Comportamento de uma página | `current/frontend/pages/<pagina>.md` |
| Comportamento de um componente | `current/frontend/components/<componente>.md` |
| Padrões de código (hooks/services/DTOs/erros) | `current/frontend/overview.md` (ou `backend/overview.md`) |
| Convenções e fluxos de teste | `current/testing/testing-strategy.md` |
| Decisão arquitetural | `decisions/ADR-NNNN-*.md` |
| Melhoria/tech-debt | `proposed/<categoria>/` |

- Links markdown **relativos**; `current/` nunca linka `proposed/` como fonte; `proposed/` linka `current/`.
- O `README.md` da raiz do projeto permanece visão de usuário; detalhes internos vivem nas specs.

## 6. Feature Workflow

```
Feature → Specification → Review → Implementation Plan → Implementation → Tests → Documentation Update
```

- Nenhuma feature sem specification correspondente.
- Specs de features futuras: `proposed/features/FEAT-NNNN-*` (template feature-spec, Tipo Proposed).
- Após implementação: promoção para `current/features/` (checklist — seção 10, Proposal Promotion).
- Atualização de specs viaja no MESMO commit/PR da mudança de comportamento.

## 7. Bug Workflow

```
Bug → Reproduzir → Teste que demonstra o problema → Correção → Teste passa → Avaliar impacto nas specs → Atualizar spec quando necessário
```

- Não existe template formal de bug (decisão D-06 da Fase 12) — registrar investigações de bugs em `.ai/.temp/analyses/` até que um template seja criado.

## 8. Proposal Lifecycle

```
PROPOSED → ACCEPTED → IMPLEMENTATION → IMPLEMENTED
PROPOSED → REJECTED
PROPOSED → SUPERSEDED
```

- Status inicial: **PROPOSED** (uma proposta pode permanecer PROPOSED indefinidamente — não é aprovada, priorizada ou comprometida por existir).
- Transições exigem decisão humana; nenhuma transição automática.
- Vocabulário de status por contexto:
  - **Propostas:** PROPOSED / ACCEPTED / IMPLEMENTATION / IMPLEMENTED / REJECTED / SUPERSEDED.
  - **ADRs:** Accepted / Proposed / Superseded / Rejected.
  - **Features (current):** Implementada / Em evolução.
  - **Specs de current/:** Current / Superseded (seção 9).

## 9. Specification Lifecycle

- Uma spec de `current/` é atualizada enquanto continuar representando a realidade.
- Quando deixar de representar a realidade: **NÃO apagar imediatamente** — marcar `**Status:** Superseded` e indicar a substituta (link).
- Não usar DEPRECATED sem diferença semântica clara (Superseded cobre o caso).
- Rebaixar/remover um `CONFIRMED` exige evidência nova, nunca esquecimento silencioso.

## 10. Proposal Promotion

- **FEAT:** PROPOSED → ACCEPTED → implementação + testes → spec migrada para `current/features/` (checklist: converter seções de requisito em descrição com evidências · atualizar system-map · atualizar todos os links · atualizar specs de camada afetadas · marcar propostas consumidas · ADR se houver decisão).
- **ENH/REF/DEBT/SEC/TEST:** não criam diretório equivalente em current. Ao concluir: atualizar as Current Specs afetadas · atualizar `proposed/index.md` · marcar a proposta `Status: IMPLEMENTED` com **Implemented Through** (lista de specs que absorveram o resultado) · NÃO apagar a proposta (histórico de evolução).

## 11. Change Synchronization (REVIEW ≠ UPDATE)

| Change Type | REVIEW (verificar consistência) | UPDATE (alterar conteúdo — apenas o que mudou) |
|---|---|---|
| Database (schema/RLS/RPC/trigger) | database/<objeto>, security-model (se autorização), features afetadas, BRs, system-map, traceability, tests | database/<objeto>, rpc.md/triggers.md, BRs/traceability se regra mudou |
| Security (policy/autorização/fluxo) | security-model, database (policies), features afetadas, testing | security-model, database, testing-strategy |
| Backend (edge/API/CLI/jobs) | backend/<componente>, features afetadas, security (secrets) | backend/<componente>, features/security se comportamento mudou |
| Frontend (página/componente/hook/service) | frontend/<objeto>, features afetadas, BRs (se cálculo/UI), testing | frontend/<objeto>, BRs/traceability se comportamento mudou |
| Business Rule | BR, features que citam, implementação, tests | BR + specs afetadas + traceability |
| Feature (novo comportamento) | FEAT, BRs, camadas, system-map, testing | FEAT + system-map + camadas |
| Test infrastructure | testing-strategy | testing-strategy |

- REVIEW = "verificar se a spec continua correta" — não é obrigação de alterar.
- UPDATE = "alterar porque o comportamento mudou" — disparado por mudança de COMPORTAMENTO, não de estilo.
- Mudanças viajam no mesmo commit; `Última verificação` atualizado.

## 12. Protocolo de divergência (docs × código × testes × banco)

1. Identificar a divergência; 2. Apresentar as evidências; 3. Explicar o problema; 4. Propor a alteração da spec; 5. **Aguardar autorização** quando envolver mudança de comportamento, segurança, dados, autorização, regra de negócio, contrato externo ou decisão arquitetural. Nunca alterar spec silenciosamente. Registrar investigações em `.ai/.temp/analyses/`.

## 13. Stop Conditions (quando a IA PARA)

| Situation | Action |
|---|---|
| Fato confirmado por spec + evidência | Continue |
| UNKNOWN irrelevante para a tarefa | Continue (registrar se útil) |
| UNKNOWN afeta comportamento a implementar | **STOP** — reportar lacuna (Evidence Needed) |
| Código contradiz spec | **STOP** — protocolo de divergência |
| Duas specs/regras contraditórias | **STOP** — reportar contradição |
| Mudança de schema / RLS / RPC | **STOP** antes da implementação |
| Mudança de autorização / segurança | **STOP** antes da implementação |
| Nova decisão arquitetural | **STOP** — propor ADR (Origin Contemporary) |
| Mudança de regra de negócio (BR) | **STOP** — solicitar aprovação |
| Proposta sem aprovação | **STOP** — não implementar |
| Mudança da governança do próprio Specification System | **STOP** — solicitar decisão |
| Erro factual trivial (typo/link) com evidência inequívoca | Continue — corrigir E registrar a alteração |

## 14. Human Decision Boundary

| Risco | Critério | Exemplos |
|---|---|---|
| LOW (IA decide) | Sem impacto comportamental/contratual; documental; novos testes sem alterar suíte existente | corrigir typo/link em spec; completar UNKNOWN com evidência nova; adicionar teste |
| MEDIUM (IA propõe, humano aprova) | Mudança comportamental NÃO destrutiva; refactor com testes verdes | novo estado de UI; renomear interno; melhorar mensagem |
| HIGH (humano decide ANTES de qualquer código) | schema, migration, RLS, RPC, autorização, segurança, dados destrutivos, regra de negócio, arquitetura, secrets/environment, contratos externos | policy nova; migration; delete-account; limite diário; novo serviço |

- **Regra adicional (D-02):** qualquer alteração que possa afetar segurança, dados, autorização, regra de negócio ou contrato externo é ALTO RISCO — a IA não implementa automaticamente só porque a alteração parece tecnicamente pequena.
- LOW/MEDIUM/HIGH não justificam mudanças de negócio ou segurança sem aprovação.

## 15. Documentation Drift (processo de detecção)

1. **Por mudança:** revisar a matriz de sincronização (seção 11) em toda mudança de comportamento.
2. **Periódico:** ao iniciar tarefa em área X, comparar a spec X com o código — `Última verificação` antiga é candidata a drift.
3. **Sinais:** referência de código quebrada; teste que contradiz spec; README × spec × código divergentes.
4. **Registro:** divergência documentada em `.ai/.temp/analyses/` antes de qualquer correção.

## 16. Git Rules

- **Versionado:** `.ai/specs/` (README, CONVENTIONS, templates, current, proposed, decisions) e `CLAUDE.md` quando existir.
- **NÃO versionado:** `.ai/.temp/analyses/` (laboratório local — mantido no `.gitignore`; não remover a entrada).
- Specs não citam análises como evidência primária — citam código, migrations, testes e git.

## 17. .ai/.temp/analyses rule

- Área de trabalho NÃO versionada: relatórios numerados `NN-descricao.md`, material de investigação e evidência histórica.
- NÃO são fonte de verdade quando conflitam com o estado atual; toda informação incorporada a uma spec de `current/` deve ser validada contra o sistema atual.
- Não apagar nem renomear relatórios anteriores.

---

## Relação entre templates e specs

- `templates/` é a fonte canônica dos formatos: `table-spec` (T1), `rpc-spec` (T2), `page-spec` (T3), `component-spec`, `feature-spec` (T4), `adr-template` (T5), `proposal-template` (T6), `business-rule`, `analysis-report` (T7).
- Toda spec segue o template aplicável; desvios justificados no próprio arquivo.
- Alterações em `CONVENTIONS.md`, `README.md` e `templates/`: proposta → aprovação → aplicação (nunca silenciosa).
