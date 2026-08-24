# CLAUDE.md — MeuFenil

> Manual operacional para agentes de IA neste projeto. Este arquivo ensina COMO trabalhar; os detalhes do sistema vivem no Specification System ([`.ai/specs/`](.ai/specs/)) e NÃO são duplicados aqui.

## 1. O que é o MeuFenil

Aplicação open source de controle pessoal da ingestão diária de fenilalanina para pessoas com PKU. **Não substitui acompanhamento médico ou nutricional.** SPA React/Vite + Supabase (Postgres/RLS/Auth/Edge Functions) + função Vercel (keepalive). Sem servidor de aplicação próprio.

## 2. Fonte da verdade e separação Current × Proposed

- **CURRENT STATE** = implementação atual (código, banco, migrations, testes, configuração) + as specs em [`.ai/specs/current/`](.ai/specs/current/) que a documentam. Em divergência factual, a implementação vence — e a divergência é registrada, nunca resolvida silenciosamente.
- **PROPOSED STATE** = [`.ai/specs/proposed/`](.ai/specs/proposed/) — possibilidades futuras. NUNCA tratar proposta como comportamento implementado. NÃO alterar Current Specs para refletir uma proposta antes de ela ser realmente implementada.
- **Governança** = [`.ai/specs/CONVENTIONS.md`](.ai/specs/CONVENTIONS.md). Quando houver conflito entre este arquivo e as specs, siga a governança e investigue a inconsistência — não altere silenciosamente nenhuma fonte.
- **Camada operacional (ADR-0012):** Spec = fonte de verdade da especificação; GitHub Issue = representação operacional/pública da Spec; Project = dashboard do backlog; PR = unidade de revisão/integração; Release = unidade de entrega. Regras completas em CONVENTIONS.md §18.

## 3. Navegação — carregue somente o necessário

Pontos de entrada:

| Propósito | Arquivo |
|---|---|
| Hub geral | [`.ai/specs/README.md`](.ai/specs/README.md) |
| Mapa funcional (capability → camadas) | [`.ai/specs/current/system-map.md`](.ai/specs/current/system-map.md) |
| Arquitetura (camadas, boundaries) | [`.ai/specs/current/architecture/overview.md`](.ai/specs/current/architecture/overview.md) |
| Governança e regras | [`.ai/specs/CONVENTIONS.md`](.ai/specs/CONVENTIONS.md) |
| Propostas | [`.ai/specs/proposed/index.md`](.ai/specs/proposed/index.md) |
| Testes | [`.ai/specs/current/testing/testing-strategy.md`](.ai/specs/current/testing/testing-strategy.md) |
| ADRs | [`.ai/specs/decisions/`](.ai/specs/decisions/) |
| Templates | [`.ai/specs/templates/`](.ai/specs/templates/) |

**PROGRESSIVE CONTEXT LOADING** — não leia tudo: (1) entenda a solicitação → (2) identifique a capability no system-map → (3) abra a Feature Spec → (4) Business Rules relacionadas → (5) camadas afetadas (frontend/backend/database/security) → (6) testing → (7) architecture/ADRs apenas com impacto arquitetural → (8) só então o código citado nas evidências.

## 4. Antes de implementar (checklist obrigatório para tarefas não triviais)

1. Objetivo compreendido e escopo identificado.
2. Feature/domínio localizado no system-map; Current Specs lidas.
3. Business Rules relevantes identificadas (BR-NNN em [`domain/business-rules.md`](.ai/specs/current/domain/business-rules.md) e rastreabilidade em [`domain/traceability.md`](.ai/specs/current/domain/traceability.md)).
4. Implementação e testes existentes identificados.
5. Impactos mapeados (matriz de Change Synchronization em [`CONVENTIONS.md`](.ai/specs/CONVENTIONS.md) seção 11).
6. `proposed/` consultado — existe proposta relacionada? Existe UNKNOWN que afete a mudança?
7. Decisão humana necessária? (seção 8 abaixo)

Não comece editando código.

## 5. Workflows

