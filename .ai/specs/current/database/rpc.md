# Funções SQL (RPC) — Schema public

**Última verificação:** 2026-09-06 (FEAT-0017 M4 — migration 20260906000000 aplicada em dev)

Inventário das **12 funções** do schema `public` no estado pós-FEAT-0017 M1/M4 em dev (2026-09-06) `[CONFIRMED: catálogo dev — pg_proc 2026-09-06]`. As funções de trigger `fn_normalizar_nome_referencia()` e `fn_remover_favoritos_referencia_inativa()` foram **eliminadas** pela ENH-0004 (normalização armazenada — A4(b); remoção de favoritos ao desativar — OQ3) — prod ainda as tem, pois segue pré-ENH-0004. O FEAT-0017 acrescentou 4 funções em dev: 2 de trigger no M1 (`fn_auditar_is_ativa_manual`, `fn_trim_referencia_backups` — seções abaixo, com semântica do trigger em [triggers.md](triggers.md)) e as 2 RPCs do M4 (`aplicar_sync_referencias`, `decidir_pendencia_referencia`). Prod mantém as **10 funções pré-ENH-0004** (com as 2 eliminadas em dev; sem as 4 do FEAT-0017) até a release `[INFERRED: migrations novas em branch de trabalho; promoção segue gate de release]`. Não há outras funções em `public` além das listadas `[CONFIRMED: catálogo dev — pg_proc 2026-09-06]`.

| Função | Tipo | SECURITY DEFINER | search_path | Versionada? |
|---|---|---|---|---|
| `ativar_referencia(uuid)` | negócio | Sim | `public` | Sim (20260811) |
| `remover_ou_desativar_referencia(uuid)` | negócio | Sim | `public` | Sim (20260811; redefinida 20260904) |
| `aplicar_sync_referencias(uuid, jsonb)` | negócio (sync) | Sim | `public` | Sim (20260906000000) |
| `decidir_pendencia_referencia(uuid, boolean, text)` | negócio (curadoria) | Sim | `public` | Sim (20260906000000) |
| `is_admin_user(uuid)` | autorização | Sim | `public` | Sim (20260810) |
| `dashboard_hoje(uuid)` | consulta | Sim | **não configurado** | Sim (baseline) |
| `dashboard_ultimos_dias(uuid, integer)` | consulta | Sim | **não configurado** | Sim (baseline) |
| `get_estatisticas_admin()` | consulta admin | Sim | `public` | Sim (baseline) |
| `handle_new_user()` | trigger | Sim | não configurado | Sim (baseline) |
| `fn_trim_background_job_executions()` | trigger | Sim | `public` | Sim (20260807) |
| `fn_auditar_is_ativa_manual()` | trigger (FEAT-0017 M1) | Sim | `public` | Sim (20260905010000) |
| `fn_trim_referencia_backups()` | trigger (FEAT-0017 M1) | Sim | `public` | Sim (20260905000000) |

Grants (fato do catálogo): as funções legadas têm EXECUTE para todas as roles (`anon`, `authenticated`, `postgres`, `service_role`); `get_estatisticas_admin` e `is_admin_user` tiveram `REVOKE ... FROM PUBLIC`, mas mantêm grants explícitos (inclusive `anon` via default privileges). As RPCs do FEAT-0017 M4 têm EXECUTE **seletivo**: `aplicar_sync_referencias` → somente `service_role`; `decidir_pendencia_referencia` → somente `authenticated` (a guarda interna `is_admin_user` decide; service_role fora — curadoria é ação humana de admin com sessão) `[CONFIRMED: database — role_routine_grants; migration 20260906000000]`.

---

## public.ativar_referencia

**Última verificação:** 2026-09-06 (FEAT-0017 M1 — migration 20260905020000 aplicada em dev)
**Definição em:** original `20260811210456_fix_security_rls_rpc.sql` (linhas 24–56); **redefinida** pela migration FEAT-0017 `20260905020000_referencias_ativar_global_somente_admin.sql` (R4-3) — aplicada em dev em 2026-09-06; prod segue com a versão 20260811 até a release `[CONFIRMED: migration, database]`

