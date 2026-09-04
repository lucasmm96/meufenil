# ENH-0004 — Modelo canônico e identidade imutável de referências

**Type:** ENH
**Status:** PROPOSED
**Title:** Modelo canônico e identidade imutável de referências
**Issue:** #49
**Created on:** 2026-09-02

## Problem

O modelo atual de `public.referencias` embute a marca no `nome` como texto literal (`(Marca: X)`) e define unicidade por nome; sem distinção nome × marca e sem identidade substantiva comparável (`nome + marca + fenil_mg_por_100g`), o catálogo não suporta matching determinístico contra a origem ANVISA/Power BI nem a coexistência de referências históricas com o mesmo nome — pré-requisito da sincronização controlada proposta no draft (FEAT-0017).

## Current State

- Schema de `public.referencias`: colunas `id`, `nome` text NOT NULL, `fenil_mg_por_100g` real NOT NULL, `criado_por` uuid NOT NULL default `auth.uid()` FK→`usuarios(id)` ON DELETE CASCADE, `is_global` bool NOT NULL default false, `created_at`/`updated_at`, `nome_normalizado` text NOT NULL, `is_ativa` bool NOT NULL default true; índices únicos `referencias_nome_unique` (`lower(nome)`) e `referencias_nome_normalizado_unique`; nenhuma CHECK; **não existe coluna `marca`** `[CONFIRMED: ../current/database/referencias.md — catálogo dev/prod 2026-08-13]`.
- Marca embutida no nome: o seed legado `migrations/dados.sql` contém **2.959 INSERTs**, todos com o sufixo literal `(Marca: X)` — ex.: `(Marca: Royal)`, `(Marca: Mavalério)`; produto in natura = `(Marca: Não Se Aplica/Produto In Natura)` (no Power BI a string é `NÃO SE APLICA (PRODUTO IN NATURA)` — draft §7) `[CONFIRMED: migrations/dados.sql — contagem e amostras 2026-09-02]`. Nota: `current/database/referencias.md` registra "2.958 INSERTs" — divergência de contagem de 1 linha entre a spec atual e o arquivo (não corrigida por esta proposta; registrar como drift).
- Triggers em `referencias`: `trg_normalizar_nome_referencia` (BEFORE INSERT OR UPDATE — preenche `nome_normalizado = lower(trim(nome))`) e `trg_remover_favoritos_referencia_inativa` (AFTER UPDATE OF `is_ativa` — quando ativa passa a inativa, remove os favoritos da referência em `referencias_favoritas`) `[CONFIRMED: ../current/database/triggers.md]`. A BR-024 documenta esse comportamento (desativação remove favoritos) `[CONFIRMED: ../current/domain/business-rules.md]`.
- RLS de `referencias`: SELECT público de globais (anon lê `is_global = true`); INSERT/UPDATE dono/delegado/admin; admin verificado de duas formas (policies dedicadas com `role='admin'` e claim JWT `auth.jwt()->>'role'='admin'` — dual-check conhecido); DELETE de não-global pelo dono e de global por admin, com registros vinculados bloqueando; RPCs `remover_ou_desativar_referencia` (SECURITY DEFINER — soft `is_ativa=false` quando há registros; hard DELETE quando não há) e `ativar_referencia` (dono/delegado/admin) `[CONFIRMED: ../current/database/referencias.md, ../current/database/rpc.md, ../current/security/security-model.md]`.
- Registros de consumo guardam apenas `referencia_id` (sem snapshot do nome); a exibição histórica faz join ao vivo `referencias!inner ( nome )` com fallback "Alimento removido" (`src/react-app/services/registros.service.ts:58-94`); a exportação de dados do perfil (JSON, LGPD) projeta `referencias ( nome )` junto dos registros (`src/react-app/pages/Perfil.tsx:84-95`); a exportação CSV de estatísticas é agregada por dia, sem join (`src/react-app/pages/Estatisticas.tsx:58-69`) `[CONFIRMED: code]`.
- `referencias_favoritas`: único `(usuario_id, referencia_id)`; FK `referencia_id → referencias(id)` ON DELETE CASCADE `[CONFIRMED: ../current/database/referencias_favoritas.md]`.
- Frontend: `ModalReferencia` cria/edita apenas `nome` + fenil; a página Referências exibe o nome como texto único (o sufixo de marca aparece dentro do nome); edição/remoção na UI regida pela BR-023 (dono OU admin E global) `[CONFIRMED: ../current/features/FEAT-0008-referencias-alimentares.md + code]`.
- Não existe auditoria, curadoria, snapshot nem backup de referências `[CONFIRMED: ausência — specs e código atuais]`.