**Princípio (ADR-0013):** toda interação com IA é acionada MANUALMENTE pelo dev, no modo interativo (sessão local). Fluxos automáticos (GitHub Actions) são DETERMINÍSTICOS, sem IA: proibido `ANTHROPIC_API_KEY`, Claude Code Action ou `repository_dispatch` em automação. Issues externas recebem resposta estática (W3) e produção é protegida por gate (W7) — sem IA em nenhum dos dois.

### Nova feature

```
Pedido → verificar proposta existente → (não há?) criar Proposed Feature [proposal-template] + Issue canônica + item no Project
→ APROVAÇÃO HUMANA (Decision na Spec) → ACCEPTED → Feature Spec → work branch feature/<id>-<slug> → Implementation → Tests
→ Validation → Update Current Specs → Update Proposed status → System Map
→ PR (Part of #N) → aprovação humana → merge → housekeeping (ACs → IMPLEMENTED → archive/ → Issue fechada → Project)
→ validação da documentação
```

Nenhuma feature sem specification. Se a solicitação vier com especificação completa e autorização explícita, prossiga respeitando segurança/arquitetura/dados.

### Bug

```
Reproduzir → CURRENT behavior → EXPECTED behavior → verificar spec → teste de regressão
→ corrigir → testes → validar → avaliar documentação
```

Se o comportamento atual contradiz a spec: **STOP** — determine se o código está errado, a spec está obsoleta ou o requisito mudou; se não for possível determinar, peça decisão humana. Não assuma automaticamente que a spec está errada.

### Implementar uma proposta existente (quando explicitamente solicitado)

1. Abrir a proposta; verificar Status, Decision, Open Questions, Acceptance Criteria e impactos.
2. Se houver Open Question relevante não resolvida ou Decision ausente: **STOP**.
3. Localizar a Issue canônica (`Issue: #N` no frontmatter ou label `spec:<ID>`) e o item do Project.
4. Implementar em work branch `<tipo>/<id>-<slug>` → testar → atualizar Current Specs no mesmo commit.
5. **PUSH: STOP — solicitar autorização explícita** (resumo: branch, commits, testes, PR proposto) antes de qualquer push.
6. Após push: criar PR (`Part of #N`, template `.github/pull_request_template.md`) → aprovação humana → merge.
7. Housekeeping pós-merge: validar ACs → marcar proposta `IMPLEMENTED` com **Implemented Through** → mover para `archive/implemented/<categoria>/` → atualizar `proposed/index.md` → fechar a Issue (cadeia CONVENTIONS §18.6) → atualizar Project → validar documentação.

## 6. Evidência — nunca transforme UNKNOWN em CONFIRMED sem evidência

- `[CONFIRMED]` — evidência direta (sempre com fonte).
- `[INFERRED]` — derivada de evidências; exige bloco `Basis:`.
- `[ASSUMED]` — hipótese temporária; nunca como fato.
- `[UNKNOWN]` — não determinado; registre `Evidence Needed:` quando útil.

UNKNOWN não significa "escolha o que parece melhor". Se afeta a implementação: **STOP** e reporte a lacuna. Se não afeta: continue e registre. (Regras completas: [`CONVENTIONS.md`](.ai/specs/CONVENTIONS.md) seção 3.)

## 7. Segurança, dados e contratos — regra de alto risco

Qualquer alteração que possa afetar **segurança, dados, autorização, regra de negócio, contrato externo ou arquitetura** é HIGH RISK: **não implemente automaticamente**, mesmo que pareça tecnicamente pequena.

- **Database:** antes de qualquer mudança, consulte [`current/database/`](.ai/specs/current/database/) e [`current/security/`](.ai/specs/current/security/). Migrations usam o mecanismo oficial existente ([`scripts/apply-supabase-migrations.sh`](scripts/apply-supabase-migrations.sh)) — não invente outro. Mudança de schema/RLS/RPC = HIGH RISK = parar antes de implementar.
- **Segurança:** nunca trate autorização como preocupação de frontend — esconder UI não é autorizar. Consulte o [`security-model`](.ai/specs/current/security/security-model.md) e verifique authentication, authorization, ownership, RLS, RPC, admin, delegation, service_role e Edge Functions.
- **Contrato externo** (payloads, respostas de edge functions/API, comportamento público): mudança = HIGH RISK.

