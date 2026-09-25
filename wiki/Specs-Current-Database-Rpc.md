# Funções SQL (RPC) — Schema public

**Última verificação:** 2026-09-24 (ENH-0009 — migrations 20260923000000 — `decidir_pendencia_referencia` e `reverter_sync_referencias` eliminadas; `aplicar_sync_referencias` reescrita; `restaurar_referencias_de_backup` reescrita; total: 13 funções. Antes: 2026-09-11 — FEAT-0017 M4/M5 — migrations 20260906000000/20260906010000 aplicadas em dev e prod — release v1.11.0)

Inventário das **13 funções** do schema `public` no estado pós-ENH-0009 (migration 20260923000000, dev 2026-09-24) `[CONFIRMED: migration 20260923000000]`. As funções de trigger `fn_normalizar_nome_referencia()` e `fn_remover_favoritos_referencia_inativa()` foram **eliminadas** pela ENH-0004. O FEAT-0017 acrescentou 7 funções em dev (M1–M5); a ENH-0009 **eliminou 2**: `decidir_pendencia_referencia` (curadoria — ver seção Funções eliminadas) e `reverter_sync_referencias` (rollback seletivo — ver seção Funções eliminadas), **reescreveu** `aplicar_sync_referencias` (deleção física + sweep + sem pendências) e `restaurar_referencias_de_backup` (pendencias_canceladas=0, tabela pendências dropped). Prod: estado pós-release v1.11.0 (15 funções); ENH-0009 ainda não aplicado em prod `[CONFIRMED: database — catálogo prod 2026-09-11; migration 20260923000000]`.

| Função | Tipo | SECURITY DEFINER | search_path | Versionada? |
|---|---|---|---|---|
| `ativar_referencia(uuid)` | negócio | Sim | `public` | Sim (20260811) |
| `remover_ou_desativar_referencia(uuid)` | negócio | Sim | `public` | Sim (20260811; redefinida 20260904) |
| `aplicar_sync_referencias(uuid, jsonb)` | negócio (sync) | Sim | `public` | Sim (20260906000000; reescrita 20260923000000) |
| ~~`decidir_pendencia_referencia(uuid, boolean, text)`~~ | ~~negócio (curadoria)~~ | — | — | Eliminada (20260923000000) |
| ~~`reverter_sync_referencias(uuid)`~~ | ~~negócio (sync — recuperação)~~ | — | — | Eliminada (20260923000000) |
| `restaurar_referencias_de_backup(uuid)` | negócio (sync — recuperação) | Sim | `public` | Sim (20260906010000; reescrita 20260923000000) |
| `pode_operar_recuperacao(uuid)` | autorização | Sim | `public` | Sim (20260906010000) |
| `is_admin_user(uuid)` | autorização | Sim | `public` | Sim (20260810) |
| `dashboard_hoje(uuid)` | consulta | Sim | **não configurado** | Sim (baseline) |
| `dashboard_ultimos_dias(uuid, integer)` | consulta | Sim | **não configurado** | Sim (baseline) |
| `get_estatisticas_admin()` | consulta admin | Sim | `public` | Sim (baseline) |
| `handle_new_user()` | trigger | Sim | não configurado | Sim (baseline) |
| `fn_trim_background_job_executions()` | trigger | Sim | `public` | Sim (20260807) |
| `fn_auditar_is_ativa_manual()` | trigger (FEAT-0017 M1) | Sim | `public` | Sim (20260905010000) |
| `fn_trim_referencia_backups()` | trigger (FEAT-0017 M1) | Sim | `public` | Sim (20260905000000) |