## Proposed State

- `marca` passa a ser coluna própria; a **identidade substantiva** de uma referência passa a ser o conjunto `(nome, marca, fenil_mg_por_100g)`, **imutável depois de criada para o conjunto global** (`is_global = true`): mudança substantiva em referência global representa uma nova referência (arquivar a existente + criar a nova), nunca um UPDATE in-place pela aplicação (draft §§3–5, 11–12; alcance decidido na OQ1 — referências pessoais continuam editáveis pelo dono, status quo BR-023). Exclusão física (OQ4): a regra do draft §34 vale para o conjunto global — referências globais nunca são excluídas fisicamente pela aplicação; pessoais sem registros mantêm o hard DELETE atual via RPC e a BR-026 permanece inalterada.
- Redesenho de unicidade/índices para permitir que referências históricas com o mesmo nome/marca coexistam com as ativas (draft §40) — desenho em aberto *(decisão pendente — ver Alternatives A1)*.
- Avaliação do tipo numérico de `fenil_mg_por_100g` (exatidão para comparação/matching) *(decisão pendente — ver Alternatives A2)*.
- Coluna `marca` + migração das 2.959 linhas existentes com parse do sufixo `(Marca: X)`: `nome` reescrito/limpo (sem o sufixo) e `marca` extraída; produto sem marca/in natura = representação canônica fixa **`Produto In Natura`** (OQ2, 2026-09-02 — opção (a) da A3 prevalecida; ver Alternatives).
- Estratégia de normalização (armazenada vs. runtime) — a ENH **não constrói motor de matching/normalização para a origem** (isso pertence ao FEAT-0017); decide apenas o que acontece com `nome_normalizado`/índices no modelo *(decisão pendente — ver Alternatives A4)*.
- Trigger `trg_remover_favoritos_referencia_inativa`: passa a **preservar favoritos em QUALQUER desativação/arquivamento** (inclusive o fluxo manual atual "remover com registros") — referência arquivada permanece favoritada, aparece como arquivada/indisponível, não pode ser usada em novos registros e pode ser desfavoritada normalmente (draft §10; OQ3, 2026-09-02). É uma mudança de LIFECYCLE (BR-024) que vale para **todo** fluxo — manual atual e futura sincronização. Reativação manual de referência pessoal pelo dono (RPC `ativar_referencia`) permanece permitida; a fronteira "arquivada não reativa" fica restrita ao conjunto sincronizado e pertence ao FEAT-0017 (OQ3).
- Apresentação combinada nome + marca passa a ser montada **dinamicamente no frontend**; formulários de criação/edição e listagens passam a tratar os campos separadamente. Registros históricos e exportações continuam resolvendo o nome pelo join ao vivo (sem snapshot nesta proposta).
- Migração versionada pelo mecanismo oficial (ADR-0009); na promoção: novas BRs (BR-034+) registradas e BRs atuais afetadas (BR-023, BR-024) atualizadas.

## Motivation

- **FACTUAL:** a marca está embutida no nome em 100% do seed (2.959 linhas com `(Marca: X)`) `[CONFIRMED: migrations/dados.sql]`; os índices únicos por nome impedem duas referências históricas com o mesmo nome, incompatível com identidade imutável + histórico (draft §§11–12, 40) `[CONFIRMED: ../current/database/referencias.md]`; o matching determinístico da origem exige `nome+marca+fenil` separados — sem coluna `marca`, comparar exige parse frágil do texto (draft §§3–5) `[CONFIRMED: draft]`; o trigger de favoritos conflita com a regra de arquivamento com favoritos preservados (draft §10) `[CONFIRMED: ../current/database/triggers.md × draft §10]`.
- **ASSUMPTION:** o volume atual (prod = 2.986 linhas em 2026-08-13 `[CONFIRMED: ../current/database/referencias.md E6]`) e a cadência baixa de mudanças tornam a migração única com parse + revisão humana segura (hipótese; depende da 1ª extração real — ver FEAT-0017); separar marca melhora busca/leitura do catálogo (hipótese de UX não medida).