## 8. Stop conditions e fronteira de decisão humana

**CONTINUE quando:** fato confirmado por spec + evidência · mudança claramente local e de baixo risco · UNKNOWN não afeta a decisão · typo factual inequívoco (corrigir E registrar).

**PARE quando:** UNKNOWN afeta comportamento · código contradiz spec · duas specs se contradizem · schema/migration/RLS/RPC será alterado · autorização ou segurança será alterada · regra de negócio mudará · nova decisão arquitetural (propor ADR, Origin Contemporary) · contrato externo mudará · proposta não aprovada · governança do Specification System será alterada.

Ao parar, NÃO implemente parcialmente "para resolver depois". Explique: (1) o que foi encontrado; (2) por que é ambíguo; (3) alternativas; (4) qual decisão precisa ser tomada.

| Risco | Critério | Regra |
|---|---|---|
| LOW | mudança localizada, sem impacto em comportamento/dados/segurança/contrato | pode implementar seguindo specs |
| MEDIUM | mudança comportamental/estrutural com impacto controlado | pode exigir validação adicional |
| HIGH | schema, migrations, RLS, RPC, autorização, segurança, dados destrutivos, regras de negócio, arquitetura, secrets/environment, contratos externos | decisão humana ANTES da implementação, salvo autorização explícita por spec aprovada |

**Stop conditions operacionais** (além das acima): push necessário → **PARE** e solicite autorização explícita (resumo antes do push) · aprovação de PR / merge → aguarde a aprovação humana (após aprovação explícita, o merge é executado pelo agente) · fechamento de Issue que represente decisão de negócio/governança → aguarde decisão · tag / publicação de release → aguarde confirmação humana · migration/deploy em production → nunca automática · ambiguidade sobre Source of Truth → reporte. **Não pare** para pedir confirmação de ações já autorizadas por este workflow (ex.: commit, atualizar Issue/Project, criar PR, fechar Issue factual — CASO 1 da CONVENTIONS §18.6).

(Matrizes completas: [`CONVENTIONS.md`](.ai/specs/CONVENTIONS.md) seções 13–14.)

## 9. Padrões de implementação

- **Frontend:** siga os padrões documentados em [`current/frontend/`](.ai/specs/current/frontend/) (camadas page→hook→service, DTOs, AppError, skeletons, padrões visuais observados). Não invente novos padrões de layout/loading/error/empty/forms/modals/hooks/services quando já existe padrão estabelecido; se for necessário criar um, avalie se é decisão estrutural.
- **Backend:** siga [`current/backend/`](.ai/specs/current/backend/) e os padrões existentes (Edge Functions, RPCs, error handling, auth, authorization).
- **Testing:** toda mudança de comportamento precisa de testes apropriados — consulte [`testing-strategy.md`](.ai/specs/current/testing/testing-strategy.md) e os testes existentes antes de criar. Priorize comportamento, regras de negócio, segurança, erros, edge cases e regressões — não busque cobertura percentual cegamente; coverage % não é prova de qualidade. Execute os testes relevantes (suite completa quando apropriado). Não altere testes existentes para "passar".
- **Escrever docs:** use os templates de [`.ai/specs/templates/`](.ai/specs/templates/) — não invente estrutura paralela. Se o template não atender: **STOP** e registre a necessidade de evolução do Specification System.

## 10. Documentação sincronizada (obrigatório)

Após qualquer mudança de comportamento: revise as specs afetadas usando a matriz de Change Synchronization ([`CONVENTIONS.md`](.ai/specs/CONVENTIONS.md) seção 11). **REVIEW ≠ UPDATE** — altere uma spec apenas se o comportamento factual documentado mudou. Avalie: Feature · Business Rules · camadas · Security · Testing · Architecture/ADR · System Map. Não atualize tudo indiscriminadamente. Specs viajam no MESMO commit da mudança de comportamento.