- **Assinatura:** `ativar_referencia(p_referencia_id uuid) RETURNS text` — plpgsql
- **SECURITY DEFINER?** Sim — `SET search_path TO 'public'`
- **Autorização implementada (pós-FEAT-0017 M1/R4-3):** referências GLOBAIS (`is_global = true`) só reativam por admin — senão `RAISE EXCEPTION 'Permissão negada: apenas administradores podem reativar referências globais'` (alinhamento BR-024/BR-037 — a versão 20260811 permitia dono/delegado reativar global pelo branch de pessoal); PESSOAIS: o UPDATE só ocorre se o chamador for dono (`criado_por = auth.uid()`), delegado ativo do dono (via `delegacoes_acesso`, com `revoked_at IS NULL`) ou admin (`is_admin_user`). Se a condição não for atendida: `RAISE EXCEPTION 'Referência não encontrada ou permissão negada'` — mesma mensagem para inexistente ou sem permissão
- **Efeitos:** `UPDATE referencias SET is_ativa = true, updated_at = now()`; retorna `'activated'`
- **Erros e edge cases:** exceção quando a referência não existe ou o chamador não tem permissão
- **Chamadores no código:** `src/react-app/services/referencias.service.ts:246` (`activateReferencia`, envolto em `AppError REFERENCIA_ACTIVATE_ERROR`) `[CONFIRMED: code]`
- **Testes:** `src/shared/security/rpc-ativar-referencia.test.ts` (cenários: dono, delegado, admin, não autorizado; T2.6–T2.10 — FEAT-0017 M1: dono/delegado NÃO reativam global, admin reativa, auditoria `is_ativa_manual` do trigger — condicionados a `isFeat0017M1Applied`) `[CONFIRMED: test]`
- **Evidências:** E1 — definição no banco = migration `[CONFIRMED: database, migration]`

## public.remover_ou_desativar_referencia

**Última verificação:** 2026-09-04 (ENH-0004 — migration 20260904000000 aplicada em dev)
**Definição em:** original `20260811210456_fix_security_rls_rpc.sql` (linhas 64–126); **redefinida** pela migration ENH-0004 `20260904000000_referencias_marca_identidade_imutavel.sql` (linhas 96–164) — aplicada em dev em 2026-09-04; prod segue com a versão 20260811 até a release `[CONFIRMED: migration, database]`

- **Assinatura:** `remover_ou_desativar_referencia(p_referencia_id uuid) RETURNS text` — plpgsql
- **SECURITY DEFINER?** Sim — `SET search_path TO 'public'`
- **Autorização implementada:** (1) referência deve existir — senão `'Referência não encontrada'`; (2) dono OU delegado ativo OU admin — senão `'Permissão negada: você não pode remover esta referência'`; (3) referência global exige admin — senão `'Permissão negada: apenas administradores podem remover referências globais'` (passos inalterados pela ENH-0004)
- **Efeitos (pós-ENH-0004, OQ4):** GLOBAIS (`is_global = true`): **SEMPRE arquivamento** (`is_ativa = false`, `updated_at = now()`, retorna `'deactivated'`) — inclusive sem registros vinculados; nunca DELETE físico pela aplicação (BR-037). PESSOAIS: verifica vínculo com `registros`; SE há registros vinculados → soft delete (retorna `'deactivated'`); SENÃO → DELETE físico (retorna `'deleted'`) (fluxo atual preservado — BR-018/BR-026)
- **Erros e edge cases:** as três mensagens de exceção acima; mensagem única para "não encontrada × sem permissão" no passo 2 (diferente do `ativar_referencia`)
- **Chamadores no código:** `src/react-app/services/referencias.service.ts:323-338` (`deleteOrDeactivateReferencia`, envolto em `AppError REFERENCIA_DELETE_OR_DEACTIVATE_ERROR`); retorno `'deleted' | 'deactivated'` consumido por `useReferencias` (remove/deactivate) e pela página Referências `[CONFIRMED: code]`
- **Testes:** `src/shared/security/rpc-remover-referencia.test.ts` (dono, delegado, admin, não autorizado, soft-delete, hard-delete; T3.7 — ENH-0004: remoção de GLOBAL por admin retorna `'deactivated'` e a linha permanece com `is_ativa = false`, condicionado ao helper `isEnh0004MigrationApplied`) `[CONFIRMED: test]`
- **Evidências:** E1 — definição no banco dev = migration 20260904000000 (linhas 96–164) `[CONFIRMED: database, migration]`

## public.aplicar_sync_referencias

