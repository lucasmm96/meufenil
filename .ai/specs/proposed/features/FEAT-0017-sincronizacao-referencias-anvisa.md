# FEAT-0017 — Sincronização controlada de referências com a fonte ANVISA/Power BI

**Type:** FEAT
**Status:** PROPOSED
**Title:** Sincronização controlada de referências com a fonte ANVISA/Power BI
**Issue:** #50
**Created on:** 2026-09-02

## Problem

O catálogo de referências do MeuFenil (dado crítico; total de 2.986 linhas em prod em 2026-08-13, com as globais oriundas do seed manual de 2.959 INSERTs) foi carregado do relatório Power BI/ANVISA e não existe mecanismo recorrente, confiável e auditável para detectar e aplicar mudanças da origem (inclusões, ausências, alterações substantivas) — a fonte muda sem aviso e o modelo atual não distingue identidade, histórico e estado sincronizado.

## Current State

- **Origem e extração:** os dados vêm de relatório Power BI associado à ANVISA, sem exportação convencional; a extração funcional vive no projeto externo `powerbi-export` (`C:\Users\lucas\Documents\git\powerbi-export` — fora do repo): Node.js com `src/decode.js`, `src/fetch.js`, `src/export.js`, teste `test/decode.test.js`, amostras `input/payload.json`/`output/decoded.json`, **sem `package.json` visível**; a extração foi validada pelo usuário como funcional `[CONFIRMED: powerbi-export — leitura direta 2026-09-02]`. Estrutura observada: `{"Nome do Produto", "Marca do Produto", "NU_MAX_AMINOACIDO"}` (draft §4).
- **Contagem/tamanho/variabilidade da origem = [UNKNOWN]** — `Evidence Needed:` primeira extração real com o volume completo (as amostras locais não permitem estimar contagem, tamanho nem variabilidade entre execuções).
- **Catálogo atual:** `public.referencias` com nome embutindo marca como texto `(Marca: X)` (seed `migrations/dados.sql` com 2.959 INSERTs), sem coluna `marca`; **total de linhas** de `referencias`: prod = 2.986, dev = 3.164 (2026-08-13) `[CONFIRMED: ../current/database/referencias.md E6 + migrations/dados.sql]`. **Contagem exata de globais vigentes = [UNKNOWN]** — `Evidence Needed:` 2.959 é a contagem do seed de 2026-01-01, não a contagem atual em prod (a diferença para o total inclui referências pessoais criadas por usuários desde então). O modelo canônico (colunas separadas + identidade imutável `nome+marca+fenil`) é tratado na proposta **ENH-0004** — sem ele o matching determinístico exige parse frágil do texto.
- **Lifecycle e autorização atuais:** `is_ativa` (ativa/inativa) com triggers de normalização e de remoção de favoritos na desativação; RLS com SELECT público de globais, dono/delegado/admin e admin em dual-check (`is_admin_user` × claim JWT); RPCs `ativar_referencia`, `remover_ou_desativar_referencia` (hard delete só sem registros), `is_admin_user`, `get_estatisticas_admin` `[CONFIRMED: ../current/database/referencias.md, ../current/database/rpc.md, ../current/security/security-model.md]`. Admin pode hoje criar/editar `is_global = true` manualmente (policies INSERT/UPDATE admin) `[CONFIRMED: ../current/database/referencias.md]`.
- **Registros e favoritos:** registros guardam só `referencia_id` (join ao vivo do nome — `registros.service.ts:58-94`); favoritos em `referencias_favoritas` com unique `(usuario_id, referencia_id)` `[CONFIRMED: code, ../current/database/referencias_favoritas.md]`.
- **Infraestrutura de jobs existente:** `public.background_job_executions` (run_id, job_key, environment prod|dev, status enum `success|failure|partial` — **`partial` sem produtor hoje**, started/finished/duration/message/details jsonb, retenção 365d via trigger — BR-027, RLS admin-only SELECT, escrita via service_role); helper `recordBackgroundJobExecution` (`src/shared/background-jobs.ts`); único cron: `vercel.json` `0 12 * * *` → `/api/keepalive` (multi-alvo prod+dev; FEAT-0013; ADR-0007) `[CONFIRMED: ../current/database/background_job_executions.md, ../current/backend/background-jobs.md, ../current/backend/api-keepalive.md]`.
- **Monitoramento admin:** painel admin com seção de jobs/histórico (FEAT-0012) e UI de histórico com paginação/seletor de page size (ENH-0003, implementada e arquivada) `[CONFIRMED: ../current/features/FEAT-0012-painel-administrativo.md, ../archive/implemented/enhancements/ENH-0003-historico-execucoes-seletor-paginacao.md]`.
- **Ator e auditoria:** não existe ator "Sistema" — `usuarios.role` é `'user'|'admin'` e `usuarios.id` FK→`auth.users` ON DELETE CASCADE (criar um ator exige identidade real no Supabase Auth via Admin API, não só INSERT em `usuarios`); não existe tabela/pattern de auditoria, curadoria, snapshot ou backup `[CONFIRMED: ausência — specs/código]`.
- **Suporte a edge schedule do Supabase = [UNKNOWN]** — `Evidence Needed:` verificar disponibilidade/limitações do plano atual (candidato da Alternative B2).

