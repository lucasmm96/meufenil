# Triggers — Inventário

**Última verificação:** 2026-09-11 (FEAT-0017 M1/M4 — migrations 20260905*/20260906000000 aplicadas em dev e prod — release v1.11.0, 2026-09-10)

Inventário dos triggers confirmados no catálogo: em 2026-08-13 havia 4 (3 no schema `public` + 1 em `auth.users`) `[CONFIRMED: database — information_schema.triggers]`. Após a ENH-0004, **dev tem 2 triggers** (1 em `public` + 1 em `auth.users`) — os dois triggers de `referencias` foram eliminados (normalização — A4(b); remoção de favoritos — OQ3) `[CONFIRMED: migration 20260904000000 — DROPs; execução dev 2026-09-04]`. Com o FEAT-0017 M1, **dev tem 4 triggers** (3 em `public` + 1 em `auth.users`) — M1 criou 2 (auditoria de `is_ativa` em `referencias`; retenção de backups de sync). Prod tem os **mesmos 4 triggers** do dev desde a release v1.11.0 (2026-09-10) `[CONFIRMED: database — catálogo prod 2026-09-11]`.

| Trigger | Tabela | Evento | Timing | Função | Versionado? |
|---|---|---|---|---|---|
| `trg_trim_background_job_executions` | `background_job_executions` | INSERT | AFTER STATEMENT | `fn_trim_background_job_executions` | Sim (20260807) |
| `trg_auditar_is_ativa_manual` | `referencias` | UPDATE OF `is_ativa` | AFTER ROW | `fn_auditar_is_ativa_manual` | Sim (20260905010000) |
| `trg_trim_referencia_backups` | `referencia_backups` | INSERT | AFTER STATEMENT | `fn_trim_referencia_backups` | Sim (20260905000000) |
| `on_auth_user_created` | `auth.users` | INSERT | AFTER ROW | `handle_new_user` | Sim (baseline) |

Eliminados pela ENH-0004 (20260904000000, aplicada em dev 2026-09-04):

| Trigger | Tabela | Motivo da eliminação | Migration |
|---|---|---|---|
| `trg_normalizar_nome_referencia` (+ função `fn_normalizar_nome_referencia`) | `referencias` | A4(b) — normalização armazenada eliminada (runtime é escopo do FEAT-0017); a unicidade passou a usar expressões `lower(trim(...))` no índice | 20260904000000 |
| `trg_remover_favoritos_referencia_inativa` (+ função `fn_remover_favoritos_referencia_inativa`) | `referencias` | OQ3 — desativação/arquivamento passou a PRESERVAR favoritos em qualquer fluxo (BR-036) | 20260904000000 |

## trg_trim_background_job_executions

- **Tabela:** `public.background_job_executions`
- **Evento/timing:** AFTER INSERT, FOR EACH STATEMENT `[CONFIRMED: database, migration — 20260807, linhas 49–54]`
- **Função:** `fn_trim_background_job_executions()` (plpgsql, SECURITY DEFINER, `search_path` = public)
- **Finalidade observada:** retenção — a cada INSERT, remove execuções com mais de 365 dias (`created_at < now() - interval '365 days'`) `[CONFIRMED: migration]`
- **Evidências:** migration 20260807; catálogo dev/prod `[CONFIRMED: migration, database]`

## trg_auditar_is_ativa_manual

- **Tabela:** `public.referencias`
- **Evento/timing:** AFTER UPDATE OF `is_ativa`, FOR EACH ROW; **`WHEN (auth.uid() is not null)`** — service_role/roteiro/migração têm uid null → skip `[CONFIRMED: migration — 20260905010000, linhas 51–57]`
- **Função:** `fn_auditar_is_ativa_manual()` (plpgsql, SECURITY DEFINER, `search_path` = public)
- **Finalidade observada (FEAT-0017 §11.3/D-7):** auditoria da MUDANÇA MANUAL de `is_ativa` — registra `referencia_eventos` com `tipo = 'is_ativa_manual'`, `actor_id = auth.uid()` (admin que executou o RPC `ativar_referencia`/`remover_ou_desativar_referencia` com sessão) e `detalhes = {de, para}`; o registro ocorre **somente quando** `is_admin_user(auth.uid())` E o GUC `app.audit_origin` ≠ `'curadoria'`. Escritas automáticas de sync (RPCs `aplicar_sync_referencias` — uid null — e `decidir_pendencia_referencia` com GUC local `app.audit_origin='curadoria'`, M4; rollback/restauração M5) não geram o evento — arquivamentos/reativações automáticas têm eventos específicos (`referencia_arquivada` etc.) e não duplicam `is_ativa_manual` `[CONFIRMED: migration — 20260905010000, linhas 19–44; migration 20260906000000 — GUC no decidir, linha 321]`
- **Evidências:** migration 20260905010000; catálogo dev `[CONFIRMED: migration, database]`

## trg_trim_referencia_backups

- **Tabela:** `public.referencia_backups`
- **Evento/timing:** AFTER INSERT, FOR EACH STATEMENT `[CONFIRMED: migration — 20260905000000, linhas 260–279]`
- **Função:** `fn_trim_referencia_backups()` (plpgsql, SECURITY DEFINER, `search_path` = public)
- **Finalidade observada (B3/D-3):** retenção — a cada INSERT, remove backups com mais de 12 meses (`created_at < now() - interval '12 months'`), intervalo próprio da tabela (fora do trim 365d da BR-027 aplicado por `trg_trim_background_job_executions`) `[CONFIRMED: migration]`
- **Evidências:** migration 20260905000000; catálogo dev `[CONFIRMED: migration, database]`

## on_auth_user_created

- **Tabela:** `auth.users` (schema do Supabase Auth)
- **Evento/timing:** AFTER INSERT, FOR EACH ROW `[CONFIRMED: database, migration — baseline linha 680]`
- **Função:** `handle_new_user()` (plpgsql, SECURITY DEFINER, sem `search_path` configurado)
- **Finalidade observada:** no sign-up (Auth), cria o perfil correspondente em `public.usuarios` — `nome` (full_name do OAuth ou email), `email`, `role = 'user'`, `timezone = 'America/Sao_Paulo'`, `limite_diario_mg` **não definido** (vale o default da coluna = 500); `on conflict (id) do nothing` `[CONFIRMED: migration — 20260815000000 (DEBT-0002); baseline linhas 120–148 (definição original com 150)]`
- **Evidências:** baseline linha 680 (trigger); migration 20260815000000 (corpo da função); catálogo dev/prod `[CONFIRMED: migration, database]`

---

## Evidências (documento)

- E1 — Inventário dos triggers: `information_schema.triggers` nos bancos dev e prod (2026-08-13); dev pós-ENH-0004 (2026-09-04); dev pós-FEAT-0017 M1 (2026-09-06) `[CONFIRMED: database]`
- E2 — Definições versionadas: baseline, migration 20260807, migrations FEAT-0017 20260905000000 (linhas 255–279) e 20260905010000 (linhas 25–57) `[CONFIRMED: migration]`
- E3 — Eliminação dos triggers de `referencias`: migration 20260904000000 (linhas 26–27 e 87–88) `[CONFIRMED: migration]`

## Veja também

- [rpc.md](rpc.md) (funções das triggers), [referencias.md](referencias.md), [background_job_executions.md](background_job_executions.md), [usuarios.md](usuarios.md)