## Evidence

- Draft `001-auto-refresh-database.md` §§3–7 (identidade substantiva e estrutura), §10 (`is_ativa`/favoritos), §§11–12 (mudança substantiva = nova referência; histórico), §34 (sem exclusão física pela aplicação), §§39–41 (schema atual, índices, tipo do fenil).
- Decisão do usuário em 2026-09-02: dividir o draft em ENH-0004 (modelo canônico e identidade — sem dependências, gerar primeiro) + FEAT-0017 (sincronização — depende desta).
- Contagem e amostras do seed: `migrations/dados.sql` (2026-09-02).
- ADR-0006 (soft delete de referências) como base da política de arquivamento.
- Verificação de duplicatas (2026-09-02): nenhuma proposta similar em `proposed/` ou `archive/`; FEAT-0017 é dependência futura (relação registrada nas duas specs).

## Scope

Coluna `marca` + backfill das 2.959 linhas (opção (a) da A3 — OQ2: `nome` limpo + canônico `Produto In Natura`); tipo numérico do fenil (A2); redesenho de unicidade/índices (A1); estratégia de `nome_normalizado`/normalização armazenada (A4); alteração do trigger de favoritos (preservação em qualquer desativação — OQ3); apresentação combinada dinâmica no frontend (exibição e edição); revisão dos fluxos de escrita (RPCs/UI) para a imutabilidade substantiva do **conjunto global** (OQ1 — pessoais seguem BR-023); exclusão física no conjunto global (OQ4 — pessoais sem registros e BR-026 mantêm o fluxo atual); migrations versionadas; ajustes de specs atuais e novas BRs (BR-034+) na promoção.

## Out of Scope

- Motor de matching/normalização determinística contra a origem, sincronização, snapshots/backups, curadoria, auditoria, rollback, ator "Sistema" e bootstrap → **FEAT-0017** (dependência desta proposta).
- Snapshot do nome em `registros` (registros continuam com join ao vivo — nenhuma mudança proposta).
- Conteúdo processual do draft §§53–69 (fases, sub-agentes, `.ai/.temp`, critérios de conclusão) — vira plano de implementação após decisão humana; não é seção de spec.
- Alternatives A1/A2/A4 permanecem em aberto (TBD — rodadas de confirmação seguintes); A3 decidida na OQ2 e A5 não aplicável (OQ1) — registros nas seções próprias. Open Questions 1–4 resolvidas em 2026-09-02 (registro no corpo).

## Impacted Features

- [FEAT-0008 Referências alimentares](../current/features/FEAT-0008-referencias-alimentares.md) — criação/edição/exibição, favoritos, desativação/reativação, mensagens de erro (inclui `REFERENCIA_DUPLICADA`, hoje "Já existe uma referência com esse nome.")
- [FEAT-0003 Registro diário de consumo](../current/features/FEAT-0003-registro-diario-consumo.md) — criação inline de referência a partir do modal de registro

## Impacted Business Rules

Existentes (links):
- [BR-018](../current/domain/business-rules.md) — soft × hard delete (OQ4 resolvida: globais nunca hard delete pela aplicação; pessoais sem registros mantêm o fluxo atual)
- [BR-023](../current/domain/business-rules.md) — edição/remoção na UI: dono OU (admin E global) — edição substantiva de **globais** deixa de ser UPDATE in-place (OQ1); edição substantiva de pessoais pelo dono permanece (sem mudança)
- [BR-024](../current/domain/business-rules.md) — lifecycle criada → ativa ↔ inativa: preservação de favoritos em qualquer desativação (OQ3) e reativação manual de pessoais mantida; fronteira "arquivada não reativa" restrita ao conjunto sincronizado (FEAT-0017)