**Última verificação:** 2026-09-06 (FEAT-0017 M4 — migration 20260906000000 aplicada em dev)
**Definição em:** `20260906000000_referencias_sync_aplicacao_curadoria.sql` (linhas 33–207; REVOKE/GRANT nas linhas 459–460) — prod segue sem as RPCs de sync até a release `[CONFIRMED: migration, database]`

- **Assinatura:** `aplicar_sync_referencias(p_sync_id uuid, p_plano jsonb) RETURNS jsonb` — plpgsql
- **SECURITY DEFINER?** Sim — `SET search_path TO 'public'`
- **Autorização implementada (FEAT-0017 §7.5):** EXECUTE exclusivo `service_role` (REVOKE de PUBLIC); guarda interna `auth.role() <> 'service_role'` → `RAISE EXCEPTION 'Permissão negada: apenas service_role pode aplicar o plano de sync'` (segunda barreira a desvios de definer). Nenhum papel de cliente (anon/authenticated) pode aplicar plano — nem admin: aplicação é sempre automática (rota/scripts)
- **Pré-condições e validação:** plano presente com `versao = '1'` (contrato com o motor M3 — senão `'Plano de sync ausente ou sem versão'` / `'Versão de plano não suportada (esperada 1, recebida %)'`); sync deve existir (`'Sync não encontrada: %'`) e estar `running` (`'Sync não está em execução (status = %)'` — a rota finaliza o status no estágio 8)
- **Efeitos (statement atômico via postgREST — qualquer exceção desfaz tudo):** (1) ator Sistema (`sistema@meufenil.local` em `usuarios`) resolvido **somente se o plano cria linhas** (fail-high: ausente → `'Ator Sistema não provisionado … execute scripts/provisionar-ator-sistema.js'`); (2) `criacoes[]` (`op='create'`, identidade `nome`/`marca`/`fenil_mg_por_100g`) → INSERT em `referencias` com todas as colunas explícitas (`is_global = true`, `is_ativa = true`, `criado_por` = Sistema; outras ops → `'Operação desconhecida no plano: %'`); (3) `arquivamentos[]` (`op='archive'`, `referencia_id`) → `UPDATE ... SET is_ativa = false WHERE id AND is_ativa` com RETURNING — 0 linhas → `'Estado mudou durante a sync: referência % não encontrada ou já inativa'`; (4) `pendencias[]` → INSERT `open` em `referencia_sync_pendencias` (1:1 do plano); (5) eventos `referencia_criada`/`referencia_arquivada` (actor = Sistema; uid null sob service_role — **não** gera `is_ativa_manual`); (6) UPDATE da sync: `equivalentes` do resumo do plano (matching é do motor — não rederivável em SQL), `criadas`/`arquivadas`/`divergencias` contados das ops/pendências realmente aplicadas, `alteracoes` = `[{op, referencia_id, antes, depois}]` (shape do rollback M5). Nunca reativa, nunca DELETE, nunca decide divergência
- **Erros e edge cases:** estado mudou entre comparação e aplicação — identidade já ativa → `23505` (errcode explícito) `'Estado mudou durante a sync: identidade já ativa (%)'` → ROLLBACK total; op desconhecida; sync não-running; plano inválido. Retorna resumo `{sync_id, equivalentes, criadas, arquivadas, divergencias}` — base da decisão de status da rota (estágio 8: `divergencias > 0` → `pending_review`)
- **Chamadores no código:** `api/referencias-sync.ts` estágio 7 (`supabase.rpc("aplicar_sync_referencias", { p_sync_id, p_plano })` — service role) `[CONFIRMED: code]`
- **Testes:** `src/shared/security/rpc-referencias-sync.test.ts` (REAL, Abordagem B — guard `isFeat0017M4Applied`): plano manual e via `construirPlanoSync` real; linha criada com `criado_por` = Sistema; arquivamento; pendências `open`; eventos com actor Sistema e sem `is_ativa_manual`; contadores/`alteracoes`; negativos: versão ausente/desconhecida, sync inexistente/não-running, op desconhecida, arquivamento de inativa e `23505` com ROLLBACK total (criação e pendências desfeitas); authenticated (admin) chamando aplicar → permissão negada `[CONFIRMED: test]`
- **Evidências:** E1 — definição no banco dev = migration 20260906000000 `[CONFIRMED: database, migration]`