Grants (fato do catálogo): as funções legadas têm EXECUTE para todas as roles (`anon`, `authenticated`, `postgres`, `service_role`; `ativar_referencia`/`remover_ou_desativar_referencia` inclusive via PUBLIC); `get_estatisticas_admin` e `is_admin_user` tiveram `REVOKE ... FROM PUBLIC`, mas mantêm grants explícitos. **Correção de drift (2026-09-11):** as RPCs do FEAT-0017 (`aplicar_sync_referencias`, `decidir_pendencia_referencia`, `reverter_sync_referencias`, `restaurar_referencias_de_backup` e o helper `pode_operar_recuperacao`) têm EXECUTE **nominal para `anon`, `authenticated`, `postgres` e `service_role`** (sem PUBLIC) — o `ALTER DEFAULT PRIVILEGES` do Supabase concede EXECUTE às roles em funções novas e o `REVOKE ... FROM PUBLIC` das migrations **não remove** grants nominais. A restrição efetiva de chamada é a **guarda interna** de cada função, não a ACL: `aplicar_sync_referencias` exige `auth.role() = 'service_role'`; `decidir_pendencia_referencia` exige admin (`is_admin_user`); as de recuperação exigem `pode_operar_recuperacao(auth.uid())` `[CONFIRMED: database — role_routine_grants dev e prod 2026-09-11; migration 20260906000000/20260906010000]`.

---

## public.ativar_referencia

**Última verificação:** 2026-09-06 (FEAT-0017 M1 — migration 20260905020000 aplicada em dev)
**Definição em:** original `20260811210456_fix_security_rls_rpc.sql` (linhas 24–56); **redefinida** pela migration FEAT-0017 `20260905020000_referencias_ativar_global_somente_admin.sql` (R4-3) — aplicada em dev em 2026-09-06 e em prod na release v1.11.0 (2026-09-10) `[CONFIRMED: migration, database]`

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
**Definição em:** original `20260811210456_fix_security_rls_rpc.sql` (linhas 64–126); **redefinida** pela migration ENH-0004 `20260904000000_referencias_marca_identidade_imutavel.sql` (linhas 96–164) — aplicada em dev em 2026-09-04 e em prod na release v1.11.0 (2026-09-10) `[CONFIRMED: migration, database]`

- **Assinatura:** `remover_ou_desativar_referencia(p_referencia_id uuid) RETURNS text` — plpgsql
- **SECURITY DEFINER?** Sim — `SET search_path TO 'public'`
- **Autorização implementada:** (1) referência deve existir — senão `'Referência não encontrada'`; (2) dono OU delegado ativo OU admin — senão `'Permissão negada: você não pode remover esta referência'`; (3) referência global exige admin — senão `'Permissão negada: apenas administradores podem remover referências globais'` (passos inalterados pela ENH-0004)
- **Efeitos (pós-ENH-0004, OQ4):** GLOBAIS (`is_global = true`): **SEMPRE arquivamento** (`is_ativa = false`, `updated_at = now()`, retorna `'deactivated'`) — inclusive sem registros vinculados; nunca DELETE físico pela aplicação (BR-037). PESSOAIS: verifica vínculo com `registros`; SE há registros vinculados → soft delete (retorna `'deactivated'`); SENÃO → DELETE físico (retorna `'deleted'`) (fluxo atual preservado — BR-018/BR-026)
- **Erros e edge cases:** as três mensagens de exceção acima; mensagem única para "não encontrada × sem permissão" no passo 2 (diferente do `ativar_referencia`)
- **Chamadores no código:** `src/react-app/services/referencias.service.ts:323-338` (`deleteOrDeactivateReferencia`, envolto em `AppError REFERENCIA_DELETE_OR_DEACTIVATE_ERROR`); retorno `'deleted' | 'deactivated'` consumido por `useReferencias` (remove/deactivate) e pela página Referências `[CONFIRMED: code]`
- **Testes:** `src/shared/security/rpc-remover-referencia.test.ts` (dono, delegado, admin, não autorizado, soft-delete, hard-delete; T3.7 — ENH-0004: remoção de GLOBAL por admin retorna `'deactivated'` e a linha permanece com `is_ativa = false`, condicionado ao helper `isEnh0004MigrationApplied`) `[CONFIRMED: test]`
- **Evidências:** E1 — definição no banco dev = migration 20260904000000 (linhas 96–164) `[CONFIRMED: database, migration]`