Novas propostas (numeração **BR-034+**, a registrar na promoção — nunca links para BRs inexistentes):
- **BR-034+** "Identidade substantiva imutável (globais)": `(nome, marca, fenil_mg_por_100g)` de referência global não é alterado por UPDATE após a criação; mudança substantiva = arquivar + criar nova (OQ1 — pessoais seguem BR-023, sem mudança).
- **BR-034+** "Marca como atributo separado": `marca` própria com `nome` limpo; sem marca/in natura = valor canônico `Produto In Natura` (OQ2).
- **BR-034+** "Favoritos preservados no arquivamento": desativação não remove favoritos em NENHUM fluxo (manual e sync); reativação manual de pessoal pelo dono permanece (substitui o trecho correspondente da BR-024 na promoção — OQ3).
- **BR-034+** "Sem exclusão física de globais pela aplicação": regra do draft §34 aplicada ao conjunto global; pessoais sem registros mantêm o hard DELETE atual via RPC e a BR-026 permanece inalterada (OQ4).

## Impacted Architecture

- [ADR-0006 — Soft delete de referências](../../decisions/ADR-0006-soft-delete-referencias.md) — a política de arquivamento evolui (reativação — OQ3; exclusão física — OQ4)
- [ADR-0009 — Migrations via Supabase CLI](../../decisions/ADR-0009-migrations-supabase-cli.md) — migração versionada pelo mecanismo oficial (`scripts/apply-supabase-migrations.sh`)
- [overview](../../current/architecture/overview.md) — sem mudança de camadas

## Impacted Frontend / Backend / Database / Security / Tests

- **Frontend:** [pages/referencias.md](../current/frontend/pages/referencias.md), [components/modal-referencia.md](../current/frontend/components/modal-referencia.md), [components/adicionar-registro.md](../current/frontend/components/adicionar-registro.md) e `referencias.service`/DTOs — campos `nome` + `marca` separados nos formulários; apresentação combinada montada dinamicamente; textos de erro de duplicidade revisados.
- **Backend:** N/A (não há servidor de aplicação; fluxos de escrita são RLS/RPCs — tratados em Database).
- **Database:** `referencias` (coluna `marca`, índices/unicidade, trigger de normalização/favoritos — A1/A4/OQ3), `referencias_favoritas` (efeito do trigger alterado), migração versionada; revisão dos RPCs `remover_ou_desativar_referencia`/`ativar_referencia` conforme OQ1/OQ3/OQ4.
- **Security:** sem mudança de policy prevista (nova coluna não é security-relevant); RLS existente permanece como fonte de autorização [referencias.md](../current/database/referencias.md), [security-model.md](../current/security/security-model.md).
- **Tests:** `referencias.service.test.ts`, `rpc-ativar-referencia.test.ts`, `rpc-remover-referencia.test.ts`, suítes de RLS existentes; novos testes de migração/backfill, trigger de favoritos, normalização e formulários (relacionadas: [TEST-0002](../testing/TEST-0002-suites-seguranca-policies.md), [TEST-0003](../testing/TEST-0003-testes-server-side.md)).

## Dependencies

Nenhuma. Nota de ordem: o FEAT-0017 (sincronização) depende desta proposta — esta spec deve ser decidida/implementada antes; relação registrada no campo Dependencies do FEAT-0017.

## Risks

- Backfill com parse do sufixo pode produzir `nome` limpo divergente do oficial ou quebrar em casos de parênteses/marcas compostas — mitigação: opção A3(a) decidida (OQ2) com revisão humana por amostragem na migração antes da aplicação em prod.
- Mudança de unicidade pode expor duplicidade latente do seed ou permitir colisões históricas — o desenho A1 deve garantir unicidade no conjunto ativo.
- Alterar o trigger de favoritos muda comportamento documentado (BR-024) para o fluxo manual atual — mudança coordenada na promoção, nunca silenciosa.
- `real` → `numeric` afeta igualdade, matching, DTOs e UI de edição (A2) — compatibilidade com dados existentes a validar.
- Decisões técnicas em aberto (A1/A2/A4 — índices/unicidade, tipo do fenil, normalização) podem exigir ajustes em RPCs/triggers/fluxos — escolha obrigatória antes de ACCEPTED/IMPLEMENTED.