## public.decidir_pendencia_referencia

**Última verificação:** 2026-09-06 (FEAT-0017 M4 — migration 20260906000000 aplicada em dev)
**Definição em:** `20260906000000_referencias_sync_aplicacao_curadoria.sql` (linhas 226–450; REVOKE/GRANT nas linhas 462–463) — prod segue sem as RPCs de sync até a release `[CONFIRMED: migration, database]`

- **Assinatura:** `decidir_pendencia_referencia(p_pendencia_id uuid, p_aprovar boolean, p_motivo text DEFAULT null) RETURNS jsonb` — plpgsql
- **SECURITY DEFINER?** Sim — `SET search_path TO 'public'`
- **Autorização implementada (FEAT-0017 §8):** EXECUTE para `authenticated` (REVOKE de PUBLIC); guarda interna `NOT is_admin_user(auth.uid())` → `RAISE EXCEPTION 'Permissão negada: apenas administradores podem decidir pendências'`. **service_role fora** — curadoria é ação humana de admin com sessão (testado)
- **Efeitos:** pendência alvo com `SELECT ... FOR UPDATE`; inexistente → `'PENDENCIA_NAO_ENCONTRADA: pendência inexistente'`; terminal (`approved`/`rejected`/`cancelled`) nunca recebe nova decisão → `'PENDENCIA_NAO_ENCONTRADA: pendência não está aberta para decisão (status = %)'`; sync da pendência ainda `running` → `'Sync ainda em execução — aguarde a conclusão antes de decidir'`. **Rejeitar** (`p_aprovar = false`): motivo obrigatório (btrim não-vazio — `'Rejeição exige motivo (p_motivo)'`; CHECK do M1 reforçado), nenhuma alteração de dados, evento `mudanca_rejeitada` (detalhes: tipo + motivo), divergência vira conhecida. **Aprovar** por tipo (transação única): `absence` arquiva a atual (guarda `is_ativa` + RETURNING — 0 linhas → `'Estado mudou: referência % não encontrada ou já inativa'`); `new_item` cria a proposta; `substitution` arquiva a atual e cria a proposta — `criado_por` = Sistema (fail-high como no aplicar), INSERT captura `23505` → `'Estado mudou: identidade da proposta já está ativa (%)'` (ROLLBACK total). GUC local `app.audit_origin='curadoria'` (D-7/§11.3) suprime o trigger `trg_auditar_is_ativa_manual` no arquivamento — o evento específico da decisão já é registrado. Eventos com actor = admin que decidiu: `mudanca_aprovada` (detalhes: tipo + diff + motivo se houver) + `referencia_arquivada`/`referencia_criada`. Contadores da sync incrementados relativamente (`criadas`/`arquivadas`) e `alteracoes` anexada. **Última pendência `open` da sync decidida → `UPDATE status='success'`** com `message = 'Curadoria concluída — todas as pendências foram decididas'` (WHERE status='pending_review'; rejeitadas são divergências conhecidas — §6.1/§15). Retorna `{pendencia_id, status, sync_id, sync_status}`
- **Erros e edge cases:** todos os acima; tipo desconhecido → `'Tipo de pendência desconhecido: %'`; absence/substitution sem `referencia_id` → `'Pendência % sem referência alvo para arquivar'`; new_item/substitution sem proposta → `'Pendência % sem proposta válida para criar'`
- **Chamadores no código:** nenhum ainda — a UI de curadoria chega no M6 (o frontend chamará `.rpc("decidir_pendencia_referencia", ...)` com sessão de admin) `[CONFIRMED: code — ausência de chamador; infraestrutura e testes prontos no M4]`
- **Testes:** `src/shared/security/rpc-referencias-sync.test.ts` (REAL, Abordagem B): aprovar `new_item` → cria (criado_por Sistema) + sync `success`; aprovar `absence` → arquiva **sem** `is_ativa_manual` (GUC D-7); aprovar `substitution` → arquiva + cria (2 `alteracoes`); rejeitar sem motivo → exceção e permanece `open`; rejeitar com motivo → btrim, `decided_by` = admin, `mudanca_rejeitada`, nada alterado; terminal não aceita nova decisão; sync running → exceção; pendência inexistente; service_role → permissão negada; última aberta decidida (mesmo rejeitada) → sync `success` com a message de conclusão `[CONFIRMED: test]`
- **Evidências:** E1 — definição no banco dev = migration 20260906000000 `[CONFIRMED: database, migration]`