## Proposed State

Mecanismo recorrente, controlado e auditável de sincronização do conjunto `is_global = true` com a origem ANVISA/Power BI (draft §8). Regras fixadas pelo draft (conteúdo decidido; novas BRs a registrar na promoção):

- **Fidelidade e modelo (§§3–6):** dados substantivos imutáveis; identidade por `nome+marca+fenil_mg_por_100g` normalizada de forma determinística (modelo canônico do ENH-0004); o valor oficial persistido nunca é substituído pela normalização; **sem matching semântico para decidir identidade** — similaridade/heurística apenas como auxílio de curadoria; **sem IA/LLM para normalização**.
- **Comparação bidirecional (§16):** detecta presentes só na origem, presentes só no MeuFenil e divergências substantivas; **uma única sync confiável** com referência ativa ausente da origem é suficiente para arquivar; **sync não confiável jamais arquiva ou cria** (§§16, 22).
- **Aplicação (§§11–13, 21):** mudança substantiva na origem = arquivar a antiga + criar a nova **somente quando aprovada pela curadoria** (nunca UPDATE in-place); diff GitHub-like no histórico (§§12, 35); duplicidade exata deduplicável; **duplicidade conflitante invalida a sync** (§21); atomicidade e idempotência (§§23, 42); concorrência tratada (single-flight/advisory lock/serialização — B10).
- **Curadoria (§§13–15):** aprovar (arquivar antiga + criar nova + registrar decisão, auditoria e diff) ou rejeitar (nenhuma alteração + motivo registrado; divergência vira conhecida e deliberada); **independente por sync** — não cria regra permanente; rejeição não é erro. "Sincronizado" = sem divergências desconhecidas.
- **Lifecycle do conjunto sincronizado (§§17–18, 33):** arquivada **não reativa**; reaparição na origem = nova referência; bloqueio manual de admin (`is_ativa = false`) é preservado silenciosamente (presença na origem não é divergência); alteração manual de `is_ativa` por admin é auditada; distinção "arquivada-pela-origem" × "bloqueada-manual" com mecanismo em aberto *(decisão pendente — ver Alternatives B8)*.
- **Unidade e estados (§§24, 28, 44):** cada sync = execução completa (`extração → validação → comparação → aplicação/pendências → conclusão`) com **ID único** rastreando eventos, pendências, snapshots, backups e auditoria; estados conceituais: sucesso / falha técnica / origem inválida / pendências de curadoria / concluída com divergências conhecidas / cancelada-revertida / restaurada — representação mínima em aberto *(decisão pendente — ver Alternatives B6)*; pendências canceladas/revertidas permanecem no histórico e não recebem nova decisão (§32).
- **Snapshots e backups (§§25–27, 46):** snapshot do payload bruto da origem por sync; **backup completo de `referencias` antes de cada sync com retenção FIXADA de 12 meses**; retenção de snapshots a avaliar *(decisão pendente — ver Alternatives B3)*.
- **Rollback e restauração (§§29–31):** rollback seletivo desfaz somente as alterações da sync escolhida, preservando alterações posteriores (backup completo permanece como recuperação excepcional); restauração excepcional cria evento de recuperação, preserva todo o histórico e exige permissão específica — estendendo o modelo atual (`is_admin_user`/helpers), **sem sistema de autorização paralelo**.
- **Ator das escritas (§§37–38):** preferência por ator "Sistema" — exige identidade real no Supabase Auth via Admin API (FK `criado_por → usuarios` não pode quebrar) *(decisão pendente — ver Alternatives B5)*.
- **Validação da extração (§22):** checks de quantidade/campos/tipos/duplicidades/fenil inválida/estrutura inesperada; margem de variação com retry → abort/falha; calibração com dados reais pendente — *[UNKNOWN]*.
- **Bootstrap (§§19–20):** primeiro processo seguro: linha de base, matching determinístico, mapeamento de equivalências/ausências/divergências, sem arquivamentos/criações indevidos na implantação. **Globais sem correspondência na 1ª extração viram divergência conhecida listada para curadoria manual — nunca arquivamento automático (OQ3, 2026-09-02).**
- **Auditoria (§36):** catálogo mínimo decidido: sync iniciada, extração, validação/resultado, backup/snapshot criados, referência criada/arquivada, mudança aprovada/rejeitada + motivo, alteração manual de `is_ativa`, rollback, restauração, cancelamento/reversão de pendência. **Fronteira (OQ4, 2026-09-02): a infra nova cobre apenas sync/curadoria + alteração manual de `is_ativa` por admin; operações manuais atuais fora do sync (remoção/desativação/reativação via RPCs, criação/edição admin) NÃO ganham auditoria nesta proposta** *(mecanismo de armazenamento em aberto — ver Alternatives B7)*.
- **UI admin (§45):** histórico de syncs (status, datas, contagens encontradas/criadas/arquivadas, divergências, pendências, decisões), diff, curadoria (aprovar/rejeitar + motivo), rollback/recuperação e auditoria — estende o painel atual (FEAT-0012/ENH-0003) com o mesmo padrão visual.
- **Escopo da sincronização:** somente `is_global = true`. **Cadência (OQ1, 2026-09-02): cron semanal + execução manual sob demanda no painel admin, sempre disponível, registrada como sync normal** — o portador do agendamento permanece em aberto *(decisão pendente — ver Alternatives B2)*. **Criação manual de globais (OQ2, 2026-09-02): política atual mantida até o bootstrap** — admin continua podendo criar/editar `is_global = true` sem bloqueio; a regra "toda global rastreia à origem" entra após a 1ª sincronização confiável validar o matching. Integração com o `powerbi-export` em aberto *(decisão pendente — ver Alternatives B1)*.