## public.aplicar_sync_referencias

**Última verificação:** 2026-09-24 (ENH-0009 — migration 20260923000000 reescreveu a função)
**Definição em:** `20260906000000_referencias_sync_aplicacao_curadoria.sql` (FEAT-0017 M4, original); **reescrita** por `20260923000000_enh_0009_delecao_fisica_sync_simplificacao.sql` (ENH-0009) `[CONFIRMED: migration]`

- **Assinatura:** `aplicar_sync_referencias(p_sync_id uuid, p_plano jsonb) RETURNS jsonb` — plpgsql
- **SECURITY DEFINER?** Sim — `SET search_path TO 'public'`
- **Autorização implementada:** guarda interna `auth.role() <> 'service_role'` → `RAISE EXCEPTION 'Permissão negada: apenas service_role pode aplicar o plano de sync'`. ACL: default privileges Supabase concedem EXECUTE nominal a anon/authenticated/service_role — proteção efetiva é a guarda interna
- **Pré-condições e validação:** plano presente com `versao = '1'` (senão `'Plano de sync ausente ou sem versão'` / `'Versão de plano não suportada (esperada 1, recebida %)'`); sync deve existir (`'Sync não encontrada: %'`) e estar `running` (`'Sync não está em execução (status = %)'`)
- **Efeitos ENH-0009 (transação única — qualquer exceção desfaz tudo):** (1) ator Sistema resolvido somente se o plano cria linhas (fail-high); (2) `criacoes[]` (`op='create'`) → INSERT em `referencias` (`is_global=true`, `is_ativa=true`, `criado_por`=Sistema); (3) `arquivamentos[]` (`op='archive'`, `referencia_id`, `motivo:"ausencia"|"substituicao"`) → tentativa de **DELETE físico** (ausência: sem relacionamentos; substituição: sempre soft-archive) com fallback `UPDATE is_ativa=false` em caso de FK violation; evento `referencia_deletada` (deleção bem-sucedida) ou `referencia_arquivada` (arquivamento); (4) sweep retroativo: DELETE de até 100 globais `is_ativa=false` sem relacionamentos por execução (globais antigas que nunca foram delecionadas em syncs anteriores); (5) UPDATE da sync: `equivalentes`, `criadas`, `arquivadas`, `deletadas`. `alteracoes` sempre `[]` (rollback removido). Nunca reativa; nunca decide pendências (removidas)
- **Erros e edge cases:** identidade já ativa → `23505` `'Estado mudou durante a sync: identidade já ativa (%)'` → ROLLBACK total; arquivamento de inativa → `'Estado mudou durante a sync: referência % não encontrada ou já inativa'` → ROLLBACK total; op desconhecida → `'Operação desconhecida no plano: %'`; sync não-running; plano inválido. Retorna `{sync_id, equivalentes, criadas, arquivadas, deletadas}` — a rota sempre conclui `success` (sem `divergencias`)
- **Chamadores no código:** `api/referencias-sync.ts` estágio 7 (service role) `[CONFIRMED: code]`
- **Testes:** `src/shared/security/rpc-referencias-sync.test.ts` (REAL, ENH-0009 — 9 testes): plano manual com criação + arquivamento (motivo `substituicao`); motor real; plano vazio sem Sistema; negativos: versão inválida, sync inexistente/não-running, op desconhecida, arquivamento de inativa → ROLLBACK, `23505` → ROLLBACK; authenticated (admin) → permissão negada `[CONFIRMED: test]`
- **Evidências:** E1 — definição no banco dev = migration 20260923000000 `[CONFIRMED: database, migration]`

## ~~public.decidir_pendencia_referencia~~ — ELIMINADA (ENH-0009)