## 11. Escopo e proibições

- **Scope control:** mantenha a mudança focada. Não aproveite a tarefa para refatorar arquivos não relacionados, atualizar dependências, reorganizar diretórios, corrigir problemas antigos ou melhorar UI alheia. Descobertas relevantes → registrar como proposta/gap.
- **O agente NÃO deve:** inventar requisitos/regras/decisões · preencher UNKNOWN por conveniência · implementar Proposed não aprovado · alterar segurança/schema sem autorização · criar migrations desnecessárias · duplicar padrões · ignorar testes ou documentação · alterar specs apenas para justificar código · fazer mudanças fora do objetivo · refactors oportunistas · expandir escopo silenciosamente.
- **Descobertas de melhoria:** "seria melhor" NÃO é "deve ser implementado". Se não autorizado: registre como proposta (verifique antes [`proposed/index.md`](.ai/specs/proposed/index.md) para não duplicar) ou solicite aprovação.

## 12. Git e ambiente

- Branch de desenvolvimento oficial: **`development`**. Branch default público: **`master`**. Não troque de branch sem autorização.
- **Branch model:** work branches `<tipo>/<id>-<slug>` (`feature/`, `fix/`, `debt/`, `test/`, `refactor/`, `security/`, `enhancement/`) criadas de `development`; PRs têm `development` como alvo. Release: `development` → `release/vX.Y.Z` → PR → `master` → production. Não altere esse modelo sem decisão explícita.
- **Commits: automáticos** no escopo do trabalho autorizado — commits lógicos e pequenos (implementação, Specs, documentação), sem confirmação individual.
- **Push: NUNCA automático.** Sempre apresente primeiro: resumo, branch, commits, testes, arquivos relevantes e o PR proposto; aguarde autorização explícita ("Sim, pode fazer push") antes de executar. Push direto em `development`/`master` não faz parte do workflow do agente. `git push` nunca entra na allowlist permanente (`.claude/settings.local.json`): a autorização é pontual, via mecanismo de permissão do Claude Code (revisão final D-13).
- **Merge:** apenas após aprovação humana do PR. O agente nunca aprova o próprio PR; após aprovação explícita, executa o merge sem nova confirmação.
- **Tags e releases:** criação de tag e criação/publicação de release são humanas; o agente prepara (notas, changelog, draft, relações Spec→Issue→PR→Release).
- Verifique branch e working tree antes de trabalhar.
- `.ai/.temp/` é a área temporária local (MANIFEST + lifecycle com retenção de 7 dias — CONVENTIONS §17). Não é fonte primária; mudanças permanentes no Specification System vão para `.ai/specs/`.

## 13. Completion checklist (antes de declarar concluído)

- [ ] objetivo original atendido; escopo respeitado
- [ ] Current Specs consultadas; regras de negócio verificadas; segurança avaliada
- [ ] testes existentes consultados; testes relevantes executados/criados
- [ ] documentação sincronizada (REVIEW ≠ UPDATE); System Map avaliado
- [ ] Proposed não confundido com Current; nenhuma decisão não autorizada tomada
- [ ] nenhuma mudança HIGH RISK sem aprovação; nenhuma alteração não relacionada introduzida
- [ ] Issue canônica e Project sincronizados (Status derivado correto; PR com `Part of #N` — nunca `Closes`)
- [ ] housekeeping executado (arquivo `archive/`, `index.md`, encerramento da Issue conforme CONVENTIONS §18.6)

## 14. Fluxo de trabalho ideal

```
USER REQUEST → UNDERSTAND → LOCATE SPEC → LOAD RELEVANT CONTEXT → CHECK RULES
→ CHECK SECURITY → CHECK TESTS → CHECK DECISION BOUNDARY
→ IMPLEMENT OR STOP → TEST → SYNC DOCUMENTATION → VALIDATE → REPORT
```
