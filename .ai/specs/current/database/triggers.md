# Triggers — Inventário

**Última verificação:** 2026-09-04 (ENH-0004 — migrations 20260904000000/20260904010000 aplicadas em dev)

Inventário dos triggers confirmados no catálogo: em 2026-08-13 havia 4 (3 no schema `public` + 1 em `auth.users`) `[CONFIRMED: database — information_schema.triggers]`. Após a ENH-0004, **dev tem 2 triggers** (1 em `public` + 1 em `auth.users`) — os dois triggers de `referencias` foram eliminados (normalização — A4(b); remoção de favoritos — OQ3) `[CONFIRMED: migration 20260904000000 — DROPs; execução dev 2026-09-04]`. Prod mantém os 4 até a release da ENH-0004 (migrations não aplicadas em prod) `[INFERRED: migrations novas em branch de trabalho; promoção segue gate de release]`.

| Trigger | Tabela | Evento | Timing | Função | Versionado? |
|---|---|---|---|---|---|
| `trg_trim_background_job_executions` | `background_job_executions` | INSERT | AFTER STATEMENT | `fn_trim_background_job_executions` | Sim (20260807) |
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

## on_auth_user_created

- **Tabela:** `auth.users` (schema do Supabase Auth)
- **Evento/timing:** AFTER INSERT, FOR EACH ROW `[CONFIRMED: database, migration — baseline linha 680]`
- **Função:** `handle_new_user()` (plpgsql, SECURITY DEFINER, sem `search_path` configurado)
- **Finalidade observada:** no sign-up (Auth), cria o perfil correspondente em `public.usuarios` — `nome` (full_name do OAuth ou email), `email`, `role = 'user'`, `timezone = 'America/Sao_Paulo'`, `limite_diario_mg` **não definido** (vale o default da coluna = 500); `on conflict (id) do nothing` `[CONFIRMED: migration — 20260815000000 (DEBT-0002); baseline linhas 120–148 (definição original com 150)]`
- **Evidências:** baseline linha 680 (trigger); migration 20260815000000 (corpo da função); catálogo dev/prod `[CONFIRMED: migration, database]`

---

## Evidências (documento)

- E1 — Inventário dos triggers: `information_schema.triggers` nos bancos dev e prod (2026-08-13); dev pós-ENH-0004 (2026-09-04) `[CONFIRMED: database]`
- E2 — Definições versionadas: baseline e migration 20260807 `[CONFIRMED: migration]`
- E3 — Eliminação dos triggers de `referencias`: migration 20260904000000 (linhas 26–27 e 87–88) `[CONFIRMED: migration]`

## Veja também

- [rpc.md](rpc.md) (funções das triggers), [referencias.md](referencias.md), [background_job_executions.md](background_job_executions.md), [usuarios.md](usuarios.md)
