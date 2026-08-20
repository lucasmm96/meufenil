# Referências Técnicas

Detalhamento técnico do MeuFenil para desenvolvedores e operadores: banco de dados, edge functions, background jobs, CLI interna e migrations. Toda informação tem origem nas specs de `current/` e no código do repositório.

## Sumário

- [Banco de Dados](#banco-de-dados)
- [Edge Functions](#edge-functions)
- [Background Jobs](#background-jobs)
- [CLI Interna](#cli-interna)
- [Migrations](#migrations)

## Banco de Dados

PostgreSQL (Supabase) — **7 tabelas**, RLS habilitado em todas, **31 políticas**, **10 funções** e **4 triggers** (3 em `public` + 1 em `auth.users`). (Fonte: `database/overview.md`)

### Tabelas e colunas principais

**`usuarios`** — perfil do usuário; `id` (PK, FK → `auth.users(id)` ON DELETE CASCADE), `nome`, `email` (UNIQUE), `role` (default `'user'`; `'admin'` = privilégios), `limite_diario_mg` (default **500**), `timezone` (default `America/Sao_Paulo`), `consentimento_lgpd_em`. (Fonte: `database/usuarios.md`)

**`referencias`** — alimentos com fenilalanina por 100g; `id`, `nome`, `fenil_mg_por_100g`, `criado_por` (FK → `usuarios` CASCADE), `is_global` (default false), `nome_normalizado` (UNIQUE, via trigger), `is_ativa` (default true — soft delete). Índices únicos em `lower(nome)` e `nome_normalizado`. (Fonte: `database/referencias.md`)

**`registros`** — consumo diário; `id`, `data`, `usuario_id` (FK → `usuarios`, **sem** CASCADE), `referencia_id` (FK → `referencias`, sem CASCADE), `peso_g`, `fenil_mg` (calculado na UI). Sem política de UPDATE: registros não são editáveis, apenas criados/excluídos. (Fonte: `database/registros.md`)

**`exames_pku`** — exames laboratoriais; `id`, `usuario_id` (FK → `usuarios` CASCADE), `data_exame`, `resultado_mg_dl`. (Fonte: `database/exames_pku.md`)

**`referencias_favoritas`** — favoritos N:N; `id`, `usuario_id` (FK CASCADE), `referencia_id` (FK CASCADE); índice único por par (usuario, referência). (Fonte: `database/referencias_favoritas.md`)

**`delegacoes_acesso`** — delegação por par; `id`, `concedente_id`, `delegado_id` (FKs → `usuarios` CASCADE), `created_at`, `revoked_at` (não-nulo = revogada); índice único parcial `(concedente_id, delegado_id) WHERE revoked_at IS NULL` — no máximo uma delegação ativa por par. (Fonte: `database/delegacoes_acesso.md`)

**`background_job_executions`** — execuções de jobs; `id`, `run_id`, `job_key`, `environment` (`prod`/`dev`), `status` (enum `success`/`failure`/`partial`), `started_at`/`finished_at` (CHECK `finished_at >= started_at`), `duration_ms` (CHECK ≥ 0), `message`, `details` (jsonb), `created_at`; 3 índices; sem FK. (Fonte: `database/background_job_executions.md`)

### RLS (resumo das políticas)

Padrões transversais (Fonte: `security/security-model.md` seção 8):

1. **Ownership:** `auth.uid() = <coluna dono>` (`usuarios.id`, `referencias.criado_por`, `registros.usuario_id`, `exames_pku.usuario_id`, `referencias_favoritas.usuario_id`).
2. **Delegação:** `EXISTS (delegacoes_acesso WHERE concedente_id = <dono> AND delegado_id = auth.uid() AND revoked_at IS NULL)` — usada por 15 policies ("dono ou delegado").
3. **Admin:** `is_admin_user(auth.uid())` ou `auth.jwt()->>'role' = 'admin'` (apenas em `referencias`).
4. **Visibilidade de referências:** `is_global = true OR criado_por = auth.uid()` (+ variante delegado).
5. **Invariantes de negócio no RLS:** INSERT de registro exige referência ativa; DELETE de referência bloqueado com registros vinculados; remoção de global só por admin.

Destaques factuais da matriz (Fonte: `security/security-model.md` seção 3):

- Admin **não** tem acesso RLS a `registros`, `exames_pku`, `referencias_favoritas` e `delegacoes_acesso` — o painel admin usa o RPC `get_estatisticas_admin` para números agregados.
- Anon (não autenticado) consegue listar referências globais (`is_global = true`).
- `delegacoes_acesso`: INSERT pelo concedente; UPDATE (revogação) pelo concedente; sem DELETE (revogação = UPDATE `revoked_at`).
- `background_job_executions`: apenas SELECT admin; escrita via service role (sem policies de INSERT).
- Não existe política UPDATE em `registros` nem em `referencias_favoritas`.

### RPCs (10 funções em `public`)

| Função | Tipo | Autorização interna | Efeito |
|---|---|---|---|
| `ativar_referencia(uuid)` | negócio, SECURITY DEFINER (`search_path public`) | dono OU delegado ativo OU admin | `UPDATE referencias SET is_ativa = true`; retorna `'activated'` |
| `remover_ou_desativar_referencia(uuid)` | negócio, SECURITY DEFINER (`search_path public`) | dono/delegado/admin; global → só admin | com registros vinculados → soft delete (`'deactivated'`); sem vínculo → DELETE (`'deleted'`) |
| `is_admin_user(uuid)` | autorização, SECURITY DEFINER | — (função de verificação) | retorna `EXISTS (usuarios WHERE id = uid AND role = 'admin')` |
| `get_estatisticas_admin()` | consulta admin, SECURITY DEFINER | **sem** verificação interna | tamanho do banco (MB) + contagens de registros/referências |
| `dashboard_hoje(uuid)` | consulta, SECURITY DEFINER **sem** search_path | **sem** verificação — aceita qualquer `uid` | soma do dia + limite (RPC órfã: sem chamadores) |
| `dashboard_ultimos_dias(uuid, integer)` | consulta, SECURITY DEFINER **sem** search_path | **sem** verificação | soma por dia (RPC órfã: sem chamadores) |
| `handle_new_user()` | trigger, SECURITY DEFINER | — | cria perfil em `usuarios` no sign-up |
| `fn_normalizar_nome_referencia()` | trigger, INVOKER | — | `nome_normalizado = lower(trim(nome))` |
| `fn_trim_background_job_executions()` | trigger, SECURITY DEFINER | — | retenção: remove execuções > 365 dias a cada INSERT |
| `fn_remover_favoritos_referencia_inativa()` | trigger, INVOKER | — | remove favoritos quando referência é desativada |

(Fonte: `database/rpc.md`; `security/security-model.md` seções 7, 10–11)

Chamadores no código: `ativar_referencia` e `remover_ou_desativar_referencia` → `src/react-app/services/referencias.service.ts:246,263`; `get_estatisticas_admin` → `src/react-app/services/admin.service.ts:75`. (Fonte: `database/rpc.md`)

### Triggers

| Trigger | Tabela | Evento | Função | Finalidade |
|---|---|---|---|---|
| `trg_normalizar_nome_referencia` | `referencias` | BEFORE INSERT/UPDATE | `fn_normalizar_nome_referencia` | normaliza nome (alimenta índices únicos) |
| `trg_remover_favoritos_referencia_inativa` | `referencias` | AFTER UPDATE OF `is_ativa` | `fn_remover_favoritos_referencia_inativa` | limpa favoritos ao desativar |
| `trg_trim_background_job_executions` | `background_job_executions` | AFTER INSERT (statement) | `fn_trim_background_job_executions` | retenção de 365 dias |
| `on_auth_user_created` | `auth.users` | AFTER INSERT | `handle_new_user` | cria perfil no sign-up |

(Fonte: `database/triggers.md`)

## Edge Functions

2 funções em `supabase/functions/` (Deno), ambas com CORS próprio inline e acesso via service role (Fonte: `backend/overview.md`):

### `delegar-acesso`

- **Operações (POST `{ acao, ... }`):** `listar`, `conceder` (por email; bloqueia auto-concessão), `revogar` (UPDATE `revoked_at`), `assumir` (delegação ativa → `usuario_assumido_id` + owner; **não** troca token/sessão), `sair`. (Fonte: `backend/edge-function-delegar-acesso.md`)
- **Autenticação:** Bearer obrigatório → `auth.getUser` com service role; erros 400/401/403/404/405/500 com JSON `{ error }`. (Fonte: `backend/edge-function-delegar-acesso.md`)
- **Fatos:** a ação `listar` referencia nomes de FK inexistentes no catálogo e não é usada pelo frontend (a listagem real é client-side via RLS); função **não** declarada no `supabase/config.toml` — configuração de deploy `[UNKNOWN]`. (Fonte: `backend/edge-function-delegar-acesso.md`; `database/delegacoes_acesso.md`)

### `delete-account`

- **Sequência:** `DELETE registros` → `DELETE usuarios` → `auth.admin.deleteUser` (ordem exigida pelas FKs). (Fonte: `backend/edge-function-delete-account.md`; verificado em: `supabase/functions/delete-account/index.ts`)
- **Autenticação:** Bearer obrigatório, validado em 2 estágios (cliente anon com `auth.getUser`); opera somente sobre o próprio usuário. (Fonte: `backend/edge-function-delete-account.md`)
- **Configuração:** declarada em `supabase/config.toml` com `verify_jwt = true` — única função declarada. (Fonte: `backend/edge-function-delete-account.md`)
- **Chamador:** página Perfil (`fetch` direto para `/functions/v1/delete-account` com Bearer). (Fonte: `frontend/pages/perfil.md`)
- **Fato:** a operação não é transacional — falha em etapa posterior deixa etapas anteriores já executadas. (Fonte: `backend/edge-function-delete-account.md`)

## Background Jobs

- **Mecanismo:** `src/shared/background-jobs.ts` — `recordBackgroundJobExecution(client, input)` faz o INSERT em `background_job_executions` com mapeamento camelCase → snake_case; union de status `"success" | "failure" | "partial"`. (Fonte: `backend/background-jobs.md`)
- **Único job implementado:** `keepalive` — Vercel Cron `0 12 * * *` UTC → `api/keepalive.ts` (Node) → ping `SELECT id FROM usuarios LIMIT 1` no banco do ambiente (`VERCEL_ENV`: prod → `meufenil`; senão → `meufenil-dev`) com service role → persistência (`job_key = "keepalive"`, run_id, environment, status, tempos, message, details). Falha na persistência é logada e não altera a resposta. (Fonte: `backend/api-keepalive.md`)
- **Resposta da rota:** 200/500 com `{ ok, runId, durationMs, projects: [projeto] }`; métodos GET/HEAD apenas (405 caso contrário). (Fonte: `backend/api-keepalive.md`)
- **Retenção:** trigger remove execuções com mais de 365 dias a cada INSERT. (Fonte: `database/triggers.md`)
- **Monitoramento:** painel admin (admin-only por RLS) com filtros por job/status/período e paginação server-side. (Fonte: `frontend/pages/admin.md`; FEAT-0012)
- **Testes:** `api/keepalive.test.ts` (4 cenários) e `src/shared/background-jobs.test.ts`. (Fonte: `backend/overview.md` — testes de backend)

## CLI Interna

`node scripts/cli/index.js <comando> [--flags]` (ou `npm run cli -- ...`) — ferramentas locais de diagnóstico e gestão do banco (Fonte: `backend/cli.md`):

| Comando | Função | Escrita? | Observações |
|---|---|---|---|
| `list --table T [--select c] [--limit 20] [--order c] [--desc]` | SELECT com projeção/limite/ordenação | não | limit default 20 |
| `diag [--table T]` | contagem de linhas (default `referencias`) | não | `count: exact` |
| `seed-referencia --nome N --fenil F --criado-por UUID --confirm` | INSERT de referência pessoal (`is_global: false`) | sim | exige `--confirm` |
| `login-oauth [--provider google] [--port 54321]` | fluxo OAuth local, salva JWT em `.cli-token` | grava arquivo local | — |
| `run-sql --file .cli-sql --confirm --service-role --i-understand-rls [--transaction]` | executa SQL via conexão `pg` direta | sim (arbitrário) | `--transaction` envolve em BEGIN/COMMIT com ROLLBACK em erro |

- **Modos de conexão:** cliente Supabase anon (+JWT de `.cli-token`), cliente Supabase service role (`--service-role --i-understand-rls` obrigatórios) ou conexão PostgreSQL direta (`run-sql`). (Fonte: `backend/cli.md`)
- **Ambiente:** `.env.development` por padrão (`NODE_ENV=production` → `.env.production`; `ENV_FILE` explícito). (Fonte: `backend/cli.md`)
- **Erros:** mensagens pt-BR; `index.js` imprime `[cli] erro: <mensagem>` com `exitCode = 1`. (Fonte: `backend/cli.md`)
- **Sem testes** identificados para a CLI. (Fonte: `backend/cli.md`)

## Migrations

### Sistema atual (Supabase CLI)

Migrations em `supabase/migrations/` (Fonte: `database/overview.md`):

| Migration | Conteúdo |
|---|---|
| `20260103015052_remote_schema.sql` | Baseline (`supabase db pull`): 4 tabelas, 5 funções, 2 triggers, ~20 políticas, extensões, grants |
| `20260807000000_background_job_executions.sql` | Enum `background_job_status`, tabela `background_job_executions`, 3 índices, trigger de retenção |
| `20260810000000_background_job_monitoring.sql` | Função `is_admin_user` + política admin de consulta aos jobs |
| `20260811210456_fix_security_rls_rpc.sql` | Correções de segurança: drop de `debug_allow_all`, `admin_can_select_all_usuarios`, endurecimento dos RPCs de referências |
| `20260814000000_baseline_objetos_nao_versionados.sql` | DEBT-0001: baseline idempotente de objetos sem DDL versionado (delegacoes_acesso, referencias_favoritas, `is_ativa`, consolidação de políticas) |
| `20260815000000_limite_diario_default_500.sql` | DEBT-0002: trigger deixa de definir limite; default da coluna (500) vale para novos usuários |

### Legado (raiz `migrations/`)

`usuarios.sql`, `referencias.sql`, `registros.sql`, `exames_pku.sql` (2025-12-28) e `dados.sql` (seed ANVISA com 2.958 INSERTs, 2026-01-01) — snapshot antigo, sem o estado atual de políticas. (Fonte: `database/overview.md`)

### Fluxo de aplicação

1. `scripts/apply-supabase-migrations.sh --env development|production` (valida o valor; nunca os dois juntos; produção exige digitar `PRODUCTION`). (Fonte: `backend/cli.md`)
2. Extrai a senha de `SUPABASE_DATABASE_URL` (ou `SUPABASE_DB_PASSWORD`).
3. `supabase link --project-ref` → `migration repair <baseline 20260103015052> --status applied` → `supabase db push`. (Fonte: `backend/cli.md`)

### Ambientes

- Estrutura lógica idêntica dev × prod (7 tabelas, 52 colunas, 31 políticas, 10 funções, 1 enum, 3 triggers em `public` + 1 em `auth.users`). (Fonte: `database/overview.md`)
- Diferenças conhecidas: extensão `pg_graphql` só em dev; coluna dropped em `referencias` (posição física 8) só em prod. (Fonte: `database/overview.md`; `security/secrets-and-environments.md`)
