# Funções SQL (RPC) — Schema public

**Última verificação:** 2026-08-13 (commit 6323664)

Inventário das 10 funções do schema `public` confirmadas no catálogo dos bancos dev e prod (2026-08-13) `[CONFIRMED: database — pg_proc]`. Não há outras funções em `public` além das listadas.

| Função | Tipo | SECURITY DEFINER | search_path | Versionada? |
|---|---|---|---|---|
| `ativar_referencia(uuid)` | negócio | Sim | `public` | Sim (20260811) |
| `remover_ou_desativar_referencia(uuid)` | negócio | Sim | `public` | Sim (20260811) |
| `is_admin_user(uuid)` | autorização | Sim | `public` | Sim (20260810) |
| `dashboard_hoje(uuid)` | consulta | Sim | **não configurado** | Sim (baseline) |
| `dashboard_ultimos_dias(uuid, integer)` | consulta | Sim | **não configurado** | Sim (baseline) |
| `get_estatisticas_admin()` | consulta admin | Sim | `public` | Sim (baseline) |
| `handle_new_user()` | trigger | Sim | não configurado | Sim (baseline) |
| `fn_normalizar_nome_referencia()` | trigger | Não | — | Sim (baseline) |
| `fn_trim_background_job_executions()` | trigger | Sim | `public` | Sim (20260807) |
| `fn_remover_favoritos_referencia_inativa()` | trigger | Não | — | Sim (20260814) |

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

**Última verificação:** 2026-08-13 (commit 6323664)
**Definição em:** `20260811210456_fix_security_rls_rpc.sql` (linhas 64–126) — idêntica no banco `[CONFIRMED: migration, database]`

- **Assinatura:** `remover_ou_desativar_referencia(p_referencia_id uuid) RETURNS text` — plpgsql
- **SECURITY DEFINER?** Sim — `SET search_path TO 'public'`
- **Autorização implementada:** (1) referência deve existir — senão `'Referência não encontrada'`; (2) dono OU delegado ativo OU admin — senão `'Permissão negada: você não pode remover esta referência'`; (3) referência global exige admin — senão `'Permissão negada: apenas administradores podem remover referências globais'`
- **Efeitos:** verifica vínculo com `registros`; SE há registros vinculados → soft delete (`is_ativa = false`, retorna `'deactivated'`); SENÃO → DELETE físico (retorna `'deleted'`)
- **Erros e edge cases:** as três mensagens de exceção acima; mensagem única para "não encontrada × sem permissão" no passo 2 (diferente do `ativar_referencia`)
- **Chamadores no código:** `src/react-app/services/referencias.service.ts:263` (`deleteOrDeactivateReferencia`, envolto em `AppError REFERENCIA_DELETE_OR_DEACTIVATE_ERROR`) `[CONFIRMED: code]`
- **Testes:** `src/shared/security/rpc-remover-referencia.test.ts` (dono, delegado, admin, não autorizado, soft-delete, hard-delete) `[CONFIRMED: test]`
- **Evidências:** E1 — definição no banco = migration `[CONFIRMED: database, migration]`

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

**Última verificação:** 2026-08-13 (commit 6323664)
**Definição em:** baseline `20260103015052_remote_schema.sql` (linhas 120–148) `[CONFIRMED: migration, database]`

- **Assinatura:** `handle_new_user() RETURNS trigger` — plpgsql
- **SECURITY DEFINER?** Sim — `search_path` não configurado
- **Autorização implementada:** função de trigger — executa no evento de criação em `auth.users`
- **Efeitos:** INSERT em `usuarios` com `id = new.id`, `nome = coalesce(raw_user_meta_data->>'full_name', email)`, `email = new.email`, `role = 'user'`, `timezone = 'America/Sao_Paulo'`, `limite_diario_mg = 150`, timestamps `now()`; `on conflict (id) do nothing`
- **Erros e edge cases:** conflito de id é ignorado (`do nothing`)
- **Chamadores no código:** trigger `on_auth_user_created` em `auth.users` (ver [triggers.md](triggers.md))
- **Testes:** nenhum teste direto identificado `[CONFIRMED: ausência]`
- **Evidências:** E1 — definição no banco = baseline `[CONFIRMED: database, migration]`

## public.fn_normalizar_nome_referencia

**Última verificação:** 2026-08-13 (commit 6323664)
**Definição em:** baseline `20260103015052_remote_schema.sql` (linhas 91–98) `[CONFIRMED: migration, database]`

- **Assinatura:** `fn_normalizar_nome_referencia() RETURNS trigger` — plpgsql
- **SECURITY DEFINER?** Não
- **Autorização implementada:** não aplicável (trigger)
- **Efeitos:** `new.nome_normalizado := lower(trim(new.nome))` antes de INSERT/UPDATE em `referencias`
- **Erros e edge cases:** não aplicável
- **Chamadores no código:** trigger `trg_normalizar_nome_referencia` (ver [triggers.md](triggers.md))
- **Testes:** coberta indiretamente por `referencias.service.test.ts`? Nenhum teste direto do trigger identificado `[CONFIRMED: ausência]`
- **Evidências:** E1 — definição no banco = baseline `[CONFIRMED: database, migration]`

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

## public.fn_remover_favoritos_referencia_inativa

**Última verificação:** 2026-08-14 (migration 20260814000000 aplicada em dev e prod)
**Definição em:** `supabase/migrations/20260814000000_baseline_objetos_nao_versionados.sql` (DEBT-0001) — conferida contra `pg_get_functiondef` dev e prod (2026-08-14) `[CONFIRMED: database × migration]`

- **Assinatura:** `fn_remover_favoritos_referencia_inativa() RETURNS trigger` — plpgsql
- **SECURITY DEFINER?** Não
- **Autorização implementada:** não aplicável (trigger)
- **Efeitos:** se `old.is_ativa = true AND new.is_ativa = false` → `DELETE FROM referencias_favoritas WHERE referencia_id = new.id`; retorna `new`
- **Erros e edge cases:** não aplicável
- **Chamadores no código:** trigger `trg_remover_favoritos_referencia_inativa` (AFTER UPDATE em `referencias` — ver [triggers.md](triggers.md))
- **Testes:** nenhum teste identificado `[CONFIRMED: ausência]`
- **Evidências:** E1 — definição recuperada do catálogo (dev e prod idênticas) `[CONFIRMED: database]`; E2 — ausência em todas as migrations até a baseline 20260814000000 (DEBT-0001), que a versiona `[CONFIRMED: migration]`

---

## Evidências (documento)

- E1 — Inventário e definições das 10 funções: `pg_proc` + `pg_get_functiondef` nos bancos dev e prod (2026-08-13) `[CONFIRMED: database]`
- E2 — Definições versionadas: migrations baseline, 20260807, 20260810, 20260811 `[CONFIRMED: migration]`
- E3 — Chamadores: `grep` de `.rpc(` em `src/`, `api/`, `supabase/functions/` (2026-08-13) — 3 chamadas: `get_estatisticas_admin`, `ativar_referencia`, `remover_ou_desativar_referencia` `[CONFIRMED: code]`

## Veja também

- [triggers.md](triggers.md), [referencias.md](referencias.md), [usuarios.md](usuarios.md), [background_job_executions.md](background_job_executions.md)
- `../security/security-model.md` (Fase 3)