## Motivation

- **FACTUAL:** não existe mecanismo atual de detecção/aplicação de mudanças da origem (ausência documentada — specs e código); o catálogo global foi carregado manualmente (seed 2026-01-01, 2.959 INSERTs) e a fonte pode mudar sem aviso (draft §2); a extração programática já existe e foi validada funcional `[CONFIRMED: powerbi-export]`; a infraestrutura de jobs/cron/persistência/RLS-admin já existe e é reutilizável `[CONFIRMED: ../current/backend/background-jobs.md, FEAT-0013]`; o enum de status já contém `partial` sem produtor `[CONFIRMED: ../current/database/background_job_executions.md]`.
- **ASSUMPTION:** a origem muda com frequência suficiente para justificar automação recorrente (não medido — depende da 1ª extração real); histórico/auditoria/rollback têm valor de longo prazo para o dado crítico (hipótese do draft §1, aceita pelo usuário); custo de storage de snapshots/backups é aceitável no plano atual (hipótese — B3).

## Evidence

- Draft `001-auto-refresh-database.md` — §§1–52 (missão, contexto e todas as regras acima); §§53–69 (processo de implementação — ver Out of Scope).
- Decisão do usuário em 2026-09-02: FEAT-0017 (sincronização) dependente do ENH-0004 (modelo canônico/identidade); gerar as specs nesta ordem.
- Fatos de infraestrutura: `vercel.json` (cron), `api/keepalive.ts`, `src/shared/background-jobs.ts`, `src/react-app/services/background-jobs.service.ts`, `supabase/migrations/20260807000000_background_job_executions.sql`.
- Verificação de duplicatas (2026-09-02): **nenhuma proposta similar** ativa ou arquivada; **relacionados (não duplicados)** — escopos distintos, citados em Dependencies: FEAT-0015 (papel admin), SEC-0001 (autorização de RPCs), REF-0002 (RPCs órfãs de dashboard), TEST-0002/TEST-0003 (testes de policies/edge functions).
- `[UNKNOWN]` registrados: contagem/tamanho/variabilidade da origem (1ª extração real); suporte a edge schedule no Supabase (B2); formato completo do JSON em volume real.

## Scope

