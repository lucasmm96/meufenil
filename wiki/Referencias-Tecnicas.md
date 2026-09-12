# Referências Técnicas

Detalhamento técnico do MeuFenil para desenvolvedores e operadores: banco de dados, edge functions, background jobs, CLI interna e migrations. Toda informação tem origem nas specs de `current/` e no código do repositório.

## Sumário

- [Banco de Dados](#banco-de-dados)
- [Edge Functions](#edge-functions)
- [Background Jobs](#background-jobs)
- [Sincronização de referências (FEAT-0017)](#sincronizacao-de-referencias-feat-0017)
- [CLI Interna](#cli-interna)
- [Migrations](#migrations)

## Banco de Dados

PostgreSQL (Supabase). **Dev (pós-FEAT-0017 M1–M6):** **12 tabelas**, RLS habilitado em todas, **36 políticas** (31 legadas + 5 `admin_select_*`), **15 funções** e **4 triggers** (3 em `public` + 1 em `auth.users`), **5 enums** (1 pré-existente + 4 de sync). **Prod (pós-release v1.11.0, 2026-09-10):** mesma estrutura do dev; `fenil_mg_por_100g` ainda `numeric(10,1)` até a aplicação da migration 20260911000000 em prod. (Fonte: `database/overview.md`)

### Tabelas e colunas principais

**`usuarios`** — perfil do usuário; `id` (PK, FK → `auth.users(id)` ON DELETE CASCADE), `nome`, `email` (UNIQUE), `role` (default `'user'`; `'admin'` = privilégios), `limite_diario_mg` (default **500**), `timezone` (default `America/Sao_Paulo`), `consentimento_lgpd_em`, `pode_recuperacao` (boolean default `false` — FEAT-0017 M5, dev; concedida manualmente pelo dono do projeto; admin E flag habilitam recuperação de sync). (Fonte: `database/usuarios.md`)

**`referencias`** — alimentos com fenilalanina por 100g; `id`, `nome`, `marca` (text default `''` — desde a ENH-0004; `''` = marca NÃO declarada; `'Produto In Natura'` é marca declarada pela fonte, 97 em dev), `fenil_mg_por_100g` (numeric(10,2) — dev desde 2026-09-11; prod: numeric(10,1) até a aplicação da migration 20260911000000), `criado_por` (FK → `usuarios` CASCADE), `is_global` (default false), `is_ativa` (default true — soft delete). Modelo canônico (ENH-0004): identidade substantiva `(nome, marca, fenil_mg_por_100g)` **imutável por UPDATE para globais** (mudar = arquivar a atual + criar a nova); índice único parcial `referencias_identidade_ativa_unique` (`lower(trim(nome))`, `lower(trim(marca))`, `fenil_mg_por_100g`) **WHERE `is_ativa`**; coluna `nome_normalizado` **eliminada**; globais nunca são excluídas fisicamente (arquivamento sempre — BR-037). Ordem física em dev: `marca` imediatamente após `nome`. (Fonte: `database/referencias.md`)

**`registros`** — consumo diário; `id`, `data`, `usuario_id` (FK → `usuarios`, **sem** CASCADE), `referencia_id` (FK → `referencias`, sem CASCADE), `peso_g`, `fenil_mg` (calculado na UI). Sem política de UPDATE: registros não são editáveis, apenas criados/excluídos. (Fonte: `database/registros.md`)

**`exames_pku`** — exames laboratoriais; `id`, `usuario_id` (FK → `usuarios` CASCADE), `data_exame`, `resultado_mg_dl`. (Fonte: `database/exames_pku.md`)

**`referencias_favoritas`** — favoritos N:N; `id`, `usuario_id` (FK CASCADE), `referencia_id` (FK CASCADE); índice único por par (usuario, referência). Desativação/arquivamento **NÃO remove favoritos** desde a ENH-0004 (trigger eliminado) — a referência arquivada permanece favoritada, é exibida como inativa, não pode ser usada em novos registros e pode ser desfavoritada normalmente. (Fonte: `database/referencias_favoritas.md`)

**`delegacoes_acesso`** — delegação por par; `id`, `concedente_id`, `delegado_id` (FKs → `usuarios` CASCADE), `created_at`, `revoked_at` (não-nulo = revogada); índice único parcial `(concedente_id, delegado_id) WHERE revoked_at IS NULL` — no máximo uma delegação ativa por par. (Fonte: `database/delegacoes_acesso.md`)

**`background_job_executions`** — execuções de jobs; `id`, `run_id`, `job_key`, `environment` (`prod`/`dev`), `status` (enum), `started_at`/`finished_at` (CHECK `finished_at >= started_at`), `duration_ms` (CHECK ≥ 0), `message`, `details` (jsonb), `created_at`; 3 índices; sem FK. (Fonte: `database/background_job_executions.md`)

**Tabelas de sincronização (FEAT-0017 M1 — migration `20260905000000`, dev e prod desde a release v1.11.0)** (Fonte: `database/overview.md`, specs dedicadas de cada tabela):

**`referencia_syncs`** — 1 linha por execução da sincronização. Colunas-chave: `environment` (base do single-flight: índice parcial `WHERE status = 'running'`), `trigger_source`, `requested_by` (FK `usuarios` SET NULL), `bootstrap` (1ª sync confiável — modo `bootstrap` do plano), `status` (enum `sync_status`: `running`/`success`/`pending_review`/`failure`/`origin_invalid`/`reverted`), `started_at`/`finished_at`, contadores (`total_origem`, `equivalentes`, `criadas`, `arquivadas`, `divergencias`), `message`, `details` (jsonb), `alteracoes` (jsonb — log estruturado por operação, base do rollback seletivo). (Fonte: `database/referencia_syncs.md`)

**`referencia_sync_pendencias`** — divergências abertas para curadoria humana (admin). Colunas-chave: `sync_id` (FK RESTRICT), `tipo` (enum `sync_pendencia_tipo`: `substitution` = global ativa com mudança substantiva na origem → arquivar + criar; `absence` = ativa ausente da origem; `new_item` = presente na origem, fora do catálogo ativo), `referencia_id` (FK SET NULL — ausente em `new_item`), `proposta` (jsonb), `diff` (jsonb), `status` (enum `sync_pendencia_status`: `open`/`approved`/`rejected`/`cancelled`), `motivo` (obrigatório na rejeição — CHECK), `decided_by` (FK SET NULL). (Fonte: `database/referencia_sync_pendencias.md`)

**`referencia_eventos`** — auditoria de eventos da sync e de mudanças manuais de `is_ativa`. Colunas-chave: `sync_id`/`pendencia_id`/`referencia_id` (FKs RESTRICT/SET NULL), `tipo` (enum `sync_evento_tipo` com 14 valores: `sync_started`, `extraction`, `validation`, `snapshot_created`, `backup_created`, `referencia_criada`, `referencia_arquivada`, `mudanca_aprovada`, `mudanca_rejeitada`, `is_ativa_manual`, `rollback`, `restore`, `pendencia_cancelada`, `pre_sync_inativa`), `actor_id` (FK SET NULL — admin, ator Sistema ou NULL no seed pré-auditoria), `detalhes` (jsonb). (Fonte: `database/referencia_eventos.md`)

**`referencia_snapshots`** — uma por execução; `sync_id` (FK RESTRICT), `payload` (jsonb — payload decodificado exato da origem), `payload_sha256` (hash de integridade), `contagem`, `created_at`. (Fonte: `database/referencia_snapshots.md`)

**`referencia_backups`** — backups pré-aplicação (base do rollback/restauração — M5); `sync_id` (FK RESTRICT), `payload` (jsonb — linhas completas das referências globais), `payload_sha256` (verificado na restauração), `contagem`, `created_at`. Retenção: trigger remove backups com mais de 12 meses. (Fonte: `database/referencia_backups.md`)

### RLS (resumo das políticas)

Padrões transversais (Fonte: `security/security-model.md` seção 8):

1. **Ownership:** `auth.uid() = <coluna dono>` (`usuarios.id`, `referencias.criado_por`, `registros.usuario_id`, `exames_pku.usuario_id`, `referencias_favoritas.usuario_id`).
2. **Delegação:** `EXISTS (delegacoes_acesso WHERE concedente_id = <dono> AND delegado_id = auth.uid() AND revoked_at IS NULL)` — usada por 15 policies ("dono ou delegado").
3. **Admin:** `is_admin_user(auth.uid())` ou `auth.jwt()->>'role' = 'admin'` (apenas em `referencias`).
4. **Visibilidade de referências:** `is_global = true OR criado_por = auth.uid()` (+ variante delegado).
5. **Invariantes de negócio no RLS:** INSERT de registro exige referência ativa; DELETE de referência bloqueado com registros vinculados; remoção de global só por admin.
6. **Sync (FEAT-0017):** as 5 tabelas de sincronização têm apenas policies `admin_select_*` (SELECT por admin) — as escritas ocorrem exclusivamente via RPCs (service_role para aplicação; admin para curadoria/recuperação) ou ator Sistema.

Destaques factuais da matriz (Fonte: `security/security-model.md` seção 3):

- Admin **não** tem acesso RLS a `registros`, `exames_pku`, `referencias_favoritas` e `delegacoes_acesso` — o painel admin usa o RPC `get_estatisticas_admin` para números agregados (as tabelas de sync são a exceção, com `admin_select_*`).
- Anon (não autenticado) consegue listar referências globais (`is_global = true`).
- `delegacoes_acesso`: INSERT pelo concedente; UPDATE (revogação) pelo concedente; sem DELETE (revogação = UPDATE `revoked_at`).
- `background_job_executions`: apenas SELECT admin; escrita via service role (sem policies de INSERT).
- Não existe política UPDATE em `registros` nem em `referencias_favoritas`.

### RPCs (15 funções em `public` — dev pós-FEAT-0017 M1–M6)

| Função | Tipo | Autorização interna | Efeito |
|---|---|---|---|
| `ativar_referencia(uuid)` | negócio, SECURITY DEFINER (`search_path public`) | dono/delegado (pessoais); **global → somente admin** (migration 20260905020000) | `UPDATE referencias SET is_ativa = true`; retorna `'activated'` |
| `remover_ou_desativar_referencia(uuid)` | negócio, SECURITY DEFINER (`search_path public`) | dono/delegado; global → só admin | **globais:** sempre arquivamento (`'deactivated'`), nunca DELETE (BR-037); **pessoais:** soft (`'deactivated'`) se houver registros, hard (`'deleted'`) se não houver |
| `aplicar_sync_referencias(...)` | sync M4, SECURITY DEFINER (`search_path public`) | **EXECUTE exclusivo `service_role`** + guarda `auth.role() <> 'service_role'` → exceção | aplica o plano da sync em transação única (cria/arquiva globais como ator Sistema, abre pendências, registra eventos); passo de seed `pre_sync_inativa` em modo `bootstrap` (M6) |
| `decidir_pendencia_referencia(...)` | sync M4 (curadoria), SECURITY DEFINER | EXECUTE `authenticated`; guarda `NOT is_admin_user` → exceção (**service_role fora** — ação humana) | aprova/rejeita pendência; aprovação aplica a mudança (substitution arquiva + cria); rejeição exige `motivo` |
| `reverter_sync_referencias(...)` | sync M5 (rollback), SECURITY DEFINER | EXECUTE `authenticated`; guarda `pode_operar_recuperacao` → exceção (nunca automatizada) | rollback seletivo da última sync aplicada — aplica as inversas das `alteracoes` em ordem reversa, com guarda por operação |
| `restaurar_referencias_de_backup(...)` | sync M5 (restauração), SECURITY DEFINER | EXECUTE `authenticated`; guarda `pode_operar_recuperacao` → exceção (nunca automatizada) | restauração excepcional: conjunto global volta a refletir o backup (integridade `payload_sha256` verificada antes; nunca DELETE; não toca pessoais) |
| `pode_operar_recuperacao(uuid)` | autorização, SECURITY DEFINER | — (função de verificação) | `EXISTS (usuarios WHERE id = uid AND role = 'admin' AND pode_recuperacao)` — admin E flag |
| `is_admin_user(uuid)` | autorização, SECURITY DEFINER | — (função de verificação) | retorna `EXISTS (usuarios WHERE id = uid AND role = 'admin')` |
| `get_estatisticas_admin()` | consulta admin, SECURITY DEFINER | **sem** verificação interna | tamanho do banco (MB) + contagens de registros/referências |
| `dashboard_hoje(uuid)` | consulta, SECURITY DEFINER **sem** search_path | **sem** verificação — aceita qualquer `uid` | soma do dia + limite (RPC órfã: sem chamadores) |
| `dashboard_ultimos_dias(uuid, integer)` | consulta, SECURITY DEFINER **sem** search_path | **sem** verificação | soma por dia (RPC órfã: sem chamadores) |
| `handle_new_user()` | trigger, SECURITY DEFINER | — | cria perfil em `usuarios` no sign-up (não define mais o limite — default da coluna = 500) |
| `fn_trim_background_job_executions()` | trigger, SECURITY DEFINER | — | retenção: remove execuções de job > 365 dias a cada INSERT |
| `fn_auditar_is_ativa_manual()` | trigger (FEAT-0017 M1), SECURITY DEFINER | — | auditoria de mudança **manual** de `is_ativa` (WHEN `auth.uid()` não-nulo; registra só admin com GUC `app.audit_origin` ≠ `'curadoria'` — escritas de sync M4/M5 não geram evento) |
| `fn_trim_referencia_backups()` | trigger (FEAT-0017 M1), SECURITY DEFINER | — | retenção: remove backups de sync > 12 meses a cada INSERT |

(Fonte: `database/rpc.md`; `security/security-model.md` seções 7, 10–12)

Chamadores no código: `ativar_referencia` e `remover_ou_desativar_referencia` → `src/react-app/services/referencias.service.ts`; `get_estatisticas_admin` → `src/react-app/services/admin.service.ts`; curadoria/rollback/restauração → `src/react-app/services/referencias-sync.service.ts` (UI do Admin, M6). (Fonte: `database/rpc.md`)

### Triggers (dev — 4)

| Trigger | Tabela | Evento | Função | Finalidade |
|---|---|---|---|---|
| `trg_trim_background_job_executions` | `background_job_executions` | AFTER INSERT (statement) | `fn_trim_background_job_executions` | retenção de 365 dias |
| `trg_auditar_is_ativa_manual` | `referencias` | AFTER UPDATE OF `is_ativa` | `fn_auditar_is_ativa_manual` | auditoria de mudança manual de `is_ativa` (FEAT-0017 M1) |
| `trg_trim_referencia_backups` | `referencia_backups` | AFTER INSERT | `fn_trim_referencia_backups` | retenção de 12 meses (FEAT-0017 M1) |
| `on_auth_user_created` | `auth.users` | AFTER INSERT | `handle_new_user` | cria perfil no sign-up |

Os triggers `trg_normalizar_nome_referencia` e `trg_remover_favoritos_referencia_inativa` foram **eliminados na ENH-0004** (dev — migration 20260904000000; prod — release v1.11.0). (Fonte: `database/triggers.md`)

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
- **Único job com persistência própria:** `keepalive` — Vercel Cron `0 12 * * *` UTC → `api/keepalive.ts` (Node) → ping `SELECT id FROM usuarios LIMIT 1` em **dois alvos por execução** (independente de `VERCEL_ENV`): prod (`meufenil`, credenciais `KEEPALIVE_SUPABASE_URL`/`KEEPALIVE_SUPABASE_SERVICE_ROLE_KEY` com fallback em `VITE_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_URL`) e dev (`meufenil-dev`, credenciais `KEEPALIVE_DEV_SUPABASE_URL`/`KEEPALIVE_DEV_SUPABASE_SERVICE_ROLE_KEY` — **obrigatórias, sem fallback**; DEBT-0006: o fallback histórico apontaria para o banco de PRODUÇÃO). Pings em `Promise.allSettled`; persistência **por alvo no próprio banco de cada alvo** (`job_key = "keepalive"`, mesmo `run_id`, `environment` `prod`/`dev`, status success/failure, tempos, message, details). Falha na persistência é logada e não altera a resposta. (Fonte: `backend/api-keepalive.md`)
- **Resposta da rota:** 200 apenas se os dois alvos responderam; 500 se qualquer alvo falhou — `{ ok, runId, durationMs, projects: [...] }`; métodos GET/HEAD apenas (405 caso contrário). (Fonte: `backend/api-keepalive.md`)
- **Retenção:** trigger remove execuções com mais de 365 dias a cada INSERT. (Fonte: `database/triggers.md`)
- **Monitoramento:** painel admin (admin-only por RLS) com filtros por job/status/período, seletor de tamanho de página e paginação server-side. (Fonte: `frontend/pages/admin.md`; FEAT-0012)
- **Testes:** `api/keepalive.test.ts` (5 cenários — inclui os dois alvos) e `src/shared/background-jobs.test.ts`. (Fonte: `backend/overview.md` — testes de backend; `backend/api-keepalive.md`)
- **Fora deste mecanismo:** a sincronização semanal de referências (FEAT-0017) usa a mesma plataforma Vercel Cron mas tem **tabela própria** (`referencia_syncs`) e não grava em `background_job_executions` — o trim de 365 dias da BR-027 não se aplica a ela. (Fonte: FEAT-0017; `backend/api-referencias-sync.md`)

## Sincronização de referências (FEAT-0017)

- **Origem:** relatório Power BI associado à ANVISA — extração via `src/shared/powerbi/` (client da API com `POWERBI_RESOURCE_KEY`, nunca hardcoded) + validação de payload (contrato: conjunto global, chaves obrigatórias, integridade). (Fonte: `backend/api-referencias-sync.md`)
- **Rota:** `api/referencias-sync.ts` (Vercel) — GET (cron semanal `0 12 * * 1` UTC) exige `Authorization: Bearer ${CRON_SECRET}` (comparação timing-safe) e só dispara no deployment de produção → alvo sempre `prod`; POST manual exige JWT de admin (assina `requested_by`) e está disponível em **dev e prod** (revisão R4-1, 2026-09-08). O `environment` da sync é o do deployment em que a rota roda — `ambienteAlvo()` deriva de `VERCEL_ENV` (`production` → `prod`; `preview`/`development`, incl. `vercel dev`, → `dev`; sem env dedicada — os escopos das `REFERENCIAS_SYNC_*` mudam junto). Envs: `REFERENCIAS_SYNC_SUPABASE_URL` / `REFERENCIAS_SYNC_SUPABASE_SERVICE_ROLE_KEY` (credenciais service role do banco do deployment — dedicadas, obrigatórias, sem fallback), `CRON_SECRET`, `POWERBI_RESOURCE_KEY`. (Fonte: `backend/api-referencias-sync.md`; `security/secrets-and-environments.md`)
- **Estágios (8):** 1) claim single-flight (`referencia_syncs` com status `running` no ambiente — índice parcial; segunda execução simultânea é rejeitada) → 2) extração (Power BI) → 3) validação → 4) snapshot (payload exato + sha256) → 5) backup pré-aplicação (globais + sha256) → 6) comparação (motor puro `src/shared/referencias-sync/` — canonical/compare/engine: equivalentes, criadas, arquivadas, divergências) → 7) aplicação via RPC `aplicar_sync_referencias` (service_role, transação única; criadas/arquivadas como **ator Sistema** `sistema@meufenil.local` — conta banida, sem sessão) → 8) conclusão (`success` ou `pending_review` quando há pendências; `origin_invalid` se a origem falhou validação). Modos: `bootstrap` (1ª sync confiável do ambiente — inclui seed `pre_sync_inativa` de globais inativas sem evento de auditoria) e `pos_bootstrap`. (Fonte: `backend/api-referencias-sync.md`; FEAT-0017)
- **Curadoria humana:** divergências viram pendências (`substitution`/`absence`/`new_item`) decididas por admin no painel Admin (M6) via `decidir_pendencia_referencia` — aprovação aplica; rejeição exige motivo. (Fonte: FEAT-0017; `database/rpc.md`)
- **Recuperação excepcional:** `reverter_sync_referencias` (rollback seletivo da última sync aplicada) e `restaurar_referencias_de_backup` (restauração integral a partir do backup, com verificação de integridade) — exclusivas de admin E `usuarios.pode_recuperacao` (flag concedida manualmente pelo dono do projeto; nunca automatizadas). (Fonte: FEAT-0017 M5; `database/rpc.md`)
- **Ator Sistema:** identidade real no Supabase Auth (`sistema@meufenil.local`, banida/sem sessão), provisionada por `scripts/provisionar-ator-sistema.js`; autora das escritas automáticas de sync (criações/arquivamentos) — `referencia_eventos.actor_id` registra a origem em cada evento. (Fonte: FEAT-0017; `security/security-model.md` seção 10)
- **Testes:** `api/referencias-sync.test.ts`, `src/shared/referencias-sync/canonical/compare/engine/validate.test.ts` e suítes de segurança `rpc-referencias-sync*.test.ts` (aplicação/curadoria, rollback, seed) contra o banco development. (Fonte: `system-map.md` — linha FEAT-0017)

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

