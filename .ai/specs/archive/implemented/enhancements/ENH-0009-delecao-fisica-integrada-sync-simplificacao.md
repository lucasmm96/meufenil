# ENH-0009 — Deleção física integrada ao sync e simplificação do processo de sincronização

**Type:** ENH
**Status:** IMPLEMENTED
**Title:** Deleção física integrada ao sync e simplificação do processo de sincronização (revisão de FEAT-0017)
**Issue:** #88
**Created on:** 2026-09-20
**Implemented Through:** PR #89 (squash merge `3255c11`, 2026-09-24)

## Problem

FEAT-0017 acumula referências globais arquivadas (`is_ativa = false`) indefinidamente — nenhuma deleção física ocorre no conjunto sincronizado. O mecanismo de curadoria (pendências) e o rollback seletivo adicionam complexidade considerável ao processo de sincronização com retorno questionável: `restaurar_referencias_de_backup` (backup pré-aplicação, retenção 12 meses) já cobre o caso de uso de recuperação de erros de forma mais abrangente do que o rollback seletivo.

## Current State

FEAT-0017 implementado (spec arquivada: `../../archive/implemented/features/FEAT-0017-sincronizacao-referencias-anvisa.md`). O processo atual pós-comparação:

- **`aplicar_sync_referencias`** (SECURITY DEFINER, service_role): cria novas globais, arquiva ausências sem divergência, detecta divergências substantivas → cria pendências em `referencia_sync_pendencias`. Log de operações em `referencia_syncs.alteracoes` (JSONB estruturado para rollback, formato: `[{op, referencia_id, antes, depois}]`).
- **`decidir_pendencia_referencia`**: admin aprova (arquiva antiga + cria nova) ou rejeita (registra motivo; divergência vira conhecida). Tipos de pendência: `absence`, `substitution`.
- **`reverter_sync_referencias`**: desfaz as alterações de uma sync específica via `alteracoes` (operações inversas em ordem reversa — B4 da FEAT-0017).
- **`referencia_sync_pendencias`**: tabela com pendências de curadoria (FK `referencia_id ON DELETE RESTRICT` → `referencias`; FK `sync_id ON DELETE RESTRICT` → `referencia_syncs`).
- **`referencia_eventos.referencia_id`**: FK `ON DELETE SET NULL` para `referencias` — UUID perde-se nos eventos quando a referência é deletada.
- **BR-037:** "Globais nunca são excluídas fisicamente pela aplicação."
- **BR-040:** mudança substantiva na origem = arquivar + criar, somente por curadoria.
- **BR-043:** curadoria independente por sync; rejeição exige motivo.
- **BR-046:** backup pré-aplicação (12 meses) + rollback seletivo preserva alterações posteriores.

Ver `../current/backend/api-referencias-sync.md` e `../current/domain/business-rules.md`.

## Proposed State

### Simplificação do processo

**Curadoria removida.** `referencia_sync_pendencias` descontinuada; `decidir_pendencia_referencia` removido. Toda ausência detectada pela comparação resulta em ação automática imediata — sem fila de revisão humana, sem pendências. O mesmo se aplica ao bootstrap: a distinção de modo bootstrap/pós-bootstrap baseada em curadoria desaparece; a proteção passa a ser o backup pré-sync (criado antes de qualquer aplicação, como hoje).

**Rollback removido.** `reverter_sync_referencias` removido. Recuperação de erros feita exclusivamente via `restaurar_referencias_de_backup`. `referencia_syncs.alteracoes` torna-se campo legado com valor fixo `'{}'::jsonb` (sem leitura esperada); os contadores migram para colunas individuais — `criadas` e `arquivadas` existentes mais `deletadas integer` nova. O log estruturado de operações inversas não é mais necessário.

### Divergências substantivas (substitutions)

**A origem é sempre fonte da verdade para `fenil_mg_por_100g`.** Quando o motor detecta que uma referência existe no catálogo e na origem com a mesma identidade (`nome+marca`) mas com `fenil_mg_por_100g` diferente, a divergência é auto-aplicada sem revisão humana: `construirPlanoSync` converte a `substitution` em duas operações no plano — `archive` (fenil antigo) + `create` (fenil atualizado). O campo `pendencias` some do plano; a RPC processa apenas `criacoes`, `arquivamentos` e o sweep.