Todo o mecanismo: integração com `powerbi-export` (B1); agendamento/cron (B2); validação da extração com margens (B9); matching determinístico + comparação bidirecional + detecção de duplicidades; aplicação automática segura (criação de novas globais e arquivamento por ausência — apenas em sync confiável); curadoria humana (aprovar/rejeitar + motivo); snapshots e backups (B3 — retenção de backups 12 meses FIXADA); registro de execução/estados (B6); histórico com diff GitHub-like; rollback seletivo e restauração excepcional auditada (B4); auditoria (B7); distinção arquivada-pela-origem × bloqueada-manual (B8); ator "Sistema"/`criado_por` (B5); concorrência/atomicidade/idempotência (B10); bootstrap seguro (conforme OQ3); política de criação manual de globais (OQ2); cadência (OQ1); UI administrativa (histórico/status/contagens/curadoria/diff/rollback/auditoria — impacta FEAT-0012); retenções e limpezas automáticas; novas BRs (BR-034+) e atualização de specs na promoção.

## Out of Scope

- Modelo canônico e identidade imutável (coluna `marca`, backfill, índices, trigger de favoritos) → **ENH-0004** (dependência — esta proposta NÃO altera schema de `referencias` além do que o ENH-0004 entregar e do marcador de B8, decidido aqui).
- Mudanças de UX para usuários não-admin fora do necessário (indicação de referência arquivada/indisponível já existe no comportamento atual — FEAT-0008).
- Normalização determinística via IA/LLM e matching semântico como decisor (proibidos pelo draft §§5–6).
- Exclusão física de referências pela aplicação no conjunto sincronizado (draft §34; fronteira geral decidida na OQ4 do ENH-0004).
- Conteúdo processual do draft §§53–69 (fases, sub-agentes, `.ai/.temp`, critérios de conclusão) — vira plano de implementação após decisão humana; não é seção de spec.
- Decisões das Open Questions 1–4 e Alternatives B1–B10 — reservadas às rodadas de confirmação humana R0–R4.

## Impacted Features

- [FEAT-0012 Painel administrativo](../current/features/FEAT-0012-painel-administrativo.md) — novas seções de sincronizações/curadoria/histórico/diff/rollback/auditoria (padrão ENH-0003: filtros, paginação, tabela×cards, modal de detalhes)
- [FEAT-0013 Background jobs](../current/features/FEAT-0013-background-jobs.md) — infraestrutura de jobs reaproveitada/estendida (B2/B6)
- [FEAT-0008 Referências alimentares](../current/features/FEAT-0008-referencias-alimentares.md) — interação com lifecycle/arquivamento e indicadores de estado (conjunto global)
- [ENH-0003 Histórico das execuções](../archive/implemented/enhancements/ENH-0003-historico-execucoes-seletor-paginacao.md) — precedente de UI reaproveitado (arquivada — referência de padrão)

## Impacted Business Rules

Existentes (links — as que o sync deve respeitar/estender):
- [BR-017](../current/domain/business-rules.md) — remoção de global exclusiva de admin
- [BR-018](../current/domain/business-rules.md) — referência com registros não é excluída hard
- [BR-019](../current/domain/business-rules.md) — registro exige referência ativa
- [BR-023](../current/domain/business-rules.md) — edição/remoção na UI (dono OU admin E global)
- [BR-024](../current/domain/business-rules.md) — lifecycle ativa ↔ inativa (sync nunca reativa; favoritos preservados após ENH-0004)
- [BR-026](../current/domain/business-rules.md) — exclusão de conta (interação com linhas `criado_por = Sistema` — B5)
- [BR-027](../current/domain/business-rules.md) — retenção 365d de `background_job_executions` (colide com histórico longo de sync — B6)

Novas propostas (numeração **BR-034+**, a registrar na promoção — nunca links para BRs inexistentes):
- **BR-034+** Sincronização controla apenas `is_global = true`; referências não globais nunca são afetadas.
- **BR-034+** Sync não confiável jamais cria, arquiva ou altera referências.
- **BR-034+** Mudança substantiva na origem = arquivar antiga + criar nova, somente por curadoria; sem UPDATE in-place.
- **BR-034+** Matching determinístico decide identidade; semântico só auxilia curadoria.
- **BR-034+** Arquivada-pela-origem não reativa; reaparição = nova referência; bloqueio manual de admin é preservado.
- **BR-034+** Curadoria independente por sync (aprovar/rejeitar + motivo); rejeição = divergência conhecida e válida.
- **BR-034+** Duplicidade conflitante na origem invalida a sync.
- **BR-034+** Sync é unidade com ID único; pendências canceladas/revertidas permanecem no histórico sem nova decisão.
- **BR-034+** Backup completo de `referencias` antes de cada sync, retenção 12 meses; rollback seletivo preserva alterações posteriores.
- **BR-034+** Sem exclusão física pela aplicação no conjunto sincronizado (globais — OQ4 da ENH-0004); auditoria mínima do §36 registrada para operações de sync/curadoria e alteração manual de `is_ativa` por admin — operações manuais fora do sync seguem sem nova infra de auditoria (OQ4).