**Eliminada pela migration ENH-0009:** `20260923000000_enh_0009_delecao_fisica_sync_simplificacao.sql` (DROP FUNCTION decidir_pendencia_referencia) — aplicada em dev em 2026-09-24. **Definição histórica em:** `20260906000000_referencias_sync_aplicacao_curadoria.sql` (FEAT-0017 M4). Prod: ainda presente na release v1.11.0; será removida no deploy ENH-0009. Ver detalhes na seção **Funções eliminadas** abaixo.

## ~~public.reverter_sync_referencias~~ — ELIMINADA (ENH-0009)

**Eliminada pela migration ENH-0009:** `20260923000000_enh_0009_delecao_fisica_sync_simplificacao.sql` (DROP FUNCTION reverter_sync_referencias) — aplicada em dev em 2026-09-24. **Definição histórica em:** `20260906010000_referencias_sync_rollback_restauracao.sql` (FEAT-0017 M5); revisada pela `20260914000000_reverter_sync_sem_ops_cancela_pendencias.sql`. Prod: ainda presente na release v1.11.0; será removida no deploy ENH-0009. Ver detalhes na seção **Funções eliminadas** abaixo.

## public.restaurar_referencias_de_backup

**Última verificação:** 2026-09-24 (ENH-0009 — migration 20260923000000 reescreveu a função: `pendencias_canceladas` sempre 0; `referencia_sync_pendencias` dropped)
**Definição em:** `20260906010000_referencias_sync_rollback_restauracao.sql` (FEAT-0017 M5, original); **reescrita** por `20260923000000_enh_0009_delecao_fisica_sync_simplificacao.sql` (ENH-0009) `[CONFIRMED: migration]`