Migrations em `supabase/migrations/` — da baseline ao FEAT-0017 M6; as migrations 2026-09 estão aplicadas **somente em dev** (prod aguarda a release) (Fonte: `database/overview.md`):

| Migration | Conteúdo |
|---|---|
| `20260103015052_remote_schema.sql` | Baseline (`supabase db pull`): 4 tabelas, 5 funções, 2 triggers, ~20 políticas (com duplicatas), extensões, grants e default privileges |
| `20260807000000_background_job_executions.sql` | Enum de status, tabela `background_job_executions`, 3 índices, trigger de retenção |
| `20260810000000_background_job_monitoring.sql` | Função `is_admin_user` + política admin de consulta aos jobs |
| `20260811210456_fix_security_rls_rpc.sql` | Correções de segurança: drop de `debug_allow_all`, `admin_can_select_all_usuarios`, endurecimento dos RPCs de referências |
| `20260814000000_baseline_objetos_nao_versionados.sql` | DEBT-0001: baseline idempotente de objetos sem DDL versionado (`delegacoes_acesso`, `referencias_favoritas`, `referencias.is_ativa`, função/trigger de favoritos; consolidação das políticas RLS — cria 27 vigentes, remove as obsoletas) |
| `20260815000000_limite_diario_default_500.sql` | DEBT-0002: `handle_new_user` deixa de definir `limite_diario_mg` — default da coluna (500) vale para novos usuários |
| `20260904000000_referencias_marca_identidade_imutavel.sql` | **ENH-0004:** coluna `marca`, `nome_normalizado` eliminada, `fenil_mg_por_100g` → `numeric(10,1)`, backfill do sufixo `(Marca: ...)` do nome, triggers de normalização e de favoritos eliminados, RPC `remover_ou_desativar_referencia` redefinida (globais sempre arquivam), índice único parcial `referencias_identidade_ativa_unique` |
| `20260904010000_referencias_marca_backfill_aninhados.sql` | ENH-0004 (complemento): backfill de 4 linhas com parênteses aninhados na marca |
| `20260904020000_referencias_marca_correcao_wrapper.sql` | Correção pós-merge (bug ENH-0004): re-extração do invólucro literal `(Marca: X)` em 2.955 linhas de dev (total 3.164 preservado, 0 residuais, 0 duplicatas) |
| `20260904030000_referencias_marca_sem_marca_em_branco.sql` | Canônico revisto: default da coluna → `''`; `'Produto In Natura'` mantido só onde a planilha ANVISA declara in natura (97 em dev; 222 em branco) |
| `20260904040000_referencias_marca_apos_nome.sql` | Reordenação física: `marca` imediatamente após `nome` (tabela recriada; PK/FK/RLS/policies/grants recriados idênticos; 3.164 linhas preservadas; ao rodar em prod elimina a coluna dropped da posição 8) |
| `20260905000000_referencias_sync_tabelas.sql` | **FEAT-0017 M1:** 5 tabelas de sincronização, 4 enums (`sync_status`, `sync_pendencia_status`, `sync_pendencia_tipo`, `sync_evento_tipo`), função/trigger `trg_trim_referencia_backups` (retenção 12 meses) e 5 policies `admin_select_*` |
| `20260905010000_referencias_sync_auditoria_is_ativa.sql` | FEAT-0017 M1: função/trigger `trg_auditar_is_ativa_manual` (auditoria da mudança manual de `is_ativa`; escritas automáticas de sync não geram evento) |
| `20260905020000_referencias_ativar_global_somente_admin.sql` | FEAT-0017 M1 (R4-3): `ativar_referencia` — reativação de global passa a exigir admin |
| `20260906000000_referencias_sync_aplicacao_curadoria.sql` | FEAT-0017 M4: RPCs `aplicar_sync_referencias` (EXECUTE só `service_role`) e `decidir_pendencia_referencia` (EXECUTE `authenticated` + guarda de admin) |
| `20260906010000_referencias_sync_rollback_restauracao.sql` | FEAT-0017 M5: coluna `usuarios.pode_recuperacao`, helper `pode_operar_recuperacao` e RPCs `reverter_sync_referencias` / `restaurar_referencias_de_backup` (EXECUTE só `authenticated` + guarda de admin E flag) |
| `20260907000000_referencias_sync_seed_pre_sync_inativa.sql` | FEAT-0017 M6: `CREATE OR REPLACE` de `aplicar_sync_referencias` com passo de seed condicionado a `p_plano.modo = 'bootstrap'` (1 evento `pre_sync_inativa` por global inativa sem evento de auditoria) |

