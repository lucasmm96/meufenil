# Secrets e Ambientes — MeuFenil

**Última verificação:** 2026-09-08 (revisão R4-1 da FEAT-0017 — `VERCEL_ENV` passa a ser usada pela rota `api/referencias-sync.ts` para derivar o environment da sync: produção → prod, demais → dev; execução manual disponível em dev e prod)

> ⚠️ Este documento registra SOMENTE nomes, finalidade, escopo e localização das variáveis. **Nenhum valor real de secret é documentado.**

## 1. Arquivos de ambiente

`[CONFIRMED: filesystem — nomes de variáveis inspecionados; valores NÃO lidos]`

| Arquivo | No .gitignore? | Variáveis presentes (nomes) |
|---|---|---|
| `.env.development` | Sim (`.env*`) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_ENVIRONMENT`, `SUPABASE_PROJECT_ID`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DATABASE_URL` |
| `.env.production` | Sim (`.env*`) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_ENVIRONMENT`, `SUPABASE_PROJECT_ID`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DATABASE_URL` |
| `.env.local` | Sim (`.env*`) | `VERCEL_OIDC_TOKEN`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_URL` |

- `.env.local` é criado/gerido pelo **Vercel CLI** (contém `VERCEL_OIDC_TOKEN` para autenticação local do CLI) e — conforme comentário em `test-helpers.ts` — aponta para um projeto Supabase DIFERENTE do usado em desenvolvimento; por isso os testes de segurança carregam `.env.development` com sobrescrita `[CONFIRMED: code — src/shared/security/test-helpers.ts:24-45]`.
- Nenhum arquivo `.env` é versionado `[CONFIRMED: .gitignore, git — analise 11 validada contra o estado atual]`.
- Outros artefatos ignorados: `.cli-token` (JWT do CLI), `.cli-sql*` (arquivos SQL temporários do CLI), `.vercel/` (artefatos locais do Vercel CLI: `cache/`, `README.txt`, `repo.json`), `supabase/.branches/`, `supabase/.temp/` `[CONFIRMED: .gitignore, filesystem]`.

## 2. Inventário de variáveis por escopo

`[CONFIRMED: code — grep de uso em src/, api/, supabase/functions/, scripts/, configs, 2026-08-13]`

### Frontend (expostas no bundle)

| Variável | Uso | Evidência |
|---|---|---|
| `VITE_SUPABASE_URL` | criação do cliente supabase-js (anon) e URL da edge function delegar-acesso | `src/react-app/lib/supabase.ts`, `delegacoesAcesso.service.ts:4` |
| `VITE_SUPABASE_ANON_KEY` | cliente supabase-js (anon) | `src/react-app/lib/supabase.ts` |
| `VITE_APP_ENVIRONMENT` | rótulo de ambiente (`dev`/`prod`; fallback `import.meta.env.DEV`) para background jobs | `src/react-app/lib/app-environment.ts` |

### Backend — Vercel function (`api/keepalive.ts`)

| Variável | Uso | Evidência |
|---|---|---|
| `VERCEL_ENV` | **uso REMOVIDO no keepalive** pelo DEBT-0006 (2026-08-23): durante a regressão `879a6c0` decidia o alvo único do keepalive; o keepalive atual ignora — dois alvos por execução. (Reintroduzido na rota `referencias-sync` em 2026-09-08 — ver tabela abaixo) | `api/keepalive.ts` (histórico) |
| `KEEPALIVE_SUPABASE_URL` / `KEEPALIVE_SUPABASE_SERVICE_ROLE_KEY` | credenciais do alvo PROD (override explícito) | `api/keepalive.ts` |
| `KEEPALIVE_DEV_SUPABASE_URL` / `KEEPALIVE_DEV_SUPABASE_SERVICE_ROLE_KEY` | credenciais do alvo DEV — **obrigatórias, sem fallback** (DEBT-0006) | `api/keepalive.ts` |
| `VITE_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | fallback (a rota aceita como fallback) | `api/keepalive.ts`, README.md |
| `SUPABASE_URL` | fallback adicional na resolução | `api/keepalive.ts` |