- **Assinatura:** `restaurar_referencias_de_backup(p_backup_id uuid) RETURNS jsonb` — plpgsql
- **SECURITY DEFINER?** Sim — `SET search_path TO 'public'`
- **Autorização implementada (FEAT-0017 §10.2/§12.4):** guarda interna `NOT pode_operar_recuperacao(auth.uid())` → `RAISE EXCEPTION 'Permissão negada: apenas administradores com permissão de recuperação (usuarios.pode_recuperacao) podem restaurar backups'`. **ACL (fato do catálogo 2026-09-11):** `REVOKE ... FROM PUBLIC` removeu o grant a PUBLIC, mas as roles mantêm EXECUTE nominal via default privileges — a proteção efetiva é a guarda interna. **service_role fora** — restauração é ação humana excepcional (nunca automatizada)
- **Pré-condições e validação:** backup deve existir (`'Backup não encontrado: %'` — via join com a sync de origem para obter o environment); guarda de serialização B10c **por environment** (decisão humana 2026-09-06) — nenhuma sync `running` no environment do backup, **incluindo o backup da própria sync em execução** (`'Existe sync em execução neste environment — aguarde a conclusão antes de restaurar'`; o estado que ele guarda ainda está em fluxo); lock `FOR UPDATE` de **TODAS** as pendências `open` (decisão humana 2026-09-06 — a restauração reescreve o catálogo global; nenhuma decisão aberta permanece sobre estado reescrito) e do backup; **integridade verificada ANTES de qualquer efeito** (design §9): `payload` deve ser jsonb **string scalar** E o `sha256` do texto (hex) = `payload_sha256` — senão `'Integridade do backup não verificada (payload_sha256 divergente do conteúdo)'` (fail-high — corrupção/adulteração/linha fora do formato recusadas; digest chamado QUALIFICADO `extensions.digest`: pgcrypto vive no schema `extensions` do Supabase hospedado e o search_path forçado a `public` pela função SECURITY DEFINER não o resolve — descoberto pelos testes REAL do M5, "function digest(text, unknown) does not exist")
- **Efeitos ENH-0009 (o conjunto global sincronizado volta a refletir o backup; nunca DELETE — draft §34; PESSOAIS (`is_global = false`) **nunca tocadas** — D-4):** por chave de identidade (`nome`/`marca`/`fenil` normalizada como o índice `referencias_identidade_ativa_unique`; payload → temp table `_restore_backup_ativos` com índice de identidade): cada global ATIVA no backup sem global ativa de mesma chave hoje → já existe arquivada de MESMO id com a identidade do backup → **reativa**; linha de MESMO id com identidade **divergente** (editada após o backup) → `'Conflito na restauração: referência % existe com identidade divergente da do backup — intervenção manual necessária'` — **ABORTA a transação inteira**; linha **ausente** → recria do backup com o **id original** e `criado_por` = ator Sistema (B5; fail-high `'Ator Sistema não provisionado (sistema@meufenil.local) — execute scripts/provisionar-ator-sistema.js'`); chave já ativa hoje → skip. Passo final: globais ATIVAS hoje **sem** chave ativa no backup → **arquivadas** (anti-join). **ENH-0009:** pendências `open` não existem mais (`referencia_sync_pendencias` dropped) — `pendencias_canceladas` hardcoded `0` na reescrita. Syncs inalteradas; **NÃO cria linha de sync** (D-5); evento único `restore` (sync_id null) com detalhes `{backup_id, reativadas, criadas, arquivadas, pendencias_canceladas, reativadas_ids, criadas_ids, arquivadas_ids}`. GUC `app.audit_origin='curadoria'` idem — flips têm evento `restore` próprio, sem `is_ativa_manual` duplicado. Retorna `{backup_id, reativadas, criadas, arquivadas, pendencias_canceladas}` (sempre 0)
- **Erros e edge cases:** os RAISEs acima (autorização, backup inexistente — inclusive sob lock, guarda running, integridade, conflito, ator ausente); segunda restauração do mesmo backup → estado já reflete → no-op natural por contagens zero (lock do backup serializa)
- **Chamadores no código:** `src/react-app/services/referencias-sync.service.ts:574` — `.rpc("restaurar_referencias_de_backup", ...)` com sessão de admin (UI de recuperação do Admin); ação humana excepcional, nenhum chamador automático `[CONFIRMED: code — referencias-sync.service.ts; migration]`
- **Testes:** suíte REAL `src/shared/security/rpc-referencias-sync-rollback.test.ts` (ENH-0009 — 6 testes, guard `isFeat0017M5Applied`): permissão negada (admin sem flag), backup inexistente, integridade (sha divergente → exceção, zero eventos `restore`), guarda running, happy path (reativa/cria/arquiva com contagens corretas; `pendencias_canceladas = 0`; syncs inalteradas; evento único `restore`), conflito → aborta `[CONFIRMED: test]`
- **Evidências:** E1 — definição no banco dev = migration 20260923000000 `[CONFIRMED: database, migration]`

## public.pode_operar_recuperacao

**Última verificação:** 2026-09-06 (FEAT-0017 M5 — migration 20260906010000 aplicada em dev)
**Definição em:** `20260906010000_referencias_sync_rollback_restauracao.sql` (linhas 55–69; REVOKE/GRANT nas linhas 71–73) `[CONFIRMED: migration, database]`

- **Assinatura:** `pode_operar_recuperacao(p_user_id uuid) RETURNS boolean` — sql, `STABLE`
- **SECURITY DEFINER?** Sim — `SET search_path TO 'public'`
- **Autorização implementada:** nenhuma verificação interna — retorna `EXISTS (usuarios WHERE id = p_user_id AND role = 'admin' AND pode_recuperacao)` — no formato de `is_admin_user`, exigindo a role admin **E** a flag `usuarios.pode_recuperacao`. A flag NÃO é auto-concedida por nenhum fluxo de app (default `false`; coluna nova na mesma migration — concedida manualmente pelo dono do projeto, §5.5/§12.4)
- **Efeitos:** somente leitura
- **Erros e edge cases:** não aplicável
- **Chamadores no código:** não chamada diretamente pela aplicação — guarda interna dos RPCs `reverter_sync_referencias` e `restaurar_referencias_de_backup` `[CONFIRMED: database, migration]`
- **Testes:** coberta indiretamente pelos testes de permissão das RPCs M5 (admin com flag autorizado; admin sem flag → permissão negada) `[CONFIRMED: test]`
- **Evidências:** E1 — definição no banco = migration `[CONFIRMED: database, migration]`

