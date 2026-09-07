# Database — Visão Geral

**Última verificação:** 2026-09-07 (FEAT-0017 M1–M6 — migrations 20260905*/20260906*/20260907000000 aplicadas em dev; prod segue no schema pré-ENH-0004 até a release)

## Propósito

Este diretório documenta o estado REAL do banco de dados PostgreSQL (Supabase) do MeuFenil — tabelas, funções, triggers e políticas RLS — conforme observado nos bancos development e production, complementado pelas migrations versionadas e pelo código que interage com o banco. Desde 2026-09-04, dev e prod DIVERGEM: dev recebeu a ENH-0004 (coluna `marca`, identidade imutável de referências, ordem física das colunas — 2026-09-04) e o FEAT-0017 M1–M6 (tabelas de sincronização, auditoria de `is_ativa`, RPCs de aplicação/curadoria e de recuperação — 2026-09-06; seed de bootstrap na aplicação — 2026-09-07); prod segue no schema pré-ENH-0004 até a release (migrations novas em branch de trabalho; promoção segue gate de release) `[INFERRED: migrations não aplicadas em prod; release ainda não criada]`. As seções abaixo descrevem o estado dev pós-FEAT-0017 M1–M6 quando não indicado.

## Organização deste diretório

| Arquivo | Conteúdo |
|---|---|
| `overview.md` | Este arquivo — inventário, convenções, migrations, ambientes |
| `usuarios.md` ... `referencia_backups.md` | Uma spec por tabela (T1) — 12: 7 legadas + 5 de sync do FEAT-0017 (promoção M7, 2026-09-07) |
| `rpc.md` | As 15 funções do schema `public` (T2) |
| `triggers.md` | Os 4 triggers (3 em `public` + 1 em `auth.users`; os 2 de `referencias` eliminados na ENH-0004, 2 criados pelo FEAT-0017 M1) |

## Inventário de tabelas (12 — 7 legadas + 5 do FEAT-0017 M1 em dev)

`[CONFIRMED: database — pg_tables dev 2026-09-06; dev e prod com 7 tabelas em 2026-08-13]`

| Tabela | Propósito curto | RLS | DDL versionado? |
|---|---|---|---|
| `usuarios` | Perfil do usuário (papel, limite diário, timezone, consentimento LGPD) | Sim | Sim (baseline) |
| `referencias` | Alimentos de referência com fenilalanina por 100g (globais ou do usuário); `nome` + `marca` separados desde a ENH-0004 | Sim | Sim (baseline) + coluna `is_ativa` (20260814) + modelo canônico ENH-0004 (20260904) |
| `registros` | Registro diário de consumo (peso e fenilalanina) | Sim | Sim (baseline) |
| `exames_pku` | Exames de PKU do usuário | Sim | Sim (baseline) |
| `referencias_favoritas` | Favoritos do usuário | Sim | Sim (20260814) |
| `delegacoes_acesso` | Delegação de acesso entre usuários | Sim | Sim (20260814) |
| `background_job_executions` | Execuções de jobs em background | Sim | Sim (20260807) |

### Tabelas de sincronização de referências (FEAT-0017 M1 — migration 20260905000000; somente dev)

`[CONFIRMED: database — pg_tables dev 2026-09-06]`. Usadas pela rota `api/referencias-sync.ts` (M2–M4) e RPCs (M4/M5); RLS/policies em cada página e no [security-model](../security/security-model.md) §11. Página própria por tabela (promoção M7, 2026-09-07).

| Tabela | Propósito curto | RLS | DDL versionado? |
|---|---|---|---|
| [`referencia_syncs`](referencia_syncs.md) | Execuções da sincronização (status, modo, contadores, `alteracoes` jsonb) | Sim | Sim (20260905000000) |
| [`referencia_sync_pendencias`](referencia_sync_pendencias.md) | Divergências abertas para curadoria (decisão humana por admin) | Sim | Sim (20260905000000) |
| [`referencia_eventos`](referencia_eventos.md) | Auditoria de eventos da sync e de mudanças manuais de `is_ativa` | Sim | Sim (20260905000000; trigger de auditoria em 20260905010000) |
| [`referencia_snapshots`](referencia_snapshots.md) | Snapshots da extração (uma por execução) | Sim | Sim (20260905000000) |
| [`referencia_backups`](referencia_backups.md) | Backups pré-aplicação (base do rollback/restauração — M5); retenção 12m | Sim | Sim (20260905000000) |