O plano inclui campo `motivo` por operação de arquivamento: `'ausencia'` (referência ativa, ausente da origem) ou `'substituicao'` (mesma identidade `nome+marca`, fenil divergente — arquivada e substituída). A RPC propaga o `motivo` nos `detalhes` do evento `referencia_arquivada`: `{ "identidade": {...}, "motivo": "ausencia" | "substituicao" }`. O par `referencia_arquivada(motivo=substituicao)` + `referencia_criada` dentro do mesmo `sync_id` permite reconstrução completa do histórico de substituições.

### Deleção física integrada ao sync

Quando `aplicar_sync_referencias` detecta que uma global está ausente da origem (ativa no catálogo, ausente no payload ANVISA validado), verifica elegibilidade:

| Condição | Ação |
|---|---|
| Sem `registros` AND sem `referencias_favoritas` | DELETE físico |
| Com qualquer relacionamento (`registros` OR `referencias_favoritas`) | `is_ativa = false` (comportamento atual) |

A verificação é feita via SELECT antes do DELETE — as constraints de banco são respeitadas, não contornadas. Em caso de violação de FK no DELETE (race condition: `registro` criado entre o check e o DELETE), a exceção é capturada e a operação degrada para `is_ativa = false` — a sync não falha; a referência é contabilizada em `arquivadas`.

### Varrimento retroativo (sweep)

Ao final de cada execução de sync, `aplicar_sync_referencias` varre globais `is_ativa = false` sem `registros` e sem `referencias_favoritas`:

- Aplica DELETE físico para cada elegível, com **LIMIT 100 por execução** — processamento gradual do backlog ao longo das semanas seguintes
- Cobre o backlog acumulado antes desta ENH e referências arquivadas logicamente por syncs anteriores
- Contabiliza em `deletadas` (nova coluna de `referencia_syncs`)

O sweep processa gradualmente a cada sync semanal — sem necessidade de script pontual.

### FK em `referencia_eventos.referencia_id`

FK `ON DELETE SET NULL` removida. A coluna permanece nullable (`uuid`) e o UUID é preservado nos eventos mesmo após a deleção física — garantindo rastreabilidade completa no audit trail.

### Novos eventos de auditoria

Adição do valor `referencia_deletada` ao enum `sync_evento_tipo`. Registrado para cada DELETE físico no path principal e no sweep — evento único para ambos os casos; a origem (path principal vs. sweep) é implícita pelo contexto da sync.

### Admin UI

Seções de curadoria removidas (pendências, aprovar/rejeitar, diff de substituição); ação de rollback removida. Histórico de syncs mantido (status, timestamps, contagens `criadas`/`arquivadas`/`deletadas`). Mensagem de conclusão: "Sincronização concluída: X equivalentes, Y criadas, Z arquivadas, W deletadas." Restauração mantida sem alterações.

## Motivation

- **FACTUAL:** deleção física estava explicitamente em Out of Scope da FEAT-0017 ("Exclusão física de referências pela aplicação no conjunto sincronizado — draft §34; fronteira geral decidida na OQ4 do ENH-0004" `[CONFIRMED: FEAT-0017 spec]`); curadoria adicionou `referencia_sync_pendencias`, `decidir_pendencia_referencia`, `reverter_sync_referencias` e seção de UI específica; `restaurar_referencias_de_backup` já cobre o caso de uso do rollback de forma mais ampla (qualquer ponto nos 12 meses) `[CONFIRMED: BR-046, migration 20260906000000]`.
- **ASSUMPTION:** frequência e volume de divergências substantivas (substitutions) não justificam o mecanismo de curadoria para o contexto do produto; a restauração de backup é safety net suficiente; o volume de globais `is_ativa = false` sem relacionamentos é materialmente relevante para o crescimento do banco (depende de extração real — não medido).

## Evidence

