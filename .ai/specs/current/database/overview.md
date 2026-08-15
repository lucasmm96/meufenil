# Database — Visão Geral

**Última verificação:** 2026-08-14 (migration 20260814000000 aplicada em dev e prod; catálogo conferido nos dois ambientes)

## Propósito

Este diretório documenta o estado REAL do banco de dados PostgreSQL (Supabase) do MeuFenil — tabelas, funções, triggers e políticas RLS — conforme observado nos bancos development e production em 2026-08-13, complementado pelas migrations versionadas e pelo código que interage com o banco.

## Organização deste diretório

| Arquivo | Conteúdo |
|---|---|
| `overview.md` | Este arquivo — inventário, convenções, migrations, ambientes |
| `usuarios.md` ... `background_job_executions.md` | Uma spec por tabela (T1) |
| `rpc.md` | As 10 funções do schema `public` (T2) |
| `triggers.md` | Os 4 triggers (3 em `public` + 1 em `auth.users`) |

## Inventário de tabelas (7)

`[CONFIRMED: database — pg_tables dev e prod, 2026-08-13]`

| Tabela | Propósito curto | RLS | DDL versionado? |
|---|---|---|---|
| `usuarios` | Perfil do usuário (papel, limite diário, timezone, consentimento LGPD) | Sim | Sim (baseline) |
| `referencias` | Alimentos de referência com fenilalanina por 100g (globais ou do usuário) | Sim | Sim (baseline) + coluna `is_ativa` (20260814) |
| `registros` | Registro diário de consumo (peso e fenilalanina) | Sim | Sim (baseline) |
| `exames_pku` | Exames de PKU do usuário | Sim | Sim (baseline) |
| `referencias_favoritas` | Favoritos do usuário | Sim | Sim (20260814) |
| `delegacoes_acesso` | Delegação de acesso entre usuários | Sim | Sim (20260814) |
| `background_job_executions` | Execuções de jobs em background | Sim | Sim (20260807) |

## Convenções observadas no schema

- IDs `uuid` com default `gen_random_uuid()` em todas as tabelas, exceto `usuarios.id`, que referencia `auth.users.id` `[CONFIRMED: database]`.
- `snake_case`; colunas `created_at`/`updated_at` com default `now()` — nullable nas tabelas do baseline, NOT NULL nas tabelas mais novas `[CONFIRMED: database]`.
- **RLS habilitado em TODAS as 7 tabelas** `[CONFIRMED: database — pg_class.relrowsecurity = true em todas]`.
- **Grants amplos**: `anon`, `authenticated` e `service_role` possuem SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER em todas as 7 tabelas; a restrição efetiva de acesso é o RLS `[CONFIRMED: database — role_table_grants]`.
- Funções de segurança usam `SECURITY DEFINER` + `SET search_path TO 'public'` (`is_admin_user`, `ativar_referencia`, `remover_ou_desativar_referencia`, `fn_trim_background_job_executions`, `get_estatisticas_admin`). `dashboard_hoje` e `dashboard_ultimos_dias` são `SECURITY DEFINER` **sem** `search_path` configurado `[CONFIRMED: database — pg_proc.proconfig]`.
- Não há views, sequences nem tabelas na publication `supabase_realtime` para o schema `public` `[CONFIRMED: database]`.

## Migrations

### Dois locais distintos

1. **`migrations/` (raiz) — legado pré-Supabase-CLI.** `usuarios.sql`, `referencias.sql`, `registros.sql`, `exames_pku.sql` (commit `b10dc49`, 2025-12-28) e `dados.sql` (seed ANVISA com 2.958 INSERTs em `referencias`, commit `cb9fae6`, 2026-01-01). Snapshot de schema da época; não contém o estado atual de políticas.
2. **`supabase/migrations/` — sistema atual (Supabase CLI):**

| Migration | Data (git) | Conteúdo |
|---|---|---|
| `20260103015052_remote_schema.sql` | 2026-01-02 | Baseline (`supabase db pull`): 4 tabelas, 5 funções, 2 triggers, ~20 políticas (com duplicatas), extensões, grants e default privileges |
| `20260807000000_background_job_executions.sql` | 2026-08-06 | Enum `background_job_status`, tabela `background_job_executions`, 3 índices, trigger de retenção |
| `20260810000000_background_job_monitoring.sql` | 2026-08-11 | Função `is_admin_user` + política admin de consulta aos jobs |
| `20260811210456_fix_security_rls_rpc.sql` | 2026-08-11 | Correções de segurança: drop `debug_allow_all`, política `admin_can_select_all_usuarios`, endurecimento de `ativar_referencia` e `remover_ou_desativar_referencia` |
| `20260814000000_baseline_objetos_nao_versionados.sql` | 2026-08-14 | **DEBT-0001:** baseline idempotente dos objetos sem DDL versionado — tabelas `delegacoes_acesso` e `referencias_favoritas`, coluna `referencias.is_ativa`, função/trigger de favoritos, consolidação das políticas RLS (cria 27 vigentes + remove as obsoletas do baseline) |