## Convenções observadas no schema

- IDs `uuid` com default `gen_random_uuid()` em todas as tabelas, exceto `usuarios.id`, que referencia `auth.users.id` `[CONFIRMED: database]`.
- `snake_case`; colunas `created_at`/`updated_at` com default `now()` — nullable nas tabelas do baseline, NOT NULL nas tabelas mais novas `[CONFIRMED: database]`.
- **RLS habilitado em TODAS as tabelas** — dev: 12 (inclui as 5 de sync do FEAT-0017 M1); prod: 7 até a release `[CONFIRMED: database — pg_class.relrowsecurity = true; catálogo dev 2026-09-06]`.
- **Grants amplos**: `anon`, `authenticated` e `service_role` possuem SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER em todas as tabelas (dev: 12 — as 5 de sync nasceram com grants do default privileges do Supabase); a restrição efetiva de acesso é o RLS `[CONFIRMED: database — role_table_grants]`. Nas tabelas de sync a leitura é limitada a admin (policies `admin_select_*` — ver [security-model](../security/security-model.md) §11).
- Funções de segurança usam `SECURITY DEFINER` + `SET search_path TO 'public'` (`is_admin_user`, `ativar_referencia`, `remover_ou_desativar_referencia`, `fn_trim_background_job_executions`, `get_estatisticas_admin` e as do FEAT-0017: M1 `fn_auditar_is_ativa_manual`/`fn_trim_referencia_backups`, M4 `aplicar_sync_referencias`/`decidir_pendencia_referencia`, M5 `pode_operar_recuperacao`/`reverter_sync_referencias`/`restaurar_referencias_de_backup`). `dashboard_hoje`, `dashboard_ultimos_dias` e `handle_new_user` são `SECURITY DEFINER` **sem** `search_path` configurado `[CONFIRMED: database — pg_proc.proconfig, 2026-09-06]`.
- Não há views, sequences nem tabelas na publication `supabase_realtime` para o schema `public` `[CONFIRMED: database]`.

## Migrations

### Dois locais distintos

1. **`migrations/` (raiz) — legado pré-Supabase-CLI.** `usuarios.sql`, `referencias.sql`, `registros.sql`, `exames_pku.sql` (commit `b10dc49`, 2025-12-28) e `dados.sql` (seed ANVISA com 2.959 INSERTs em `referencias`, commit `cb9fae6`, 2026-01-01; contagem conferida por `grep -c 'INSERT INTO "public"."referencias"'` em 2026-09-04 — as specs que citavam 2.958 estavam incorretas). Snapshot de schema da época; não contém o estado atual de políticas.
2. **`supabase/migrations/` — sistema atual (Supabase CLI):**