- Sessão de design meuFenil014 (2026-09-18 a 2026-09-20): análise de crescimento do banco, mapeamento de FKs de `referencias`, decisões Q1–Q6, revisão de gaps, decisões de simplificação (curadoria e rollback). Arquivo de decisões: `.ai/.temp/decisions/cleanup-referencias-oqs.md` (retenção 7 dias — referência temporária).
- Sessão meuFenil015 (2026-09-22/23): gap analysis aprofundado + questionário Q1–Q12. Arquivo de decisões: `.ai/.temp/decisions/enh-0009-questionario.md` (retenção 7 dias). Decisões cobertas: substitutions auto-aplicadas (Q1/Q2), LIMIT 100 sweep (Q3/Q12), coluna `deletadas` (Q4), DROP `divergencias` (Q5), race condition EXCEPTION block (Q6), DROP `bootstrap` (Q7), script pré-deploy `pending_review→success` (Q8), mensagem de conclusão (Q9), evento único `referencia_deletada` (Q10), `motivo` em `referencia_arquivada` (Q11).
- FEAT-0017 spec (arquivada): Out of Scope para deleção física; Alternatives B4 (rollback) e curadoria (§§13–15).
- `supabase/migrations/20260906000000_referencias_sync_aplicacao_curadoria.sql` — código atual de `aplicar_sync_referencias` e `decidir_pendencia_referencia`.
- `supabase/migrations/20260905000000_referencias_sync_tabelas.sql` — schema de `referencia_sync_pendencias` e FKs.
- BR-037, BR-040, BR-043, BR-046 em `../current/domain/business-rules.md`.

## Scope

- Remoção de `referencia_sync_pendencias` (tabela + dados existentes — ver OQ1 e OQ2)
- Remoção dos tipos `sync_pendencia_tipo` e `sync_pendencia_status` (enums orfanados após drop da tabela)
- Remoção de `decidir_pendencia_referencia` (função RPC)
- Remoção de `reverter_sync_referencias` (função RPC)
- Atualização de `aplicar_sync_referencias`: substitutions auto-aplicadas; path de deleção física com degradação por race condition (`foreign_key_violation` → `is_ativa = false`); sweep LIMIT 100; campo `motivo` nos eventos de arquivamento; sem curadoria/pendências
- Atualização de `construirPlanoSync` (motor M3): conversão de `substitution` → `archive`(motivo)+`create` no plano; remoção do campo `pendencias` do schema do plano; remoção de `derivarModoSync` (distinção bootstrap/pos_bootstrap sem efeito)
- Adição do valor `referencia_deletada` ao enum `sync_evento_tipo`
- Remoção do FK `referencia_eventos.referencia_id` (coluna permanece, tipo `uuid` nullable)
- Remoção do FK `referencia_eventos.pendencia_id` (cascateado via DROP TABLE CASCADE; coluna permanece)
- DDL em `referencia_syncs`: DROP COLUMN `bootstrap`; DROP COLUMN `divergencias`; ADD COLUMN `deletadas integer`; `alteracoes` zerada para `'{}'::jsonb` (campo legado, sem leitura esperada)
- Script pré-deploy: `UPDATE referencia_syncs SET status = 'success' WHERE status = 'pending_review'` (após OQ2: todas as pendências resolvidas antes do deploy)
- Remoção da lógica de status `pending_review` e `reverted` da rota e da UI (enum values permanecem no banco como ociosos — PostgreSQL não remove valores de enum)
- Revisão de BR-037, BR-040, BR-043, BR-046; novas BRs para deleção física, sweep, substitutions e race condition
- Atualização de testes: remoção de suítes de curadoria/rollback; novas suítes para deleção física, sweep, substitutions, race condition e motivo nos eventos
- Atualização de specs afetadas (ver Impacted)
- Admin UI: remoção de componentes de curadoria e rollback; simplificação da seção de syncs

## Out of Scope

- `restaurar_referencias_de_backup`, `referencia_backups`, `referencia_snapshots` — mantidos sem alterações
- Processo de extração e validação ANVISA — mantido sem alterações
- Lógica de comparação bidirecional do motor — mantida (mas `construirPlanoSync` recebe atualização para eliminar `pendencias` e converter substitutions; ver Scope)
- Referências pessoais (`is_global = false`) — sem impacto
- Alteração de RLS das tabelas remanescentes
- Alteração de `remover_ou_desativar_referencia` (RPC de remoção manual — sem impacto)