## Alternatives

- **A1 — Desenho de unicidade/índices:** (a) único parcial sobre nome normalizado com `WHERE is_ativa`; (b) composto da identidade `(marca, nome_normalizado, fenil_mg_por_100g)` com/sem `is_ativa`; (c) escopo por `is_global`; (d) coluna canônica nova alimentada por trigger. **Decision:** TBD — a escolha é humana e é obrigatória para ACCEPTED/IMPLEMENTED; na aprovação registrar **Approved by:** e **Approved on:**
- **A2 — Tipo numérico do fenil:** manter `real` × `numeric(10,1)` — impacto em igualdade exata para matching, normalização, casas decimais e compatibilidade com dados existentes. **Decision:** TBD — a escolha é humana e é obrigatória para ACCEPTED/IMPLEMENTED; na aprovação registrar **Approved by:** e **Approved on:**
- **A3 — Coluna `marca` + backfill das 2.959 linhas:** (a) parse do sufixo `(Marca: X)` com `nome` reescrito/limpo — **prevalecida (2026-09-02, usuário, OQ2)**; (b) `nome` intacto + `marca` extraída — descartada; (c) colunas novas apenas para cadastros novos (seed histórico intacto) — descartada. Representação canônica do sem marca/in natura: fixa `Produto In Natura` (OQ2). **Decision:** TBD — a escolha é humana e é obrigatória para ACCEPTED/IMPLEMENTED; na aprovação registrar **Approved by:** e **Approved on:**
- **A4 — Normalização:** (a) evoluir `nome_normalizado` para composto (nome+marca, com a representação canônica decidida em OQ2); (b) eliminar a coluna em favor de normalização runtime no FEAT-0017; (c) manter compatibilidade atual. **Decision:** TBD — a escolha é humana e é obrigatória para ACCEPTED/IMPLEMENTED; na aprovação registrar **Approved by:** e **Approved on:**
- **A5 — UX de mudança substantiva de referências pessoais — NÃO APLICÁVEL:** decidida na OQ1 (2026-09-02, usuário): status quo para pessoais (continuam editáveis pelo dono, BR-023); sem UX nova.

## Open Questions

1. Escopo da imutabilidade substantiva: TODAS as referências (incluindo as pessoais, hoje editáveis pelo dono — BR-023) ou apenas o conjunto global (`is_global = true`), que é o único controlado pela sincronização (draft §8)?
   - **RESOLVIDA (2026-09-02, usuário):** imutabilidade vale apenas para o conjunto global (`is_global = true`); referências pessoais continuam editáveis pelo dono (status quo BR-023), sem UX nova.
2. Produto sem marca/in natura: representação canônica fixa `Produto In Natura` (preferência do draft §7), `NULL` com semântica "sem marca", ou texto oficial preservado? E na migração, o que ocorre com as linhas existentes cujo `nome` contém `(Marca: X)` — `nome` reescrito/limpo, ou intacto com `marca` extraída?
   - **RESOLVIDA (2026-09-02, usuário):** representação canônica fixa `Produto In Natura` para sem marca/in natura; migração com `nome` reescrito/limpo (sufixo `(Marca: X)` removido) e `marca` extraída para a coluna própria (opção (a) da A3); apresentação combinada reconstituída dinamicamente no frontend.
3. Trigger de favoritos e reativação manual: confirma-se que `trg_remover_favoritos_referencia_inativa` deixa de remover favoritos em QUALQUER desativação (inclusive o fluxo manual atual "remover com registros")? E a reativação manual de referência pessoal arquivada pelo dono (RPC `ativar_referencia`) permanece permitida — "arquivada não reativa" aplica-se apenas ao conjunto sincronizado?
   - **RESOLVIDA (2026-09-02, usuário):** sim — o trigger preserva favoritos em QUALQUER desativação (inclusive o fluxo manual atual "remover com registros"); reativação manual de referência pessoal pelo dono (RPC `ativar_referencia`) permanece permitida; "arquivada não reativa" aplica-se apenas ao conjunto sincronizado (fronteira do FEAT-0017).