| Migration | Data (git) | Conteúdo |
|---|---|---|
| `20260103015052_remote_schema.sql` | 2026-01-02 | Baseline (`supabase db pull`): 4 tabelas, 5 funções, 2 triggers, ~20 políticas (com duplicatas), extensões, grants e default privileges |
| `20260807000000_background_job_executions.sql` | 2026-08-06 | Enum `background_job_status`, tabela `background_job_executions`, 3 índices, trigger de retenção |
| `20260810000000_background_job_monitoring.sql` | 2026-08-11 | Função `is_admin_user` + política admin de consulta aos jobs |
| `20260811210456_fix_security_rls_rpc.sql` | 2026-08-11 | Correções de segurança: drop `debug_allow_all`, política `admin_can_select_all_usuarios`, endurecimento de `ativar_referencia` e `remover_ou_desativar_referencia` |
| `20260814000000_baseline_objetos_nao_versionados.sql` | 2026-08-14 | **DEBT-0001:** baseline idempotente dos objetos sem DDL versionado — tabelas `delegacoes_acesso` e `referencias_favoritas`, coluna `referencias.is_ativa`, função/trigger de favoritos, consolidação das políticas RLS (cria 27 vigentes + remove as obsoletas do baseline) |
| `20260815000000_limite_diario_default_500.sql` | 2026-08-15 | **DEBT-0002:** `handle_new_user` deixa de definir `limite_diario_mg` no sign-up — default da coluna (500) passa a valer para novos usuários |
| `20260904000000_referencias_marca_identidade_imutavel.sql` | 2026-09-04 | **ENH-0004:** coluna `marca` (default canônico `'Produto In Natura'` — REVOGADO em 2026-09-04 pela 030000, final = `''`), `nome_normalizado` eliminada, `fenil_mg_por_100g` → `numeric(10,1)`, backfill do sufixo `(Marca: ...)` do nome, triggers de normalização e de favoritos eliminados, RPC `remover_ou_desativar_referencia` redefinida (globais sempre arquivam), índice único parcial `referencias_identidade_ativa_unique` — aplicada em DEV em 2026-09-04; prod aguarda release |
| `20260904010000_referencias_marca_backfill_aninhados.sql` | 2026-09-04 | **ENH-0004 (complemento):** backfill de 4 linhas com parênteses aninhados na marca que o regex principal não capturou — aplicada em DEV em 2026-09-04; prod aguarda release |
| `20260904020000_referencias_marca_correcao_wrapper.sql` | 2026-09-04 | **Correção pós-merge (bug ENH-0004):** o backfill da 000000 usou `regexp_match` sem grupo de captura e gravou o invólucro literal `(Marca: X)` na coluna `marca`; re-extração do conteúdo em 2.955 linhas de dev (total 3.164 preservado, 0 residuais, 0 duplicatas) — aplicada em DEV em 2026-09-04; prod aguarda release |
| `20260904030000_referencias_marca_sem_marca_em_branco.sql` | 2026-09-04 | **Canônico de marca revisto (decisão do usuário 2026-09-04):** default da coluna `'Produto In Natura'` → `''`; "Em branco = Produto In Natura" revogada — sem marca declarada = `''`; `'Produto In Natura'` mantido só onde a planilha ANVISA declara in natura (97 em dev; 222 em branco; 3.164 preservado; 0 duplicatas) — aplicada em DEV em 2026-09-04; prod aguarda release |
| `20260904040000_referencias_marca_apos_nome.sql` | 2026-09-04 | **Reordenação física (decisão do usuário 2026-09-04):** `marca` imediatamente após `nome` também no schema (Postgres não tem ADD COLUMN AFTER — tabela recriada: rename → cópia com lista explícita → drop; 4 políticas cross-tabela de `registros`/`referencias_favoritas` dependiam da tabela por OID e foram dropadas/recriadas verbatim — 1ª aplicação falhou com 2BP01, corrigida e reaplicada). PK, FK, índice único parcial, RLS, 10 políticas da tabela, grants e FKs dos filhos recriados idênticos; verificação: 3.164 linhas preservadas, `marca` posição 3, segurança 28/28 — aplicada em DEV em 2026-09-04; prod aguarda release (última do trem 000000→040000, entrega prod já no layout final) |
| `20260905000000_referencias_sync_tabelas.sql` | 2026-09-06 | **FEAT-0017 M1:** 5 tabelas de sincronização (`referencia_syncs`, `referencia_sync_pendencias`, `referencia_eventos`, `referencia_snapshots`, `referencia_backups`), 4 enums (`sync_status`, `sync_pendencia_status`, `sync_pendencia_tipo`, `sync_evento_tipo`), função/trigger `trg_trim_referencia_backups` (retenção 12 meses) e 5 policies `admin_select_*` — aplicada em DEV em 2026-09-06; prod aguarda release |
| `20260905010000_referencias_sync_auditoria_is_ativa.sql` | 2026-09-06 | **FEAT-0017 M1:** função/trigger `trg_auditar_is_ativa_manual` — auditoria da mudança MANUAL de `is_ativa` em `referencias` (WHEN `auth.uid()` não-nulo; registra só admin com GUC `app.audit_origin` ≠ `'curadoria'` — escritas automáticas de sync M4/M5 não geram o evento) — aplicada em DEV em 2026-09-06; prod aguarda release |
| `20260905020000_referencias_ativar_global_somente_admin.sql` | 2026-09-06 | **FEAT-0017 M1 (R4-3):** `ativar_referencia` redefinida — reativação de referência GLOBAL passa a exigir admin (usuário comum só reativa pessoais) — aplicada em DEV em 2026-09-06; prod aguarda release |
| `20260906000000_referencias_sync_aplicacao_curadoria.sql` | 2026-09-06 | **FEAT-0017 M4:** RPCs `aplicar_sync_referencias` (SECURITY DEFINER; EXECUTE somente `service_role`) e `decidir_pendencia_referencia` (SECURITY DEFINER; EXECUTE `authenticated` com guarda interna de admin) — aplicada em DEV em 2026-09-06; prod aguarda release |
| `20260906010000_referencias_sync_rollback_restauracao.sql` | 2026-09-06 | **FEAT-0017 M5:** coluna `usuarios.pode_recuperacao` (default `false` — concedida manualmente pelo dono, nenhum fluxo de app auto-concede), helper `pode_operar_recuperacao` (admin E flag, formato de `is_admin_user`) e RPCs SECURITY DEFINER `reverter_sync_referencias` (rollback seletivo — inversas das `alteracoes` em ordem reversa com guarda por op) e `restaurar_referencias_de_backup` (restauração excepcional — conjunto global volta a refletir o backup; integridade sha256 verificada antes; nunca DELETE; não toca pessoais) — EXECUTE **somente `authenticated`** (guarda interna `pode_operar_recuperacao`) — aplicada em DEV em 2026-09-06; prod aguarda release |
| `20260907000000_referencias_sync_seed_pre_sync_inativa.sql` | 2026-09-07 | **FEAT-0017 M6:** `CREATE OR REPLACE` de `aplicar_sync_referencias` com passo de seed condicionado a `p_plano.modo = 'bootstrap'` (1ª sync confiável do ambiente): 1 evento `pre_sync_inativa` por global inativa SEM evento de auditoria (actor NULL — arquivamento manual pré-auditoria), na MESMA transação da aplicação; nenhum objeto novo — aplicada em DEV em 2026-09-07; prod aguarda release |

