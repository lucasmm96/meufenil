# Funções SQL (RPC) — Schema public

**Última verificação:** 2026-09-04 (ENH-0004 — migrations 20260904000000/20260904010000 aplicadas em dev)

Inventário das **8 funções** do schema `public` no estado pós-ENH-0004 em dev (2026-09-04) `[CONFIRMED: migration 20260904000000 — DROPs; catálogo dev pré-ENH-0004 tinha 10 funções em 2026-08-13]`. As funções de trigger `fn_normalizar_nome_referencia()` e `fn_remover_favoritos_referencia_inativa()` foram **eliminadas** pela ENH-0004 (normalização armazenada — A4(b); remoção de favoritos ao desativar — OQ3). Prod mantém as 10 funções até a release da ENH-0004 `[INFERRED: migrations novas em branch de trabalho; promoção segue gate de release]`. Não há outras funções em `public` além das listadas.

| Função | Tipo | SECURITY DEFINER | search_path | Versionada? |
|---|---|---|---|---|
| `ativar_referencia(uuid)` | negócio | Sim | `public` | Sim (20260811) |
| `remover_ou_desativar_referencia(uuid)` | negócio | Sim | `public` | Sim (20260811; redefinida 20260904) |
| `is_admin_user(uuid)` | autorização | Sim | `public` | Sim (20260810) |
| `dashboard_hoje(uuid)` | consulta | Sim | **não configurado** | Sim (baseline) |
| `dashboard_ultimos_dias(uuid, integer)` | consulta | Sim | **não configurado** | Sim (baseline) |
| `get_estatisticas_admin()` | consulta admin | Sim | `public` | Sim (baseline) |
| `handle_new_user()` | trigger | Sim | não configurado | Sim (baseline) |
| `fn_trim_background_job_executions()` | trigger | Sim | `public` | Sim (20260807) |

Grants (fato do catálogo): todas as roles (`anon`, `authenticated`, `postgres`, `service_role`) possuem EXECUTE em todas as funções; `get_estatisticas_admin` e `is_admin_user` tiveram `REVOKE ... FROM PUBLIC`, mas mantêm grants explícitos (inclusive `anon` via default privileges) `[CONFIRMED: database — role_routine_grants]`.

---

## public.ativar_referencia

**Última verificação:** 2026-08-13 (commit 6323664)
**Definição em:** `20260811210456_fix_security_rls_rpc.sql` (linhas 24–56) — idêntica no banco `[CONFIRMED: migration, database]`

- **Assinatura:** `ativar_referencia(p_referencia_id uuid) RETURNS text` — plpgsql
- **SECURITY DEFINER?** Sim — `SET search_path TO 'public'`
- **Autorização implementada:** o UPDATE só ocorre se o chamador for dono (`criado_por = auth.uid()`), delegado ativo do dono (via `delegacoes_acesso`, com `revoked_at IS NULL`) ou admin (`is_admin_user`). Se a condição não for atendida: `RAISE EXCEPTION 'Referência não encontrada ou permissão negada'` — mesma mensagem para inexistente ou sem permissão
- **Efeitos:** `UPDATE referencias SET is_ativa = true, updated_at = now()`; retorna `'activated'`
- **Erros e edge cases:** exceção quando a referência não existe ou o chamador não tem permissão
- **Chamadores no código:** `src/react-app/services/referencias.service.ts:246` (`activateReferencia`, envolto em `AppError REFERENCIA_ACTIVATE_ERROR`) `[CONFIRMED: code]`
- **Testes:** `src/shared/security/rpc-ativar-referencia.test.ts` (cenários: dono, delegado, admin, não autorizado) `[CONFIRMED: test]`
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

---

## Funções eliminadas pela ENH-0004 (20260904000000, aplicada em dev 2026-09-04)

- **`fn_normalizar_nome_referencia()`** (trigger, SECURITY INVOKER — baseline linhas 91–98): preenchia `nome_normalizado` com `lower(trim(nome))` antes de INSERT/UPDATE em `referencias`. Eliminada junto com o trigger `trg_normalizar_nome_referencia` e a coluna `nome_normalizado` (A4(b) — normalização runtime é escopo do FEAT-0017; unicidade agora usa expressões no índice `referencias_identidade_ativa_unique`). Histórico: [triggers.md](triggers.md).
- **`fn_remover_favoritos_referencia_inativa()`** (trigger, SECURITY INVOKER — versionada na 20260814000000, DEBT-0001): removia os favoritos da referência ao desativá-la. Eliminada junto com o trigger `trg_remover_favoritos_referencia_inativa` (OQ3 — desativação preserva favoritos em qualquer fluxo, BR-036).

`[CONFIRMED: migration 20260904000000 — linhas 26–27 (DROP trigger/função de normalização) e 87–88 (DROP trigger/função de favoritos)]`

---

## Evidências (documento)

- E1 — Inventário e definições das funções: `pg_proc` + `pg_get_functiondef` nos bancos dev e prod (2026-08-13 — 10 funções; dev pós-ENH-0004, 2026-09-04 — 8 funções) `[CONFIRMED: database, migration]`
- E2 — Definições versionadas: migrations baseline, 20260807, 20260810, 20260811, 20260904000000 (redefinição de `remover_ou_desativar_referencia`; DROPs das funções de trigger) `[CONFIRMED: migration]`
- E3 — Chamadores: `grep` de `.rpc(` em `src/`, `api/`, `supabase/functions/` (2026-08-13) — 3 chamadas: `get_estatisticas_admin`, `ativar_referencia`, `remover_ou_desativar_referencia` `[CONFIRMED: code]`

## Veja também

- [triggers.md](triggers.md), [referencias.md](referencias.md), [usuarios.md](usuarios.md), [background_job_executions.md](background_job_executions.md)
- `../security/security-model.md` (Fase 3)