## Impacted Features

- [FEAT-0017 — Sincronização controlada de referências](../../archive/implemented/features/FEAT-0017-sincronizacao-referencias-anvisa.md) — revisão direta: curadoria e rollback removidos; deleção física adicionada; BR-040/043/046 impactadas
- [FEAT-0012 — Painel administrativo](../current/features/FEAT-0012-painel-administrativo.md) — remoção de seções de curadoria; simplificação da seção de syncs

## Impacted Business Rules

**Revisadas:**
- **BR-037** — exceção adicionada: globais sem `registros` e sem `referencias_favoritas` são elegíveis para DELETE físico pelo processo de sync controlado
- **BR-046** — rollback seletivo removido; recuperação exclusivamente via `restaurar_referencias_de_backup`

**Revogadas:**
- **BR-040** — mudança substantiva na origem passa a gerar ação automática (sem curadoria); arquivamento + criação ocorrem sem revisão humana
- **BR-043** — curadoria removida integralmente

**Novas (numeração na promoção):**
- Global ausente da origem, sem `registros` e sem `referencias_favoritas` → DELETE físico em `aplicar_sync_referencias` (path principal); em caso de race condition (FK violation no DELETE), degrada para `is_ativa = false`
- Global `is_ativa = false`, sem `registros` e sem `referencias_favoritas` → DELETE físico no sweep ao final de cada sync (LIMIT 100 por execução)
- Global ausente da origem com qualquer relacionamento (`registros` OR `referencias_favoritas`) → `is_ativa = false`
- Divergência substantiva (mesma identidade `nome+marca`, `fenil_mg_por_100g` diferente) → auto-aplicada: archive (fenil antigo) + create (fenil atualizado); a origem é sempre fonte da verdade para `fenil_mg_por_100g`
- Evento `referencia_arquivada` inclui `detalhes.motivo`: `'ausencia'` (ausente da origem) ou `'substituicao'` (fenil divergente)
- `referencia_eventos.referencia_id` é UUID sem FK; UUID preservado após DELETE físico da referência

## Impacted Architecture

- [ADR-0010 — RPCs SECURITY DEFINER](../../decisions/ADR-0010-rpcs-security-definer.md) — atualização de `aplicar_sync_referencias`; remoção de `decidir_pendencia_referencia` e `reverter_sync_referencias`
- Avaliar ADR sobre simplificação do processo de sincronização (Origin Contemporary — não bloqueante para ACCEPTED)

## Impacted Frontend / Backend / Database / Security / Tests

- **Frontend:** `pages/admin.md` — remoção de componentes de curadoria (pendências, aprovar/rejeitar, diff); simplificação da seção de syncs (contadores criadas/arquivadas/deletadas; sem coluna de pendências)
- **Backend:** `api-referencias-sync.md` — atualização completa do pipeline pós-comparação: remoção dos estágios de curadoria/pendências e rollback; substitutions auto-aplicadas; deleção física com degradação por race condition; sweep LIMIT 100; `motivo` nos eventos de arquivamento; simplificação de `alteracoes`; remoção de `derivarModoSync`
- **Database:**
  - `referencia_sync_pendencias.md` — tabela descontinuada (ver OQ1/OQ2)
  - `referencia_eventos.md` — FKs `referencia_id` e `pendencia_id` removidas; novo valor `referencia_deletada` em `sync_evento_tipo`; campo `motivo` em `detalhes` de `referencia_arquivada`
  - `rpc.md` — remoção de `decidir_pendencia_referencia` e `reverter_sync_referencias`; atualização de `aplicar_sync_referencias` (substitutions, deleção física, sweep, motivo, race condition)
  - `referencia_syncs` — DROP COLUMN `bootstrap`, `divergencias`; ADD COLUMN `deletadas integer`; `alteracoes` = `'{}'` legado
- **Security:** sem alteração de RLS ou autorização
- **Tests:**
  - Remoção: suítes de curadoria em `rpc-referencias-sync.test.ts`; suíte de rollback `rpc-referencias-sync-rollback.test.ts` (18 testes)
  - Novas: substitutions auto-aplicadas (motivo `substituicao` no evento); arquivamento por ausência (motivo `ausencia`); DELETE físico path principal (com/sem relacionamentos); race condition FK violation → degradação; sweep LIMIT 100; UUID preservado em `referencia_eventos` após DELETE; `restaurar_referencias_de_backup` intacta após deleção física
  - Mantidas (regressão obrigatória): motor de comparação, extração/validação, backup/restore, RLS de tabelas remanescentes