## Impacted Architecture

- [ADR-0007 — Keepalive/cron jobs](../../decisions/ADR-0007-keepalive-cron-jobs.md) — novo portador de agendamento (B2) integrado à infra Vercel/Supabase existente
- [ADR-0010 — RPCs SECURITY DEFINER](../../decisions/ADR-0010-rpcs-security-definer.md) — novas funções/escritas seguem o padrão (B5/B6)
- [ADR-0004 — RLS como enforcement](../../decisions/ADR-0004-rls-como-enforcement.md) — autorização das novas tabelas/operações (B6/B7/B8)
- [overview](../../current/architecture/overview.md) — sem servidor de aplicação; execução em Vercel/Supabase conforme decisões B1/B2
- Nota: decisões arquiteturais novas (portador do agendamento, integração com `powerbi-export`, modelo de auditoria/backups) podem exigir ADRs novos na promoção — registrar como Origin Contemporary.

## Impacted Frontend / Backend / Database / Security / Tests

- **Frontend:** [pages/admin.md](../current/frontend/pages/admin.md), `useBackgroundJobsAdmin`/`background-jobs.service` e componentes de histórico — novas seções de sincronizações, curadoria (aprovar/rejeitar + motivo), diff e auditoria; DTOs novos; padrões visuais de FEAT-0012/ENH-0003 (filtros, paginação, modal de mensagem).
- **Backend:** `api/` (nova rota/portador do cron — B2), `src/shared/background-jobs.ts` (reuso/extensão para `job_key='referencias-sync'` — B6), integração com o `powerbi-export` (B1); secrets/ambiente conforme [secrets-and-environments.md](../current/security/secrets-and-environments.md).
- **Database:** novas tabelas/estruturas decididas em B3/B6/B7/B8 (registro de syncs/estados, pendências, snapshots/backups, auditoria, marcador arquivada-pela-origem × bloqueada-manual — este último é schema novo pós-ENH-0004, NÃO entra na ENH); migrações versionadas (ADR-0009); RLS admin-only + canais service_role; interação com o trim de 365d (BR-027 × §46); enum `background_job_status` pode ganhar produtor para `partial`.
- **Security:** ator "Sistema" com identidade real no Supabase Auth (B5); permissão específica para rollback/recuperação estendendo `is_admin_user`/helpers — sem sistema paralelo (rel.: FEAT-0015, SEC-0001); proteção de snapshots/backups (B3); auditoria de operações destrutivas; [security-model](../current/security/security-model.md) atualizado na promoção.
- **Tests:** novas suítes de extração/validação, matching determinístico, comparação bidirecional, curadoria, rollback/restauração, RLS das novas tabelas, idempotência, concorrência (quando viável) e bootstrap; revisão dos testes existentes de `referencias`/favoritos/RPCs (draft §47); relacionadas: [TEST-0002](../testing/TEST-0002-suites-seguranca-policies.md), [TEST-0003](../testing/TEST-0003-testes-server-side.md).

## Dependencies

- **ENH-0004 — Modelo canônico e identidade imutável de referências** ([../enhancements/ENH-0004-modelo-identidade-referencias.md](../enhancements/ENH-0004-modelo-identidade-referencias.md)) — esta proposta depende do modelo canônico (coluna `marca`, identidade `nome+marca+fenil`, índices) e da preservação de favoritos entregues por ela; **ordem de criação/implementação: ENH-0004 primeiro (sem dependências), depois FEAT-0017**.
- Relacionados (não duplicados): [FEAT-0015](../features/FEAT-0015-atribuicao-papel-admin.md) (gestão de papel admin), [SEC-0001](../security/SEC-0001-autorizacao-funcoes-consulta.md) (autorização de funções de consulta), [REF-0002](../refactors/REF-0002-rpcs-orfas-dashboard.md) (destino de RPCs órfãs), [TEST-0002](../testing/TEST-0002-suites-seguranca-policies.md) e [TEST-0003](../testing/TEST-0003-testes-server-side.md) (cobertura de segurança/server-side).