## public.is_admin_user

**Última verificação:** 2026-09-07 (FEAT-0017 M1/M6 — chamadores acrescidos; definição inalterada)
**Definição em:** `20260810000000_background_job_monitoring.sql` (linhas 1–14) — idêntica no banco `[CONFIRMED: migration, database]`

- **Assinatura:** `is_admin_user(p_user_id uuid) RETURNS boolean` — sql, `STABLE`
- **SECURITY DEFINER?** Sim — `SET search_path TO 'public'`
- **Autorização implementada:** nenhuma verificação interna — retorna `EXISTS (usuarios WHERE id = p_user_id AND role = 'admin')`
- **Efeitos:** somente leitura
- **Erros e edge cases:** não aplicável
- **Chamadores no código:** não chamada diretamente pela aplicação; usada no BANCO pelas políticas `admin_can_select_all_usuarios` (usuarios), `admin_can_select_background_job_executions` (background_job_executions), pelas 5 `admin_select_*` das tabelas de sync (FEAT-0017 M1 — migration 20260905000000) e pelos RPCs `ativar_referencia` / `remover_ou_desativar_referencia` / `decidir_pendencia_referencia` (M4) `[CONFIRMED: database, migration]`
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
- **Chamadores no código:** trigger `on_auth_user_created` em `auth.users` (ver [triggers.md](Specs-Current-Database-Triggers))
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
- **Chamadores no código:** trigger `trg_trim_background_job_executions` (ver [triggers.md](Specs-Current-Database-Triggers))
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
- **Chamadores no código:** trigger `trg_auditar_is_ativa_manual` em `referencias` — semântica do trigger em [triggers.md](Specs-Current-Database-Triggers) §trg_auditar_is_ativa_manual
- **Testes:** suíte REAL `src/shared/security/rpc-referencias-sync.test.ts` — aplicar arquivamento (motivo `substituicao`) não gera `is_ativa_manual` `[CONFIRMED: test]`
- **Evidências:** E1 — definição no banco = migration `[CONFIRMED: database, migration]`

## public.fn_trim_referencia_backups

**Última verificação:** 2026-09-06 (FEAT-0017 M1 — migration 20260905000000 aplicada em dev)
**Definição em:** `20260905000000_referencias_sync_tabelas.sql` (linha 260; trigger na 276) `[CONFIRMED: migration, database]`

- **Assinatura:** `fn_trim_referencia_backups() RETURNS trigger` — plpgsql
- **SECURITY DEFINER?** Sim — `search_path` = `public`
- **Autorização implementada:** não aplicável (trigger)
- **Efeitos:** DELETE de `referencia_backups` com `created_at < now() - interval '12 months'` (retenção própria da tabela — B3/D-3); retorna `null` (AFTER STATEMENT)
- **Erros e edge cases:** não aplicável
- **Chamadores no código:** trigger `trg_trim_referencia_backups` em `referencia_backups` — semântica do trigger em [triggers.md](Specs-Current-Database-Triggers) §trg_trim_referencia_backups
- **Testes:** nenhum teste direto do trigger identificado `[CONFIRMED: ausência]`
- **Evidências:** E1 — definição no banco = migration `[CONFIRMED: database, migration]`

---

## Funções eliminadas pela ENH-0004 (20260904000000, aplicada em dev 2026-09-04)