O keepalive conecta nos DOIS bancos por execução (prod `meufenil` e dev `meufenil-dev`), usando service role, e grava uma linha em `background_job_executions` de cada banco com o mesmo `run_id` `[CONFIRMED: code — api/keepalive.ts]`. O alvo dev exige `KEEPALIVE_DEV_*` sem fallback (endurecido pelo DEBT-0006, 2026-08-23). (Histórico: entre 2026-08-11 e 2026-08-23 o código executava 1 alvo por execução — regressão `879a6c0` corrigida pelo DEBT-0006; o DEBT-0003, 2026-08-15, havia codificado o drift na documentação.)

### Backend — Vercel function (`api/referencias-sync.ts`)

| Variável | Uso | Evidência |
|---|---|---|
| `VERCEL_ENV` | system env da Vercel (não é secret) que **deriva o environment da sync** (`ambienteAlvo()` — revisão R4-1, 2026-09-08): `production` → `environment='prod'`; `preview`/`development` (incl. `vercel dev` local) → `'dev'`. Motivo de derivar da plataforma e não de env dedicada: o escopo das `REFERENCIAS_SYNC_*` muda junto com `VERCEL_ENV` — um deployment nunca grava no environment errado | `api/referencias-sync.ts` |
| `REFERENCIAS_SYNC_SUPABASE_URL` / `REFERENCIAS_SYNC_SUPABASE_SERVICE_ROLE_KEY` | credenciais service role do banco **do deployment em que a rota roda** — no escopo Production o alvo é prod; no Preview/Development (`vercel dev`) o alvo é dev — **dedicadas, obrigatórias, sem fallback** (mesmo endurecimento do DEBT-0006) | `api/referencias-sync.ts` |
| `CRON_SECRET` | Bearer do cron (GET) — comparação timing-safe | `api/referencias-sync.ts` |
| `POWERBI_RESOURCE_KEY` | resource key pública do relatório Power BI/ANVISA — nunca hardcoded (D-1) | `api/referencias-sync.ts`, `src/shared/powerbi/extract.ts` |

A rota de sincronização grava em `referencia_syncs` (com `environment` = `ambienteAlvo()` — prod ou dev, revisão R4-1 de 2026-09-08), `referencia_eventos`, `referencia_snapshots` e `referencia_backups` (schema M1 da FEAT-0017; RLS admin-only SELECT) — ver [../backend/api-referencias-sync.md](../backend/api-referencias-sync.md). As credenciais NÃO caem de volta para `SUPABASE_SERVICE_ROLE_KEY`/`VITE_SUPABASE_URL` (lição do DEBT-0006: fallback cruzado gravaria no banco errado).

### Edge Functions (Supabase/Deno — `Deno.env`)

| Variável | Uso | Evidência |
|---|---|---|
| `SUPABASE_URL` | criação de clientes (admin/anon) nas funções | `delegar-acesso/index.ts:44`, `delete-account/index.ts:28` |
| `SUPABASE_SERVICE_ROLE_KEY` | cliente `supabaseAdmin` (bypass de RLS) | `delegar-acesso/index.ts:45`, `delete-account/index.ts:55` |
| `SUPABASE_ANON_KEY` | cliente anon usado na validação do token em `delete-account` | `delete-account/index.ts:29` |

- `verify_jwt = true` declarado no `supabase/config.toml` apenas para `[functions.delete-account]`; `delegar-acesso` NÃO está declarada no `config.toml` (como é deployada/configurada no Supabase: `UNKNOWN` — requer acesso ao dashboard) `[CONFIRMED: configuration — supabase/config.toml]`.
- Ambas as funções implementam CORS próprio (`Access-Control-Allow-Origin: *`); o módulo `_shared/cors.ts` existe mas não é importado por nenhuma delas `[CONFIRMED: code — delegar-acesso/index.ts:7-12, delete-account/index.ts:4-8, _shared/cors.ts]`.

### Scripts / CLI