4. Exclusão física: a regra "referências nunca são excluídas fisicamente pela aplicação" (draft §34) vale também para referências pessoais SEM registros (hoje hard DELETE no RPC `remover_ou_desativar_referencia`) e para a exclusão de conta (BR-026, CASCADE)?
   - **RESOLVIDA (2026-09-02, usuário):** a regra do draft §34 aplica-se ao conjunto global — nunca hard delete pela aplicação no conjunto sincronizado; referências pessoais sem registros MANTÊM o fluxo atual (hard DELETE via RPC `remover_ou_desativar_referencia`); exclusão de conta (BR-026, CASCADE) permanece como está.

## Acceptance Criteria

- [ ] Migration versionada (ADR-0009) cria a coluna `marca` e migra as 2.959 linhas do seed: `nome` reescrito/limpo (sufixo `(Marca: X)` removido), `marca` extraída; sem marca/in natura = canônico `Produto In Natura` (OQ2/A3(a)) — nenhuma linha perdida; demais mudanças técnicas conforme A1/A2/A4
- [ ] `marca` própria populada; apresentação combinada reconstituída dinamicamente no frontend (nunca re-embutida no `nome`)
- [ ] Identidade substantiva imutável para globais (`is_global = true`): nenhum fluxo da aplicação edita `(nome, marca, fenil_mg_por_100g)` por UPDATE após a criação (enforcement conforme A1); mudança substantiva em global = arquivar + criar nova (BR-034+); referências pessoais permanecem editáveis pelo dono (BR-023 — OQ1)
- [ ] Reativação manual de referência pessoal pelo dono (RPC `ativar_referencia`) permanece permitida; "arquivada não reativa" restrita ao conjunto sincronizado (FEAT-0017) (OQ3)
- [ ] Referências globais nunca são excluídas fisicamente pela aplicação; pessoais sem registros mantêm o hard DELETE via RPC; BR-026 (exclusão de conta) inalterada (OQ4)
- [ ] Referências históricas com o mesmo nome podem coexistir conforme o desenho de unicidade decidido em A1
- [ ] Desativar/arquivar uma referência NÃO remove seus favoritos em nenhum fluxo (nova BR-034+; BR-024 ajustada na promoção); o favorito permanece visível como arquivado/indisponível e pode ser removido pelo usuário (OQ3)
- [ ] Frontend trata `nome` e `marca` separadamente (formulários e listagens) e monta a apresentação combinada dinamicamente
- [ ] Registros históricos e exportações continuam resolvendo o nome pelo join ao vivo (comportamento atual preservado)
- [ ] Testes existentes (serviços, RPCs, RLS) verdes; novos testes para migração/backfill, trigger de favoritos, normalização e formulários
- [ ] TBD (depende das Alternatives A1/A2/A4): desenho de unicidade/índices; tipo do fenil; estratégia de normalização

## References

- Draft `001-auto-refresh-database.md` (arquivado): [../draft/archive/001-auto-refresh-database.md](../draft/archive/001-auto-refresh-database.md)
- Specs atuais: `../current/database/referencias.md`, `../current/database/triggers.md`, `../current/database/rpc.md`, `../current/database/referencias_favoritas.md`, `../current/domain/business-rules.md`, `../current/security/security-model.md`, `../current/features/FEAT-0008-referencias-alimentares.md`
- ADRs: `../../decisions/ADR-0006-soft-delete-referencias.md`, `../../decisions/ADR-0009-migrations-supabase-cli.md`
- Código/migrations: `migrations/dados.sql`, `supabase/migrations/20260814000000_baseline_objetos_nao_versionados.sql`, `src/react-app/services/registros.service.ts`, `src/react-app/pages/Perfil.tsx`, `src/react-app/pages/Estatisticas.tsx`, `src/react-app/components/ModalReferencia.tsx`
- Relacionada (dependência futura): `../features/FEAT-0017-sincronizacao-referencias-anvisa.md`