Aplicação via `scripts/apply-supabase-migrations.sh` (obrigatório `--env development|production`; nunca os dois juntos). Baseline: versão `20260103015052` `[CONFIRMED: code, script]`.

### Objetos que existiam SEM migration versionada (resolvido pela DEBT-0001)

Até 2026-08-13, os objetos abaixo existiam nos dois ambientes sem DDL em nenhuma migration (aplicados por canal não-versionado, origem `UNKNOWN`). A migration `20260814000000_baseline_objetos_nao_versionados.sql` (DEBT-0001) os versionou com DDL idempotente conferido contra o catálogo dos dois ambientes (2026-08-14); a aplicação em dev e prod foi um no-op (estado idêntico antes/depois, ver specs das tabelas):

| Objeto | Onde documentado |
|---|---|
| Tabela `delegacoes_acesso` | `delegacoes_acesso.md` |
| Tabela `referencias_favoritas` | `referencias_favoritas.md` |
| Coluna `referencias.is_ativa boolean NOT NULL default true` | `referencias.md` |
| Função `fn_remover_favoritos_referencia_inativa` + trigger `trg_remover_favoritos_referencia_inativa` | `rpc.md`, `triggers.md` |
| Políticas "dono ou delegado" (registros, exames_pku, referencias, referencias_favoritas), políticas de `delegacoes_acesso`, "Inserir registro apenas com referencia ativa" | specs das respectivas tabelas |
| Consolidação das políticas do baseline (ex.: "usuario cria referencia" → "Usuário cria própria referencia"; remoção das duplicatas do baseline) | specs das respectivas tabelas |

A origem exata (canal de aplicação e datas) desses objetos é `UNKNOWN` — os commits de git associados às features (ex.: `d14b1de`, `e19f43a`, `2e6f540`) adicionaram apenas código, sem arquivo de migration correspondente `[CONFIRMED: git history; aplicação: UNKNOWN]`. O versionamento baseline NÃO estabelece a origem — apenas fixa o estado atual.

## Ambientes dev × prod

- **Estrutura lógica IDÊNTICA**: mesmas 7 tabelas, 52 colunas, 19 constraints, 15 índices, 31 políticas, 10 funções, 1 enum e 3 triggers em `public` (+1 em `auth.users`) `[CONFIRMED: database — catálogo dev e prod, 2026-08-14; correção registrada: a contagem anterior (3 enums, 4 triggers em public) não bate com o catálogo — pg_type/pg_trigger em ambos os ambientes]`.
- **Diferenças entre ambientes**:
  1. Extensão `pg_graphql` presente em dev, ausente em prod `[CONFIRMED: database]`.
  2. Prod possui uma coluna **dropped** na posição física 8 de `referencias` (artefato de ADD+DROP; o nome original não é recuperável do catálogo — `UNKNOWN`). Dev não possui `[CONFIRMED: database — pg_attribute.attisdropped]`.
  3. Contagens de dados distintas (coletadas em 2026-08-13) `[CONFIRMED: database]`:

| Tabela | dev | prod |
|---|---|---|
| usuarios | 2 | 7 |
| referencias | 3.164 | 2.986 |
| registros | 13 | 1.363 |
| exames_pku | 4 | 21 |
| background_job_executions | 6 | 8 |

- **U1 da Fase 0 resolvido**: todos os objetos passaram a ter DDL versionado com a migration 20260814000000 (DEBT-0001); aplicada em dev e prod em 2026-08-14 com verificação de no-op contra o catálogo.

## Evidências

- E1 — Inventário de tabelas, colunas (52), constraints (19), índices (15), flags RLS, políticas (31), funções (10), enums (1 em `public`) e triggers (3 em `public` + 1 em `auth.users`): catálogo dos bancos dev e prod via queries somente-leitura (2026-08-14) `[CONFIRMED: database]`.
- E2 — Conteúdo das 4 migrations em `supabase/migrations/` `[CONFIRMED: migration]`.
- E3 — Conteúdo das 5 migrations legadas em `migrations/` `[CONFIRMED: migration, git history]`.
- E4 — Histórico git das migrations (`b9a82c7`, `87aa0ff`, `879a6c0`, `6323664`) `[CONFIRMED: git history]`.
- E5 — Chamadores de tabelas no código: 27× `usuarios`, 12× `registros`, 11× `referencias`, 5× `referencias_favoritas`, 5× `delegacoes_acesso`, 4× `exames_pku`, 3× `background_job_executions` em `src/`, `api/` e `supabase/functions/` `[CONFIRMED: code — grep, 2026-08-13]`.

## Veja também

- `../security/security-model.md` (Fase 3) — matriz RLS consolidada e autorização
- [system-map](../system-map.md) — coluna Database do mapa de capabilities
- `.ai/.temp/analyses/18-documentacao-database.md` — relatório da fase com a comparação banco × migrations