## Risks

- Extração quebra ou muda de formato quando o Power BI/ANVISA altera a fonte (draft §2) — mitigação: validação estrutural (B9), snapshot bruto, monitoramento; `powerbi-export` sem `package.json` visível torna dependências/execução menos previsíveis [UNKNOWN — B1].
- Sincronização errônea aplicando arquivamentos/criações indevidos — mitigado por: sync não confiável jamais arquiva/cria, margens com retry→abort, backup antes de cada sync, rollback seletivo e curadoria para mudanças substantivas.
- Primeira extração com contagem/tamanho fora do esperado — calibração de margens depende de dados reais [UNKNOWN].
- Colisão entre o trim de 365d (BR-027) e a exigência de histórico de sync (draft §46) — B6 deve resolver sem perder rastreabilidade.
- Ator "Sistema" exige provisionamento externo (conta no Supabase Auth via Admin API) — dependência operacional fora do repositório (B5).
- Custo/volume de snapshots e backups no plano atual (hipótese) — B3 deve dimensionar antes de ACCEPTED.
- Mudanças de lifecycle (não reativação, preservação de bloqueio manual) alteram comportamento documentado (BR-024/BR-023) — coordenação com ENH-0004 e specs na promoção.
- Divergências rejeitadas reaparecem a cada sync por design (draft §14) — risco de ruído na UI de curadoria (hipótese).

## Alternatives

- **B1 — Integração com o `powerbi-export`:** (a) biblioteca interna no monorepo (portar/extrair módulos); (b) CLI/processo externo invocado pela aplicação; (c) submódulo git; (d) rotina externa agendada + upload/webhook do JSON; (e) endpoint próprio consumidor do JSON exportado. **Decision:** TBD — a escolha é humana e é obrigatória para ACCEPTED/IMPLEMENTED; na aprovação registrar **Approved by:** e **Approved on:**
- **B2 — Portador do agendamento:** (a) novo cron em `vercel.json` + API route dedicada; (b) estender `/api/keepalive` para multi-job; (c) GitHub Actions schedule + webhook; (d) edge schedule do Supabase — suporte [UNKNOWN — verificar]. Nota: a **cadência semanal + manual sob demanda é decisão da OQ1 (2026-09-02)** — esta alternativa escolhe apenas o portador do agendamento. **Decision:** TBD — a escolha é humana e é obrigatória para ACCEPTED/IMPLEMENTED; na aprovação registrar **Approved by:** e **Approved on:**
- **B3 — Snapshots/backups:** (a) tabelas jsonb com RLS; (b) Supabase Storage bucket privado; (c) híbrido — avaliar compressão, checksum, proteção contra exclusão acidental e custo; retenção de backups **12 meses (fixada)**; retenção de snapshots a avaliar. **Decision:** TBD — a escolha é humana e é obrigatória para ACCEPTED/IMPLEMENTED; na aprovação registrar **Approved by:** e **Approved on:**
- **B4 — Rollback seletivo:** (a) log de alterações + operações inversas; (b) copy-on-write; (c) restauração das linhas tocadas pela própria sync — atenção: desfazer um arquivamento não pode violar "arquivada não reativa" (registrar o evento como restauração/reversão no histórico). **Decision:** TBD — a escolha é humana e é obrigatória para ACCEPTED/IMPLEMENTED; na aprovação registrar **Approved by:** e **Approved on:**
- **B5 — Ator das escritas/`criado_por`:** (a) usuário "Sistema" real via Admin API do Supabase Auth (identidade real; `criado_por` mantém FK; atenção BR-026); (b) `criado_por` nullable + RLS; (c) RPC SECURITY DEFINER com service_role e ator explícito; (d) coluna de origem — sem sistema de autorização paralelo: estender `is_admin_user`/helpers (rel. FEAT-0015, SEC-0001). **Decision:** TBD — a escolha é humana e é obrigatória para ACCEPTED/IMPLEMENTED; na aprovação registrar **Approved by:** e **Approved on:**
- **B6 — Registro de execução/estados:** (a) reuso de `background_job_executions` (`job_key='referencias-sync'`, `run_id` = id da sync, `partial` ganha produtor; estados de negócio em `details`); (b) tabela própria de syncs; (c) híbrido — atenção: trim de 365d (BR-027) × exigência do draft §46 de manter histórico de sync/auditoria. **Decision:** TBD — a escolha é humana e é obrigatória para ACCEPTED/IMPLEMENTED; na aprovação registrar **Approved by:** e **Approved on:**
- **B7 — Auditoria:** (a) tabela única de eventos; (b) tabelas por domínio; (c) trigger genérico — catálogo mínimo de eventos do §36 é conteúdo decidido (ver Proposed State). **Decision:** TBD — a escolha é humana e é obrigatória para ACCEPTED/IMPLEMENTED; na aprovação registrar **Approved by:** e **Approved on:**
- **B8 — Distinção arquivada-pela-origem × bloqueada-manual:** (a) coluna/marcador em `referencias` (schema novo pós-ENH-0004 — NÃO entra na ENH); (b) derivação por evento de auditoria. **Decision:** TBD — a escolha é humana e é obrigatória para ACCEPTED/IMPLEMENTED; na aprovação registrar **Approved by:** e **Approved on:**
- **B9 — Validação da extração/margens:** retry → abort/falha; checks estruturais e de conteúdo; margens de variação de quantidade calibradas com dados reais — [UNKNOWN até a 1ª extração]. **Decision:** TBD — a escolha é humana e é obrigatória para ACCEPTED/IMPLEMENTED; na aprovação registrar **Approved by:** e **Approved on:**
- **B10 — Concorrência:** (a) single-flight em tabela de estado; (b) advisory lock; (c) serialização por estado (uma sync por vez; curadoria × sync aplicando; rollback × sync ativa). **Decision:** TBD — a escolha é humana e é obrigatória para ACCEPTED/IMPLEMENTED; na aprovação registrar **Approved by:** e **Approved on:**

