import { loadEnvFileIfPresent, resolveDefaultEnvFile } from "./env.js";
import { parseArgs } from "./parseArgs.js";
import { createDbClient } from "./db.js";
import { listCommand } from "./commands/list.js";
import { seedReferenciaCommand } from "./commands/seed-referencia.js";
import { diagCommand } from "./commands/diag.js";
import { loginOAuthCommand } from "./commands/login-oauth.js";
import { runSqlCommand } from "./commands/run-sql.js";
import { printResult } from "./utils.js";

const commands = {
  list: listCommand,
  "seed-referencia": seedReferenciaCommand,
  diag: diagCommand,
  "login-oauth": loginOAuthCommand,
  "run-sql": runSqlCommand,
};

function printHelp() {
  console.log(`Uso:
  node scripts/cli/index.js <comando> [--flags]

Comandos:
  list --table TABELA [--select campos] [--limit 20] [--order coluna] [--desc]
  seed-referencia --nome "Alimento" --fenil 12.3 --criado-por UUID --confirm
  diag [--table TABELA]
  login-oauth [--provider google] [--port 54321] [--path /callback] [--token-file .cli-token]
  run-sql --file .cli-sql --confirm --service-role --i-understand-rls [--transaction]

Credenciais:
  --env-file caminho          (opcional, default .env.development)
  --service-role              (usa SUPABASE_SERVICE_ROLE_KEY, ignora RLS)
  --i-understand-rls           (obrigatório com --service-role)
  Token JWT: lido do arquivo TOKEN_FILE (default .cli-token)
  SQL runner: usa DATABASE_URL (ou SUPABASE_DB_URL / SUPABASE_DATABASE_URL)
`);
}

function resolveRole(args) {
  if (!args["service-role"]) return "anon";
  if (!args["i-understand-rls"]) {
    throw new Error(
      "Para usar --service-role você precisa passar --i-understand-rls explicitamente."
    );
  }
  return "service";
}

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const commandName = args._[0];

  const envFile = args["env-file"] ?? resolveDefaultEnvFile();
  loadEnvFileIfPresent(envFile);

  if (!commandName || commandName === "help" || commandName === "--help") {
    printHelp();
    process.exitCode = 0;
    return;
  }

  const command = commands[commandName];
  if (!command) {
    throw new Error(`Comando inválido: ${commandName}`);
  }

  const role = resolveRole(args);
  const allowMissingToken = commandName === "login-oauth";
  const db = createDbClient({ role, allowMissingToken });

  const result = await command({ db, args });
  printResult(result);
}

main().catch((error) => {
  console.error("[cli] erro:", error?.message ?? error);
  process.exitCode = 1;
});