## Dependencies

- [FEAT-0017](../../archive/implemented/features/FEAT-0017-sincronizacao-referencias-anvisa.md) — revisão direta da spec implementada (contexto e BRs impactadas)
- Nenhuma dependência de outras propostas ativas

## Risks

- **Deleção irreversível:** DELETE físico sem restauração de backup é permanente. Janela de recuperação: 12 meses (retenção de `referencia_backups`). Mitigação: backup criado antes de cada aplicação; eligibility check garante apenas globais sem relacionamentos de dados.
- **Mudança no comportamento de bootstrap (OQ3 da FEAT-0017 revogada):** FEAT-0017 OQ3 definiu que globais sem correspondência na 1ª extração viram divergência conhecida para curadoria manual. Com curadoria removida, o 1º sync pós-deploy aplica auto-arquivamento/deleção para qualquer global ausente da origem. O backup pré-sync é a única proteção. `[ASSUMPTION: comportamento aceito pelo usuário na sessão de design]`
- **Dados históricos de `referencia_sync_pendencias` perdidos ao dropar a tabela** — ver OQ1.
- **Pendências `open` em produção no momento do deploy** — ver OQ2.
- **Volume do sweep na 1ª execução pós-deploy:** LIMIT 100 por execução decidido — o backlog é consumido gradualmente (100 deleções/semana); sem risco de timeout. Backlog de 1.000 referências limpo em ~10 semanas.
- **Substitutions auto-aplicadas sem revisão humana:** divergências substantivas (mudança de fenil) são aplicadas automaticamente. O backup pré-sync é a única proteção contra aplicação indevida de fenil incorreto na origem. `[ASSUMPTION: risco aceito; origem é fonte da verdade]`
- **Enum values ociosos:** `sync_pendencia_tipo` e `sync_pendencia_status` são dropados com a tabela. Valores de `sync_evento_tipo` relacionados a curadoria (ex.: `pendencia_criada`, `pendencia_decidida`) ficam ociosos no enum — valores não podem ser removidos facilmente em PostgreSQL; permanecem no tipo sem uso.

## Alternatives

- **A1 — Manter curadoria, adicionar apenas deleção física:** escopo menor; curadoria permanece como proteção para divergências substantivas. **Decision:** descartada — `restaurar_referencias_de_backup` cobre o mesmo caso de uso com menos complexidade; curadoria introduz acumulação permanente de globais (`is_ativa = false`) para referências processadas por ela, que ficam imunes ao DELETE físico via FK RESTRICT.
- **A2 — Manter rollback, adicionar deleção física:** `alteracoes` registraria op `delete` com linha completa; `reverter_sync_referencias` ganharia path de INSERT para recrear. **Decision:** descartada — `restaurar_referencias_de_backup` já cobre o caso de uso de forma mais ampla (qualquer ponto nos 12 meses vs. somente a última sync); os dois mecanismos são sobrepostos.
- **A3 — Deleção física somente no path principal (sem sweep):** backlog de globais arquivadas antes da ENH permanece. **Decision:** descartada — sweep é baixo custo e endereça o problema completo (acumulação passada e futura) sem processo adicional.
- **Decision:** implementar com deleção física integrada + sweep + remoção de curadoria e rollback (conforme Proposed State). **Approved by:** Lucas Martins Menezes · **Approved on:** 2026-09-23

## Open Questions

1. **Dados existentes em `referencia_sync_pendencias`:** Dropar a tabela destrói o histórico de todas as decisões de curadoria até a data do deploy. **RESOLVIDA:** (a) aceitar a perda — dados eram operacionais e não têm utilidade num sistema sem curadoria.

2. **Pendências `open` em produção no momento do deploy:** Se existirem pendências abertas, devem ser resolvidas antes de aplicar as migrations. **RESOLVIDA:** (a) resolver manualmente (aprovar/rejeitar no painel admin) antes do deploy.