## Open Questions

1. Cadência e gatilhos: frequência (diária como o keepalive? semanal? manual sob demanda sempre disponível + agendada?) e execução manual no painel admin além do cron?
   - **RESOLVIDA (2026-09-02, usuário):** cron semanal + execução manual sob demanda no painel admin, sempre disponível; execução manual registrada como sync normal.
2. Criação manual de referências globais fora da origem: hoje o RLS permite admin criar/editar `is_global = true` livremente; a regra "toda global deve rastrear à origem" deve (a) bloquear novas criações manuais, (b) permitir só com auditoria/marcação explícita, ou (c) permanecer como está até o bootstrap (transição)?
   - **RESOLVIDA (2026-09-02, usuário):** opção (c) — manter a política atual até o bootstrap (admin continua criando/editando `is_global = true` sem bloqueio); a regra definitiva "toda global rastreia à origem" entra após a 1ª sincronização confiável validar o matching.
3. Globais atuais sem correspondência na primeira extração (contagem exata [UNKNOWN] até a 1ª extração — seed de 2.959 INSERTs; total de linhas em prod = 2.986 em 2026-08-13): divergência conhecida temporária até curadoria manual, ou lote de arquivamento só após confirmação humana?
   - **RESOLVIDA (2026-09-02, usuário):** divergência conhecida listada para curadoria manual — nunca arquivamento automático.
4. Fronteira do sistema de auditoria novo: apenas operações da sincronização/curadoria (e `is_ativa` manual de admin), ou também operações manuais atuais fora do sync (remoção/desativação/reativação via RPCs, criação/edição admin)?
   - **RESOLVIDA (2026-09-02, usuário):** a infra nova de auditoria cobre apenas sync/curadoria (catálogo do §36) + alteração manual de `is_ativa` por admin; operações manuais atuais fora do sync (RPCs, criação/edição admin) NÃO ganham auditoria nesta proposta — seguem como estão, sem nova infra.

## Acceptance Criteria