Aplicação via `scripts/apply-supabase-migrations.sh` (obrigatório `--env development|production`; nunca os dois juntos). Baseline: versão `20260103015052` `[CONFIRMED: code, script]`.

### Objetos que existiam SEM migration versionada (resolvido pela DEBT-0001)

Até 2026-08-13, os objetos abaixo existiam nos dois ambientes sem DDL em nenhuma migration (aplicados por canal não-versionado, origem `UNKNOWN`). A migration `20260814000000_baseline_objetos_nao_versionados.sql` (DEBT-0001) os versionou com DDL idempotente conferido contra o catálogo dos dois ambientes (2026-08-14); a aplicação em dev e prod foi um no-op (estado idêntico antes/depois, ver specs das tabelas):

| Objeto | Onde documentado |
|---|---|
| Tabela `delegacoes_acesso` | `delegacoes_acesso.md` |
| Tabela `referencias_favoritas` | `referencias_favoritas.md` |
| Coluna `referencias.is_ativa boolean NOT NULL default true` | `referencias.md` |
| Função `fn_remover_favoritos_referencia_inativa` + trigger `trg_remover_favoritos_referencia_inativa` | `rpc.md`, `triggers.md` (função e trigger eliminados na ENH-0004 — migration 20260904000000, aplicada em dev; ver seção Migrations abaixo) |
| Políticas "dono ou delegado" (registros, exames_pku, referencias, referencias_favoritas), políticas de `delegacoes_acesso`, "Inserir registro apenas com referencia ativa" | specs das respectivas tabelas |
| Consolidação das políticas do baseline (ex.: "usuario cria referencia" → "Usuário cria própria referencia"; remoção das duplicatas do baseline) | specs das respectivas tabelas |