3. **`referencia_syncs.alteracoes` — histórico existente:** Linhas de syncs anteriores têm `alteracoes` no formato estruturado atual (log de operações). **RESOLVIDA:** limpar o histórico — a migration zera `alteracoes` das syncs existentes (`UPDATE referencia_syncs SET alteracoes = '{}'::jsonb`) antes de tornar o campo legado.

## Acceptance Criteria

- [ ] Substitution auto-aplicada: `referencia_arquivada` (fenil antigo, `detalhes.motivo='substituicao'`) + `referencia_criada` (fenil atualizado) dentro do mesmo `sync_id`
- [ ] Arquivamento por ausência: `referencia_arquivada` com `detalhes.motivo='ausencia'`
- [ ] Global ausente da origem, sem `registros` e sem `referencias_favoritas` → DELETE físico em `aplicar_sync_referencias`; evento `referencia_deletada` registrado
- [ ] Global ausente da origem, com qualquer relacionamento → `is_ativa = false` (comportamento preservado)
- [ ] Race condition (FK violation no DELETE): exceção capturada, referência degradada para `is_ativa = false`, sync continua sem falhar
- [ ] Sweep ao final de cada sync (LIMIT 100): globais `is_ativa = false` sem relacionamentos → DELETE físico; evento `referencia_deletada` registrado; contagem em `referencia_syncs.deletadas`
- [ ] `referencia_eventos.referencia_id` sem FK: UUID preservado em eventos de deleção física
- [ ] `restaurar_referencias_de_backup`: funcional sem alterações; referências fisicamente deletadas existentes em backup são recriadas por INSERT com UUID original
- [ ] `referencia_sync_pendencias` descontinuada conforme decisão OQ1; `decidir_pendencia_referencia` removido
- [ ] Pendências `open` tratadas conforme decisão OQ2; script pré-deploy migra syncs `pending_review` → `success`
- [ ] `reverter_sync_referencias` removido; admin UI sem ação de rollback
- [ ] `aplicar_sync_referencias` simplificado: substitutions auto-aplicadas; sem lógica de curadoria/pendências; campo `pendencias` ausente do plano
- [ ] `construirPlanoSync` atualizado: substitutions → `archive`(motivo)+`create`; sem `pendencias` no plano; `derivarModoSync` removido
- [ ] `referencia_syncs`: coluna `deletadas integer` presente; colunas `bootstrap` e `divergencias` dropadas; `alteracoes` = `'{}'` legado
- [ ] Mensagem de conclusão: "Sincronização concluída: X equivalentes, Y criadas, Z arquivadas, W deletadas."
- [ ] BR-037 atualizada com exceção do processo de sync; BR-040 e BR-043 revogadas; BR-046 revisada; novas BRs para substitutions, motivo nos eventos e race condition
- [ ] Testes de curadoria e rollback removidos; novas suítes verdes: deleção física, sweep, substitutions, race condition, motivo nos eventos
- [ ] Motor de comparação, extração/validação, backup/restore: sem regressão (testes verdes)
- [ ] Specs afetadas atualizadas no mesmo commit: `api-referencias-sync.md`, `database/rpc.md`, `database/referencia_eventos.md`, `business-rules.md`, `system-map.md`, `FEAT-0017` (referência à revisão)

## References

- [FEAT-0017 — spec arquivada](../../archive/implemented/features/FEAT-0017-sincronizacao-referencias-anvisa.md)
- [../current/backend/api-referencias-sync.md](../current/backend/api-referencias-sync.md)
- [../current/database/referencias.md](../current/database/referencias.md)
- [../current/domain/business-rules.md](../current/domain/business-rules.md) — BR-037, BR-040, BR-043, BR-046
- `supabase/migrations/20260905000000_referencias_sync_tabelas.sql`
- `supabase/migrations/20260906000000_referencias_sync_aplicacao_curadoria.sql`
- Sessão de design meuFenil014: `.ai/.temp/decisions/cleanup-referencias-oqs.md` (retenção 7 dias)
- Sessão meuFenil015 — decisões Q1–Q12: `.ai/.temp/decisions/enh-0009-questionario.md` (retenção 7 dias)