## public.is_admin_user

**Última verificação:** 2026-08-13 (commit 6323664)
**Definição em:** `20260810000000_background_job_monitoring.sql` (linhas 1–14) — idêntica no banco `[CONFIRMED: migration, database]`

- **Assinatura:** `is_admin_user(p_user_id uuid) RETURNS boolean` — sql, `STABLE`
- **SECURITY DEFINER?** Sim — `SET search_path TO 'public'`
- **Autorização implementada:** nenhuma verificação interna — retorna `EXISTS (usuarios WHERE id = p_user_id AND role = 'admin')`
- **Efeitos:** somente leitura
- **Erros e edge cases:** não aplicável
- **Chamadores no código:** não chamada diretamente pela aplicação; usada no BANCO pelas políticas `admin_can_select_all_usuarios` (usuarios), `admin_can_select_background_job_executions` (background_job_executions) e pelos RPCs `ativar_referencia` / `remover_ou_desativar_referencia` `[CONFIRMED: database, migration]`
- **Testes:** coberta indiretamente pelos testes de RLS e RPCs de segurança `[CONFIRMED: test]`
- **Evidências:** E1 — definição no banco = migration `[CONFIRMED: database, migration]`

## public.dashboard_hoje

**Última verificação:** 2026-08-13 (commit 6323664)
**Definição em:** baseline `20260103015052_remote_schema.sql` (linhas 55–68) `[CONFIRMED: migration, database]`

- **Assinatura:** `dashboard_hoje(uid uuid) RETURNS TABLE(total numeric, limite numeric, data date)` — sql
- **SECURITY DEFINER?** Sim — `search_path` NÃO configurado (proconfig vazio) `[CONFIRMED: database]`
- **Autorização implementada:** nenhuma verificação visível — retorna dados de qualquer `uid` informado
- **Efeitos:** soma `registros.fenil_mg` do dia (`current_date`) do usuário + `usuarios.limite_diario_mg`
- **Erros e edge cases:** não aplicável
- **Chamadores no código:** NENHUM — `grep` em `src/`, `api/` e `supabase/functions/` não encontra referências (2026-08-13); o dashboard atual consulta via `dashboard.service` diretamente `[CONFIRMED: ausência — code]`
- **Testes:** nenhum teste direto identificado `[CONFIRMED: ausência]`
- **Evidências:** E1 — definição no banco = baseline `[CONFIRMED: database, migration]`

## public.dashboard_ultimos_dias

**Última verificação:** 2026-08-13 (commit 6323664)
**Definição em:** baseline `20260103015052_remote_schema.sql` (linhas 74–85) `[CONFIRMED: migration, database]`

- **Assinatura:** `dashboard_ultimos_dias(uid uuid, dias integer) RETURNS TABLE(data date, total numeric)` — sql
- **SECURITY DEFINER?** Sim — `search_path` NÃO configurado (proconfig vazio) `[CONFIRMED: database]`
- **Autorização implementada:** nenhuma verificação visível — retorna dados de qualquer `uid` informado
- **Efeitos:** soma `registros.fenil_mg` por dia dos últimos `dias` dias (janela `data >= current_date - dias`), ordenada por data
- **Erros e edge cases:** não aplicável
- **Chamadores no código:** NENHUM — `grep` em `src/`, `api/` e `supabase/functions/` não encontra referências (2026-08-13) `[CONFIRMED: ausência — code]`
- **Testes:** nenhum teste direto identificado `[CONFIRMED: ausência]`
- **Evidências:** E1 — definição no banco = baseline `[CONFIRMED: database, migration]`

## public.get_estatisticas_admin

**Última verificação:** 2026-08-13 (commit 6323664)
**Definição em:** baseline `20260103015052_remote_schema.sql` (linhas 104–114) `[CONFIRMED: migration, database]`