| Variável | Uso | Evidência |
|---|---|---|
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | cliente Supabase do CLI | `scripts/cli/db.js` |
| `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY` | cliente (anon) do CLI | `scripts/cli/db.js` |
| `SUPABASE_SERVICE_ROLE_KEY` | cliente service role do CLI (`--service-role --i-understand-rls`) | `scripts/cli/db.js`, `index.js` |
| `SUPABASE_DATABASE_URL` / `SUPABASE_DB_URL` / `DATABASE_URL` | conexão direta pg do comando `run-sql` (precedência nesta ordem) | `scripts/cli/commands/run-sql.js` |
| `SUPABASE_PROJECT_ID` + senha extraída de `SUPABASE_DATABASE_URL` (ou `SUPABASE_DB_PASSWORD`) | `supabase link` / `migration repair` / `db push` no script de migrations | `scripts/apply-supabase-migrations.sh` |
| `TOKEN_FILE` | caminho do JWT do CLI (default `.cli-token`) | `scripts/cli/db.js` |
| `ENV_FILE` / `NODE_ENV` | seleção do arquivo `.env` do CLI (default `.env.development`; `production` → `.env.production`) | `scripts/cli/env.js` |

### Testes

- `vitest.config.ts` carrega `.env.development` e injeta no ambiente de teste apenas variáveis NÃO-`VITE_` (para `SUPABASE_SERVICE_ROLE_KEY`) `[CONFIRMED: configuration — vitest.config.ts]`.
- `test-helpers.ts` recarrega `.env.development` COM SOBRESCRITA (garante precedência sobre `.env.local`) `[CONFIRMED: code — test-helpers.ts:28-61]`.
- Testes usam exclusivamente o ambiente development `[CONFIRMED: code, analise 11 validada]`.

## 3. Uso de SUPABASE_SERVICE_ROLE_KEY (inventário)

`[CONFIRMED: code — grep, 2026-08-13]`

| Local | Modo de uso |
|---|---|
| `api/keepalive.ts` | service role para leitura de `usuarios` + escrita em `background_job_executions` nos DOIS bancos por execução (prod e dev, mesmo `run_id`) |
| `supabase/functions/delegar-acesso/index.ts` | validação de token (`auth.getUser`), escrita em `delegacoes_acesso`, consultas de `usuarios` (bypass de RLS) |
| `supabase/functions/delete-account/index.ts` | exclusão de `registros`, `usuarios` e `auth.admin.deleteUser` |
| `src/shared/security/*.test.ts` (+ `test-helpers.ts`) | criação de usuários de teste e validação com JWTs reais |
| `scripts/cli/` (`--service-role --i-understand-rls`) | comandos administrativos via Supabase client |

## 4. Plataformas e integrações (o que existe de fato)

- **GitHub:** CI determinístico versionado em `.github/workflows/` (7 workflows — sem IA, ADR-0013): `ci.yml` (W1 — push/PR: lint → test:run → build; `contents: read`), `issue-responder.yml`, `issue-reconcile.yml`, `release-gate.yml`, `release-verify.yml`, `spec-sync.yml`, `sync-wiki.yml` `[CONFIRMED: filesystem]`.
- **Vercel:** `vercel.json` com crons `/api/keepalive` (diário, `0 12 * * *`) e `/api/referencias-sync` (semanal, `0 12 * * 1`) e rewrite SPA; artefatos locais do CLI em `.vercel/` (ignorados); README documenta que variáveis de keepalive podem existir no painel da Vercel como override — configuração do painel em si não é verificável pelo repositório (`UNKNOWN`) `[CONFIRMED: vercel.json, README.md, filesystem]`.
- **Supabase:** `supabase/config.toml` mínimo (apenas `[functions.delete-account]` com `verify_jwt = true`); migrations versionadas; 2 edge functions no diretório `supabase/functions/` `[CONFIRMED: configuration, filesystem]`.
- **Ambientes:** dois bancos Supabase (development e production) acessados via `SUPABASE_DATABASE_URL` de cada arquivo `.env` `[CONFIRMED: configuration, database — Fase 2]`.