### Legado (raiz `migrations/`)

`usuarios.sql`, `referencias.sql`, `registros.sql`, `exames_pku.sql` (2025-12-28) e `dados.sql` (seed ANVISA com **2.959 INSERTs**, 2026-01-01; contagem conferida em 2026-09-04 — as specs que citavam 2.958 estavam incorretas) — snapshot antigo, sem o estado atual de políticas. (Fonte: `database/overview.md`)

### Fluxo de aplicação

1. `scripts/apply-supabase-migrations.sh --env development|production` (valida o valor; nunca os dois juntos; produção exige digitar `PRODUCTION`). (Fonte: `backend/cli.md`)
2. Extrai a senha de `SUPABASE_DATABASE_URL` (ou `SUPABASE_DB_PASSWORD`).
3. `supabase link --project-ref` → `migration repair <baseline 20260103015052> --status applied` → `supabase db push`. (Fonte: `backend/cli.md`)

### Ambientes

- Estrutura lógica **idêntica dev × prod até 2026-08-14** (7 tabelas, 52 colunas, 19 constraints, 15 índices, 31 políticas, 10 funções, 1 enum, 3 triggers em `public` + 1 em `auth.users` — contagens corrigidas no catálogo). (Fonte: `database/overview.md`)
- **Divergência desde 2026-09-04** (dev aplicou ENH-0004 + FEAT-0017 M1–M6; prod aguarda a release): dev tem 12 tabelas/36 políticas/15 funções/5 enums e schema de `referencias` com `marca` (sem `nome_normalizado`, sem os 2 triggers antigos); prod segue no modelo antigo. O trem de release `20260904000000 → 040000` entrega prod já no layout final (a última migration elimina a coluna dropped da posição física 8 de `referencias`, artefato de ADD+DROP — nome original `[UNKNOWN]`). (Fonte: `database/overview.md`; `database/referencias.md`)
- Diferença pré-existente: extensão `pg_graphql` só em dev. (Fonte: `database/overview.md`)