- **Assinatura:** `get_estatisticas_admin() RETURNS TABLE(tamanho_db_mb integer, registros_totais bigint, referencias_total bigint, referencias_globais bigint, referencias_personalizadas bigint)` — sql
- **SECURITY DEFINER?** Sim — `SET search_path TO 'public'`
- **Autorização implementada:** nenhuma verificação interna; grants: `REVOKE ALL FROM PUBLIC` + EXECUTE para `anon`, `authenticated`, `service_role` (baseline) — no catálogo atual, `anon` também possui EXECUTE `[CONFIRMED: migration, database]`
- **Efeitos:** tamanho do banco (MB) e contagens de `registros` e `referencias` (total, globais, personalizadas)
- **Erros e edge cases:** não aplicável
- **Chamadores no código:** `src/react-app/services/admin.service.ts:75` (`.rpc("get_estatisticas_admin")` — painel administrativo) `[CONFIRMED: code]`
- **Testes:** `src/react-app/services/admin.service.test.ts` cobre o serviço `[CONFIRMED: test]`
- **Evidências:** E1 — definição no banco = baseline `[CONFIRMED: database, migration]`

## public.handle_new_user

**Última verificação:** 2026-08-15 (DEBT-0002 — migration 20260815000000)
**Definição em:** baseline `20260103015052_remote_schema.sql` (linhas 120–148, original com 150) + migration `20260815000000_limite_diario_default_500.sql` (DEBT-0002 — corpo atual) `[CONFIRMED: migration, database]`

- **Assinatura:** `handle_new_user() RETURNS trigger` — plpgsql
- **SECURITY DEFINER?** Sim — `search_path` não configurado
- **Autorização implementada:** função de trigger — executa no evento de criação em `auth.users`
- **Efeitos:** INSERT em `usuarios` com `id = new.id`, `nome = coalesce(raw_user_meta_data->>'full_name', email)`, `email = new.email`, `role = 'user'`, `timezone = 'America/Sao_Paulo'`, `limite_diario_mg` não definido (default da coluna = 500), timestamps `now()`; `on conflict (id) do nothing`
- **Erros e edge cases:** conflito de id é ignorado (`do nothing`)
- **Chamadores no código:** trigger `on_auth_user_created` em `auth.users` (ver [triggers.md](triggers.md))
- **Testes:** nenhum teste direto identificado `[CONFIRMED: ausência]`
- **Evidências:** E1 — definição no banco = baseline + 20260815000000 `[CONFIRMED: database, migration]`

## public.fn_trim_background_job_executions

**Última verificação:** 2026-08-13 (commit 6323664)
**Definição em:** `20260807000000_background_job_executions.sql` (linhas 35–47) `[CONFIRMED: migration, database]`

- **Assinatura:** `fn_trim_background_job_executions() RETURNS trigger` — plpgsql
- **SECURITY DEFINER?** Sim — `SET search_path TO 'public'`
- **Autorização implementada:** não aplicável (trigger)
- **Efeitos:** DELETE de `background_job_executions` com `created_at < now() - interval '365 days'`; retorna `null` (AFTER STATEMENT)
- **Erros e edge cases:** não aplicável
- **Chamadores no código:** trigger `trg_trim_background_job_executions` (ver [triggers.md](triggers.md))
- **Testes:** nenhum teste direto do trigger identificado `[CONFIRMED: ausência]`
- **Evidências:** E1 — definição no banco = migration `[CONFIRMED: database, migration]`

## public.fn_auditar_is_ativa_manual

**Última verificação:** 2026-09-06 (FEAT-0017 M1 — migration 20260905010000 aplicada em dev)
**Definição em:** `20260905010000_referencias_sync_auditoria_is_ativa.sql` (linhas 25–43) `[CONFIRMED: migration, database]`

- **Assinatura:** `fn_auditar_is_ativa_manual() RETURNS trigger` — plpgsql
- **SECURITY DEFINER?** Sim — `search_path` = `public`
- **Autorização implementada:** não aplicável (trigger) — o WHEN do trigger (`auth.uid() is not null`) já exclui sessões sem usuário (service_role/roteiro/migração); a função registra somente quando `is_admin_user(auth.uid())` E o GUC `app.audit_origin` ≠ `'curadoria'` (D-7)
- **Efeitos:** INSERT em `referencia_eventos` com `tipo = 'is_ativa_manual'`, `actor_id = auth.uid()` e `detalhes = {de, para}` — auditoria da mudança MANUAL de `is_ativa` via RPCs com sessão (`ativar_referencia`/`remover_ou_desativar_referencia`); retorna o registro (AFTER ROW)
- **Erros e edge cases:** escritas automáticas de sync não geram o evento — M4: `aplicar_sync_referencias` (uid null → WHEN) e `decidir_pendencia_referencia` (GUC local `'curadoria'`); rollback/restauração do M5 idem
- **Chamadores no código:** trigger `trg_auditar_is_ativa_manual` em `referencias` — semântica do trigger em [triggers.md](triggers.md) §trg_auditar_is_ativa_manual
- **Testes:** suíte REAL `src/shared/security/rpc-referencias-sync.test.ts` — decidir aprovar `absence` não gera `is_ativa_manual` `[CONFIRMED: test]`
- **Evidências:** E1 — definição no banco = migration `[CONFIRMED: database, migration]`