A origem exata (canal de aplicação e datas) desses objetos é `UNKNOWN` — os commits de git associados às features (ex.: `d14b1de`, `e19f43a`, `2e6f540`) adicionaram apenas código, sem arquivo de migration correspondente `[CONFIRMED: git history; aplicação: UNKNOWN]`. O versionamento baseline NÃO estabelece a origem — apenas fixa o estado atual.

## Ambientes dev × prod

- **Estrutura lógica IDÊNTICA até 2026-08-14**: mesmas 7 tabelas, 52 colunas, 19 constraints, 15 índices, 31 políticas, 10 funções, 1 enum e 3 triggers em `public` (+1 em `auth.users`) `[CONFIRMED: database — catálogo dev e prod, 2026-08-14; correção registrada: a contagem anterior (3 enums, 4 triggers em public) não bate com o catálogo — pg_type/pg_trigger em ambos os ambientes]`.
- **Divergência a partir de 2026-09-04 (ENH-0004)**: migrations 20260904000000/010000/020000/030000/040000 aplicadas em DEV; prod mantém o schema anterior até a release `[INFERRED: migrations novas em branch de trabalho; promoção segue gate de release]`. Em dev pós-ENH-0004: **14 índices** (15 − 2 únicos de nome + 1 `referencias_identidade_ativa_unique`), **8 funções** (10 − `fn_normalizar_nome_referencia` − `fn_remover_favoritos_referencia_inativa`), **1 trigger em `public`** (3 − `trg_normalizar_nome_referencia` − `trg_remover_favoritos_referencia_inativa`) + 1 em `auth.users` (inalterado); colunas seguem 52 (nome_normalizado removida, marca adicionada), 19 constraints e 31 políticas inalterados (a 040000 recriou as políticas verbatim — sem mudança de contagem). Prod permanece com 15 índices, 10 funções e 3 triggers em `public` até a aplicação.
- **Divergência adicional a partir de 2026-09-06 (FEAT-0017 M1/M4)**: migrations 20260905000000/010000/020000 (M1), 20260906000000 (M4) e 20260906010000 (M5 — rollback/restauração) aplicadas em DEV; prod segue pré-ENH-0004 até a release `[INFERRED: migrations novas em branch de trabalho; promoção segue gate de release]`. Em dev pós-FEAT-0017 M1/M4 `[CONFIRMED: database — catálogo dev 2026-09-06]`: **12 tabelas** (7 + 5 de sync), **100 colunas** (52 + 48), **36 constraints** (`pg_constraint`: 12 PK + 19 FK + 1 UNIQUE + 4 CHECK — medição igual à histórica), **36 índices** (14 + 22), **36 políticas** (31 + 5 `admin_select_*`), **12 funções** (8 + 2 de trigger do M1 + 2 RPCs do M4), **5 enums** (1 legado + 4 de sync) e **3 triggers em `public`** (1 + 2 do M1) + 1 em `auth.users` (inalterado). O M5 (20260906010000) acrescenta ao estado dev **1 coluna** (`usuarios.pode_recuperacao` — 101 no total) e **3 funções** (`pode_operar_recuperacao` + as RPCs `reverter_sync_referencias`/`restaurar_referencias_de_backup` — 15 no total), sem constraints, índices, políticas, enums ou triggers novos `[INFERRED: catálogo dev pós-M1/M4 (100 colunas, 12 funções) + DDL da migration 20260906010000; exercício das RPCs pelos testes REAL M5]`. O M6 (20260907000000) é `CREATE OR REPLACE` de função — **nenhum objeto novo** em dev (contagens do M5 permanecem) `[CONFIRMED: DDL da migration 20260907000000; aplicada em dev em 2026-09-07]`. Prod permanece com 7 tabelas, 52 colunas, 19 constraints, 15 índices, 31 políticas, 10 funções, 1 enum e 3 triggers em `public` até a aplicação.
- **Diferenças entre ambientes**:
  1. Extensão `pg_graphql` presente em dev, ausente em prod `[CONFIRMED: database]`.
  2. Prod possui uma coluna **dropped** na posição física 8 de `referencias` (artefato de ADD+DROP; o nome original não é recuperável do catálogo — `UNKNOWN`). Dev não possui `[CONFIRMED: database — pg_attribute.attisdropped]`. **A migration 20260904040000, ao rodar em prod no trem de release, elimina essa coluna dropped** — a tabela é recriada a partir das colunas nomeadas no INSERT `[INFERRED: migration recria a tabela sem colunas dropped]`.
  3. Schema de `referencias` (desde 2026-09-04): dev tem `marca`, `numeric(10,1)` — com **ordem física `marca` logo após `nome`** desde a 040000 — e não tem `nome_normalizado` nem os 2 triggers; prod segue no modelo antigo (ver [referencias.md](referencias.md), [triggers.md](triggers.md)) `[CONFIRMED: migrations 20260904000000→040000 — execução dev; prod não recebeu as migrations]`.
  4. Contagens de dados distintas (coletadas em 2026-08-13) `[CONFIRMED: database]`:

| Tabela | dev | prod |
|---|---|---|
| usuarios | 2 | 7 |
| referencias | 3.164 | 2.986 |
| registros | 13 | 1.363 |
| exames_pku | 4 | 21 |
| background_job_executions | 6 | 8 |

- **U1 da Fase 0 resolvido**: todos os objetos passaram a ter DDL versionado com a migration 20260814000000 (DEBT-0001); aplicada em dev e prod em 2026-08-14 com verificação de no-op contra o catálogo.

## Evidências

- E1 — Inventário de tabelas, colunas (52), constraints (19), índices (15 em 2026-08-14; dev pós-ENH-0004 = 14), flags RLS, políticas (31), funções (10 em 2026-08-14; dev pós-ENH-0004 = 8), enums (1 em `public`) e triggers (3 em `public` + 1 em `auth.users` em 2026-08-14; dev pós-ENH-0004 = 1 + 1): catálogo dos bancos dev e prod via queries somente-leitura (2026-08-14) + dev após migrations ENH-0004 (2026-09-04) + dev pós-FEAT-0017 M1/M4 (2026-09-06 — 12 tabelas, 100 colunas, 36 constraints, 36 índices, 36 políticas, 12 funções, 5 enums, 3 triggers em `public` + 1 em `auth.users`) + dev pós-FEAT-0017 M5 (2026-09-06 — 101 colunas, 15 funções; demais contagens inalteradas — migration 20260906010000) + dev pós-FEAT-0017 M6 (2026-09-07 — sem objeto novo; migration 20260907000000) `[CONFIRMED: database, migration]`.
- E2 — Conteúdo das migrations em `supabase/migrations/` (baseline, 20260807, 20260810, 20260811, 20260814, 20260815, 20260904000000→040000, FEAT-0017: 20260905000000/010000/020000, 20260906000000, 20260906010000 e 20260907000000) `[CONFIRMED: migration]`.
- E3 — Conteúdo das 5 migrations legadas em `migrations/` `[CONFIRMED: migration, git history]`.
- E4 — Histórico git das migrations (`b9a82c7`, `87aa0ff`, `879a6c0`, `6323664`) `[CONFIRMED: git history]`.
- E5 — Chamadores de tabelas no código: 27× `usuarios`, 12× `registros`, 11× `referencias`, 5× `referencias_favoritas`, 5× `delegacoes_acesso`, 4× `exames_pku`, 3× `background_job_executions` em `src/`, `api/` e `supabase/functions/` `[CONFIRMED: code — grep, 2026-08-13]`. Tabelas de sync do FEAT-0017 (grep em `src/`, `api/` e `supabase/functions/`, 2026-09-07 — inclui arquivos de teste): 78× `referencia_syncs`, 29× `referencia_sync_pendencias`, 39× `referencia_eventos`, 12× `referencia_snapshots`, 16× `referencia_backups` `[CONFIRMED: code — grep, 2026-09-07]`.

## Veja também

- `../security/security-model.md` (Fase 3) — matriz RLS consolidada e autorização
- [system-map](../system-map.md) — coluna Database do mapa de capabilities
- `.ai/.temp/analyses/18-documentacao-database.md` — relatório da fase com a comparação banco × migrations
