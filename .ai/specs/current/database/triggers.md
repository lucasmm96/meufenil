# Triggers — Inventário

**Última verificação:** 2026-08-13 (commit 6323664)

Inventário dos 4 triggers confirmados no catálogo dos bancos dev e prod (2026-08-13): 3 no schema `public` + 1 em `auth.users` `[CONFIRMED: database — information_schema.triggers]`. Não há outros triggers em `public`.

| Trigger | Tabela | Evento | Timing | Função | Versionado? |
|---|---|---|---|---|---|
| `trg_normalizar_nome_referencia` | `referencias` | INSERT, UPDATE | BEFORE ROW | `fn_normalizar_nome_referencia` | Sim (baseline) |
| `trg_remover_favoritos_referencia_inativa` | `referencias` | UPDATE | AFTER ROW | `fn_remover_favoritos_referencia_inativa` | **NÃO** |
| `trg_trim_background_job_executions` | `background_job_executions` | INSERT | AFTER STATEMENT | `fn_trim_background_job_executions` | Sim (20260807) |
| `on_auth_user_created` | `auth.users` | INSERT | AFTER ROW | `handle_new_user` | Sim (baseline) |

---

## trg_normalizar_nome_referencia

- **Tabela:** `public.referencias`
- **Evento/timing:** BEFORE INSERT OR UPDATE, FOR EACH ROW `[CONFIRMED: database, migration — baseline linha 250]`
- **Função:** `fn_normalizar_nome_referencia()` (plpgsql, SECURITY INVOKER)
- **Finalidade observada:** preenche `nome_normalizado` com `lower(trim(nome))` antes de gravar — alimenta os índices únicos `referencias_nome_unique` e `referencias_nome_normalizado_unique` `[CONFIRMED: migration, database]`
- **Evidências:** baseline `20260103015052_remote_schema.sql:250`; catálogo dev/prod (INSERT e UPDATE listados) `[CONFIRMED: migration, database]`

## trg_remover_favoritos_referencia_inativa

- **Tabela:** `public.referencias`
- **Evento/timing:** AFTER UPDATE, FOR EACH ROW `[CONFIRMED: database]`
- **Função:** `fn_remover_favoritos_referencia_inativa()` (plpgsql, SECURITY INVOKER)
- **Finalidade observada:** quando uma referência passa de ativa (`old.is_ativa = true`) para inativa (`new.is_ativa = false`), remove os favoritos dela em `referencias_favoritas` `[CONFIRMED: database — pg_get_functiondef]`
- **Evidências:** catálogo dev/prod; NÃO versionado — ausente de todas as migrations `[CONFIRMED: database; ausência em migrations]`

## trg_trim_background_job_executions

- **Tabela:** `public.background_job_executions`
- **Evento/timing:** AFTER INSERT, FOR EACH STATEMENT `[CONFIRMED: database, migration — 20260807, linhas 49–54]`
- **Função:** `fn_trim_background_job_executions()` (plpgsql, SECURITY DEFINER, `search_path` = public)
- **Finalidade observada:** retenção — a cada INSERT, remove execuções com mais de 365 dias (`created_at < now() - interval '365 days'`) `[CONFIRMED: migration]`
- **Evidências:** migration 20260807; catálogo dev/prod `[CONFIRMED: migration, database]`

## on_auth_user_created

- **Tabela:** `auth.users` (schema do Supabase Auth)
- **Evento/timing:** AFTER INSERT, FOR EACH ROW `[CONFIRMED: database, migration — baseline linha 680]`
- **Função:** `handle_new_user()` (plpgsql, SECURITY DEFINER, sem `search_path` configurado)
- **Finalidade observada:** no sign-up (Auth), cria o perfil correspondente em `public.usuarios` — `nome` (full_name do OAuth ou email), `email`, `role = 'user'`, `timezone = 'America/Sao_Paulo'`, `limite_diario_mg = 150`; `on conflict (id) do nothing` `[CONFIRMED: migration, baseline linhas 120–148]`
- **Evidências:** baseline linha 680; catálogo dev/prod `[CONFIRMED: migration, database]`

---

## Evidências (documento)

- E1 — Inventário dos triggers: `information_schema.triggers` nos bancos dev e prod (2026-08-13) `[CONFIRMED: database]`
- E2 — Definições versionadas: baseline e migration 20260807 `[CONFIRMED: migration]`
- E3 — `trg_remover_favoritos_referencia_inativa`: ausente de todas as migrations; definição recuperada via `pg_get_functiondef` `[CONFIRMED: database; ausência em migrations]`

## Veja também

- [rpc.md](rpc.md) (funções das triggers), [referencias.md](referencias.md), [background_job_executions.md](background_job_executions.md), [usuarios.md](usuarios.md)