## public.fn_trim_referencia_backups

**Última verificação:** 2026-09-06 (FEAT-0017 M1 — migration 20260905000000 aplicada em dev)
**Definição em:** `20260905000000_referencias_sync_tabelas.sql` (linha 260; trigger na 276) `[CONFIRMED: migration, database]`

- **Assinatura:** `fn_trim_referencia_backups() RETURNS trigger` — plpgsql
- **SECURITY DEFINER?** Sim — `search_path` = `public`
- **Autorização implementada:** não aplicável (trigger)
- **Efeitos:** DELETE de `referencia_backups` com `created_at < now() - interval '12 months'` (retenção própria da tabela — B3/D-3); retorna `null` (AFTER STATEMENT)
- **Erros e edge cases:** não aplicável
- **Chamadores no código:** trigger `trg_trim_referencia_backups` em `referencia_backups` — semântica do trigger em [triggers.md](triggers.md) §trg_trim_referencia_backups
- **Testes:** nenhum teste direto do trigger identificado `[CONFIRMED: ausência]`
- **Evidências:** E1 — definição no banco = migration `[CONFIRMED: database, migration]`

---

## Funções eliminadas pela ENH-0004 (20260904000000, aplicada em dev 2026-09-04)

- **`fn_normalizar_nome_referencia()`** (trigger, SECURITY INVOKER — baseline linhas 91–98): preenchia `nome_normalizado` com `lower(trim(nome))` antes de INSERT/UPDATE em `referencias`. Eliminada junto com o trigger `trg_normalizar_nome_referencia` e a coluna `nome_normalizado` (A4(b) — normalização runtime é escopo do FEAT-0017; unicidade agora usa expressões no índice `referencias_identidade_ativa_unique`). Histórico: [triggers.md](triggers.md).
- **`fn_remover_favoritos_referencia_inativa()`** (trigger, SECURITY INVOKER — versionada na 20260814000000, DEBT-0001): removia os favoritos da referência ao desativá-la. Eliminada junto com o trigger `trg_remover_favoritos_referencia_inativa` (OQ3 — desativação preserva favoritos em qualquer fluxo, BR-036).

`[CONFIRMED: migration 20260904000000 — linhas 26–27 (DROP trigger/função de normalização) e 87–88 (DROP trigger/função de favoritos)]`

---

## Evidências (documento)

- E1 — Inventário e definições das funções: `pg_proc` + `pg_get_functiondef` nos bancos dev e prod (2026-08-13 — 10 funções, estado pré-ENH-0004; dev pós-ENH-0004, 2026-09-04 — 8 funções; dev pós-FEAT-0017 M1/M4, 2026-09-06 — 12 funções em `public`) `[CONFIRMED: database, migration]`
- E2 — Definições versionadas: migrations baseline, 20260807, 20260810, 20260811, 20260904000000 (redefinição de `remover_ou_desativar_referencia`; DROPs das funções de trigger), 20260905000000/20260905010000 (funções de trigger do M1), 20260906000000 (`aplicar_sync_referencias`; `decidir_pendencia_referencia`) `[CONFIRMED: migration]`
- E3 — Chamadores: `grep` de `.rpc(` em `src/`, `api/`, `supabase/functions/` (2026-08-13 — 3 chamadas legadas; 2026-09-06 — +1: `aplicar_sync_referencias` em `api/referencias-sync.ts` estágio 7; `decidir_pendencia_referencia` sem chamador no código — UI chega no M6) `[CONFIRMED: code]`

## Veja também

- [triggers.md](triggers.md), [referencias.md](referencias.md), [usuarios.md](usuarios.md), [background_job_executions.md](background_job_executions.md)
- `../security/security-model.md` (Fase 3)