## 5. Segurança operacional (estado atual)

- **Aplicação de migrations:** `scripts/apply-supabase-migrations.sh` exige `--env development|production` explícito, valida o valor, nunca aplica nos dois ambientes na mesma execução, e para production exige digitação de `PRODUCTION` como confirmação. Fluxo: `supabase link` (com senha extraída de `SUPABASE_DATABASE_URL`) → `migration repair` do baseline → `supabase db push` `[CONFIRMED: code — scripts/apply-supabase-migrations.sh]`.
- **CLI:** comandos de escrita exigem confirmação (`--confirm`); bypass de RLS exige `--service-role` + `--i-understand-rls` `[CONFIRMED: code — scripts/cli/index.js, utils.js]`.
- **Secrets:** nenhum secret hardcoded no código (todos via env) `[CONFIRMED: code — grep 2026-08-13; analise 11 validada]`; `.env*`, `.cli-token`, `.cli-sql*` ignorados pelo Git `[CONFIRMED: .gitignore]`.
- **Background jobs:** cada execução registra `environment` (`prod`/`dev`) em `background_job_executions`; retenção de 365 dias por trigger; leitura admin-only `[CONFIRMED: code, database — ../database/background_job_executions.md]`.
- **Crons:** keepalive diário (`/api/keepalive`) e sincronização semanal de referências (`/api/referencias-sync`, segunda 12:00 UTC) via Vercel Cron — a plataforma envia `Authorization: Bearer $CRON_SECRET` automaticamente quando a env existe `[CONFIRMED: vercel.json, code — api/referencias-sync.ts]`.
- **Logs:** edge functions usam `console.error`/`console.log` com mensagens próprias; keepalive registra detalhes em `background_job_executions.details` (jsonb) `[CONFIRMED: code]`.
- **Permissões de tabela:** grants amplos por default privileges (todas as roles); a fronteira efetiva é o RLS (ver [security-model.md](security-model.md)) `[CONFIRMED: database]`.

## 6. Diferenças DEV × PROD observadas

`[CONFIRMED: database — Fase 2; configuration]`

1. Extensão `pg_graphql` presente em dev, ausente em prod.
2. Prod possui coluna dropped (artefato) na posição física 8 de `referencias`; dev não.
3. Estrutura lógica (tabelas/policies/funções/triggers) idêntica até 2026-08-14; DIVERGE desde 2026-09-04: dev recebeu a ENH-0004 e o FEAT-0017 M1–M6 (12 tabelas / 36 policies / 15 funções / 4 triggers — 3 em `public` + 1 em `auth.users`), prod permanece pré-ENH-0004/pré-FEAT-0017 (7 tabelas / 31 policies / 10 funções / 3 triggers em `public` + 1 em `auth.users`) até a release.
4. Conteúdo de dados distinto (contagens na Fase 2).
5. Configurações dos painéis Vercel/Supabase (vars de keepalive explícitas, configuração de deploy das edge functions): não verificáveis pelo repositório — `UNKNOWN`.

## Evidências

- E1 — Nomes de variáveis por arquivo `.env` (valores não inspecionados) `[CONFIRMED: filesystem]`
- E2 — Uso de env no código: grep em `src/`, `api/`, `supabase/functions/`, `scripts/`, `vite.config.ts`, `vitest.config.ts` (2026-08-13) `[CONFIRMED: code]`
- E3 — `.gitignore`, `vercel.json`, `supabase/config.toml` `[CONFIRMED: configuration]`
- E4 — Presença de `.github/workflows/` (7 workflows versionados — CI determinístico sem IA, ADR-0013) `[CONFIRMED: filesystem]`
- E5 — Comentário sobre precedência `.env.development` × `.env.local` em `test-helpers.ts:24-45` `[CONFIRMED: code]`

## Veja também

- [security-model.md](security-model.md)
- ../database/overview.md (ambientes e grants)
- ../backend/api-keepalive.md (Fase 4)