- **`fn_normalizar_nome_referencia()`** (trigger, SECURITY INVOKER — baseline linhas 91–98): preenchia `nome_normalizado` com `lower(trim(nome))` antes de INSERT/UPDATE em `referencias`. Eliminada junto com o trigger `trg_normalizar_nome_referencia` e a coluna `nome_normalizado` (A4(b) — normalização runtime é escopo do FEAT-0017; unicidade agora usa expressões no índice `referencias_identidade_ativa_unique`). Histórico: [triggers.md](Specs-Current-Database-Triggers).
- **`fn_remover_favoritos_referencia_inativa()`** (trigger, SECURITY INVOKER — versionada na 20260814000000, DEBT-0001): removia os favoritos da referência ao desativá-la. Eliminada junto com o trigger `trg_remover_favoritos_referencia_inativa` (OQ3 — desativação preserva favoritos em qualquer fluxo, BR-036).

`[CONFIRMED: migration 20260904000000 — linhas 26–27 (DROP trigger/função de normalização) e 87–88 (DROP trigger/função de favoritos)]`

## Funções eliminadas pela ENH-0009 (20260923000000, aplicada em dev 2026-09-24)

- **`decidir_pendencia_referencia(uuid, boolean, text)`** (RPC SECURITY DEFINER — FEAT-0017 M4, 20260906000000): decidia pendências de curadoria (`absence`/`new_item`/`substitution`) com aprovação ou rejeição por admin. Eliminada com a remoção de `referencia_sync_pendencias` e do fluxo de curadoria (ENH-0009 — substituições auto-aplicadas). Chamador: `referencias-sync.service.ts:534` (M6, removido). Histórico: backup desta spec antes de 2026-09-24.
- **`reverter_sync_referencias(uuid)`** (RPC SECURITY DEFINER — FEAT-0017 M5, 20260906010000; revisada 20260914000000): rollback seletivo de syncs por admin com `pode_recuperacao`. Eliminada com a remoção de `alteracoes` como base de rollback (ENH-0009 simplifica o sync — sem necessidade de desfazer operações individuais). Chamador: `referencias-sync.service.ts:555` (M6, removido). Histórico: backup desta spec antes de 2026-09-24.

`[CONFIRMED: migration 20260923000000 — DROP FUNCTION decidir_pendencia_referencia; DROP FUNCTION reverter_sync_referencias]`

---

## Evidências (documento)

- E1 — Inventário e definições das funções: `pg_proc` + `pg_get_functiondef` nos bancos dev e prod (2026-08-13 — 10 funções, pré-ENH-0004; dev pós-ENH-0004, 2026-09-04 — 8 funções; dev pós-FEAT-0017 M1/M4, 2026-09-06 — 12 funções; dev pós-FEAT-0017 M1–M5, 2026-09-06 — 15 funções; dev pós-ENH-0009, 2026-09-24 — 13 funções) `[CONFIRMED: database, migration]`
- E2 — Definições versionadas: migrations baseline, 20260807, 20260810, 20260811, 20260904000000 (redefinição de `remover_ou_desativar_referencia`; DROPs ENH-0004), 20260905000000/20260905010000 (funções de trigger do M1), 20260906000000 (`aplicar_sync_referencias`; `decidir_pendencia_referencia`), 20260906010000 (`pode_operar_recuperacao`; `reverter_sync_referencias`; `restaurar_referencias_de_backup`), **20260923000000** (ENH-0009: DROP `decidir_pendencia_referencia`/`reverter_sync_referencias`; reescrita `aplicar_sync_referencias`/`restaurar_referencias_de_backup`) `[CONFIRMED: migration]`
- E3 — Chamadores (pós-ENH-0009): `aplicar_sync_referencias` em `api/referencias-sync.ts` (service_role); `restaurar_referencias_de_backup` em `referencias-sync.service.ts:574` (admin session). `decidir_pendencia_referencia` (:534) e `reverter_sync_referencias` (:555) removidos `[CONFIRMED: code]`

## Veja também

- [triggers.md](Specs-Current-Database-Triggers), [referencias.md](Specs-Current-Database-Referencias), [usuarios.md](Specs-Current-Database-Usuarios), [background_job_executions.md](Specs-Current-Database-Background_job_executions)
- `../security/security-model.md` (Fase 3)
