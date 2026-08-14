# CLI e Script de Migrations

**Última verificação:** 2026-08-13 (commit 6323664)
**Código:** `scripts/cli/` (Node ESM) e `scripts/apply-supabase-migrations.sh` (bash)

## Propósito

Ferramentas de linha de comando para diagnóstico, consulta e gestão do banco pelo desenvolvedor — executadas na máquina local, fora do runtime da aplicação.

## scripts/cli/ — CLI de gestão

Entrypoint: `node scripts/cli/index.js <comando> [--flags]` (`npm run cli -- ...`) `[CONFIRMED: code — scripts/cli/index.js, package.json]`.

### Estrutura

| Arquivo | Papel |
|---|---|
| `index.js` | dispatch de comandos, resolução de role (anon/service), help `[CONFIRMED: code]` |
| `env.js` | carregamento de arquivos `.env` (default `.env.development`; `NODE_ENV=production` → `.env.production`; `ENV_FILE` explícito) `[CONFIRMED: code]` |
| `db.js` | criação do cliente Supabase: anon (+JWT de `.cli-token`) ou service role (`--service-role` + `--i-understand-rls` obrigatórios) `[CONFIRMED: code]` |
| `parseArgs.js` | parser simples de `--flag valor` / `--flag=valor` `[CONFIRMED: code]` |
| `utils.js` | `validateTableName` (regex `^[a-zA-Z0-9_]+$`), `requireConfirm` (`--confirm` obrigatório), `printResult` (JSON) `[CONFIRMED: code]` |

### Comandos

| Comando | O que faz | Escrita? | Confirmação | Evidência |
|---|---|---|---|---|
| `list --table T [--select c] [--limit 20] [--order c] [--desc]` | SELECT com projeção/limite/ordenação (limit default 20) | não | — | `commands/list.js` |
| `diag [--table T]` | contagem de linhas (`select head:true count:exact`; default `referencias`) | não | — | `commands/diag.js` |
| `seed-referencia --nome N --fenil F --criado-por UUID --confirm` | INSERT de referência pessoal (`is_global: false`) | sim | `--confirm` | `commands/seed-referencia.js` |
| `login-oauth [--provider google] [--port 54321] [--path /callback] [--token-file .cli-token]` | sobe servidor HTTP local, abre fluxo OAuth no navegador, captura o hash na página de callback e salva o token no arquivo `TOKEN_FILE` | grava arquivo local | — | `commands/login-oauth.js` |
| `run-sql --file .cli-sql --confirm --service-role --i-understand-rls [--transaction]` | executa arquivo SQL via conexão **PostgreSQL direta** (`pg`) usando `DATABASE_URL`/`SUPABASE_DB_URL`/`SUPABASE_DATABASE_URL`; `--transaction` envolve em BEGIN/COMMIT com ROLLBACK em erro | sim (arbitrário) | `--confirm` + `--service-role` + `--i-understand-rls` | `commands/run-sql.js` |

`[CONFIRMED: code — scripts/cli/commands/*]`

### Tratamento de erros

Comandos lançam `Error` com mensagens pt-BR; `index.js` captura e imprime `[cli] erro: <mensagem>` com `process.exitCode = 1` `[CONFIRMED: code — scripts/cli/index.js]`.

## scripts/apply-supabase-migrations.sh — aplicador de migrations

### Fluxo

1. Exige `--env development|production` (valida o valor; nunca aplica nos dois ambientes na mesma execução) `[CONFIRMED: code]`.
2. Carrega `.env.<ambiente>` (`set -a; source`).
3. **Produção:** exige digitar `PRODUCTION` para continuar `[CONFIRMED: code]`.
4. Extrai a senha do banco de `SUPABASE_DATABASE_URL` (ou usa `SUPABASE_DB_PASSWORD` se definida) `[CONFIRMED: code]`.
5. `[1/3] npx supabase link --project-ref $SUPABASE_PROJECT_ID --password $SUPABASE_DB_PASSWORD`
6. `[2/3] npx supabase migration repair $BASELINE_MIGRATION_VERSION --status applied` (baseline = `20260103015052`)
7. `[3/3] npx supabase db push --password $SUPABASE_DB_PASSWORD`

`[CONFIRMED: code — scripts/apply-supabase-migrations.sh]`

### Observações factuais

- O helper `isSecurityMigrationApplied()` citado na análise 09 como parte do script NÃO está presente no script atual — existe apenas em `src/shared/security/test-helpers.ts` `[CONFIRMED: code × documentation histórica]`.
- Erros de pré-condição (env ausente, ambiente inválido, confirmação negada) encerram com mensagem e exit 1 `[CONFIRMED: code]`.

## Testes

- Nenhum teste identificado para `scripts/cli/` ou para o script de migrations `[CONFIRMED: ausência — filesystem]`.

## Evidências

- E1 — Código completo de `scripts/cli/` e `scripts/apply-supabase-migrations.sh` `[CONFIRMED: code]`
- E2 — `package.json` (`cli` script, `supabase` devDependency) `[CONFIRMED: configuration]`
- E3 — Variáveis usadas: inventário em [../security/secrets-and-environments.md](../security/secrets-and-environments.md) `[CONFIRMED: code]`
- E4 — Ausência de testes da CLI `[CONFIRMED: ausência]`

## Veja também

- [overview.md](overview.md), [../database/overview.md](../database/overview.md) (migrations), [../security/secrets-and-environments.md](../security/secrets-and-environments.md)