- [ ] Extração integrada (B1) executável de ponta a ponta com o `powerbi-export`; payload bruto preservado em snapshot por sync (B3)
- [ ] Validação da extração com checks e margens (B9); origem inválida/não confiável aborta antes de qualquer efeito — nenhuma criação/arquivamento em sync não confiável
- [ ] Matching determinístico (identidade `nome+marca+fenil` normalizada — ENH-0004); comparação bidirecional detectando inclusões, ausências e divergências; duplicidade conflitante invalida a sync
- [ ] Backup completo de `referencias` antes de cada sync com retenção de 12 meses (fixada); snapshots conforme B3
- [ ] Mudanças substantivas da origem geram pendência de curadoria com diff GitHub-like; aprovar = arquivar antiga + criar nova; rejeitar = sem alteração + motivo auditado; decisão é independente por sync
- [ ] Referência arquivada não reativa (nem pelo sync nem por fluxo automático); reaparição na origem = nova referência; bloqueio manual de admin preservado; distinção arquivada × bloqueada conforme B8
- [ ] Rollback seletivo desfaz apenas as alterações da sync escolhida, preservando alterações posteriores; restauração excepcional cria evento de recuperação e nunca apaga histórico; pendências afetadas ficam canceladas/revertidas no histórico
- [ ] Sync é unidade com ID único; estados conceituais do §44 representados conforme B6; execução agendada (cron semanal) e manual sob demanda no painel admin — sempre disponível, registrada como sync normal — idempotente: duas execuções da mesma origem válida não duplicam nem geram alterações artificiais (OQ1)
- [ ] Concorrência tratada (B10): sync simultânea, curadoria durante sync, rollback durante sync — sem estado inconsistente
- [ ] Auditoria (catálogo mínimo do §36) registrando operações de sync/curadoria e alteração manual de `is_ativa` por admin; operações manuais fora do sync (RPCs, criação/edição admin) seguem sem nova infra de auditoria (OQ4)
- [ ] UI admin: histórico de syncs com status/datas/contagens, pendências de curadoria, diff, rollback/recuperação e auditoria (padrão FEAT-0012/ENH-0003)
- [ ] Bootstrap executado: globais sem correspondência na 1ª extração registradas como divergência conhecida para curadoria manual — zero arquivamento/criação automática no bootstrap (OQ3)
- [ ] Política de `is_global` (OQ2): criação manual de globais permanece liberada (status quo) até o bootstrap; após a 1ª sincronização confiável validar o matching, a regra "toda global rastreia à origem" passa a valer (mecanismo de bloqueio/auditoria conforme a decisão de implementação)
- [ ] Migrações versionadas (ADR-0009); RLS das novas tabelas admin-only com escritas via service_role; autorização de rollback estendida sem sistema paralelo (B5)
- [ ] Testes: novas suítes (extração, matching, curadoria, rollback, RLS, idempotência, bootstrap) + suítes existentes de referências/favoritos/RPCs revisadas e verdes (draft §47); funcionalidades existentes de referências continuam cobertas
- [ ] Specs atualizadas na promoção: novas BRs (BR-034+), BR-023/024/026/027 afetadas, FEAT-0012/0013/0008, security-model, system-map
- [ ] TBD (depende das Alternatives B1–B10): forma de integração, portador do agendamento (cadência semanal + manual já decidida — OQ1), armazenamento/retenção de snapshots, mecanismo de rollback, ator das escritas, modelo de registro/estados, modelo de auditoria, marcador arquivada × bloqueada, validação/margens, estratégia de concorrência

## References

- Draft `001-auto-refresh-database.md` (arquivado): [../draft/archive/001-auto-refresh-database.md](../draft/archive/001-auto-refresh-database.md)
- Specs atuais: `../current/database/referencias.md`, `../current/database/background_job_executions.md`, `../current/database/rpc.md`, `../current/database/triggers.md`, `../current/database/usuarios.md`, `../current/backend/background-jobs.md`, `../current/backend/api-keepalive.md`, `../current/security/security-model.md`, `../current/security/secrets-and-environments.md`, `../current/domain/business-rules.md`, `../current/features/FEAT-0008-referencias-alimentares.md`, `../current/features/FEAT-0012-painel-administrativo.md`, `../current/features/FEAT-0013-background-jobs.md`
- ADRs: `../../decisions/ADR-0007-keepalive-cron-jobs.md`, `../../decisions/ADR-0010-rpcs-security-definer.md`, `../../decisions/ADR-0004-rls-como-enforcement.md`
- Propostas relacionadas: `../features/FEAT-0015-atribuicao-papel-admin.md`, `../security/SEC-0001-autorizacao-funcoes-consulta.md`, `../refactors/REF-0002-rpcs-orfas-dashboard.md`, `../testing/TEST-0002-suites-seguranca-policies.md`, `../testing/TEST-0003-testes-server-side.md`
- Dependência: `../enhancements/ENH-0004-modelo-identidade-referencias.md`
- Código/migrations: `api/keepalive.ts`, `src/shared/background-jobs.ts`, `vercel.json`, `supabase/migrations/20260807000000_background_job_executions.sql`, `src/react-app/services/registros.service.ts`, `migrations/dados.sql`
- Projeto externo: `powerbi-export` (`C:\Users\lucas\Documents\git\powerbi-export` — fora do repo; `src/decode.js`, `src/fetch.js`, `src/export.js`, `test/decode.test.js`)
