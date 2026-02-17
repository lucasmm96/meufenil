import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireConfirm } from "../utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..", "..");

function resolveSqlFile(fileArg) {
  const filePath = fileArg ?? ".cli-sql";
  const fullPath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(repoRoot, filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Arquivo SQL nao encontrado: ${fullPath}`);
  }
  return fullPath;
}

function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.SUPABASE_DATABASE_URL ||
    null
  );
}

export async function runSqlCommand({ args }) {
  if (!args["service-role"] || !args["i-understand-rls"]) {
    throw new Error(
      "run-sql requer --service-role e --i-understand-rls para deixar explicito o bypass de RLS."
    );
  }
  requireConfirm(args, "run-sql");

  const sqlFile = resolveSqlFile(args.file);
  const sql = fs.readFileSync(sqlFile, "utf8");
  if (!sql.trim()) {
    throw new Error("Arquivo SQL vazio.");
  }

  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL (ou SUPABASE_DB_URL / SUPABASE_DATABASE_URL) nao definida."
    );
  }

  let pg;
  try {
    pg = await import("pg");
  } catch (err) {
    throw new Error("Dependencia 'pg' nao instalada. Rode: npm install -D pg");
  }

  const { Client } = pg;
  const client = new Client({ connectionString });
  await client.connect();

  try {
    if (args.transaction) {
      await client.query("BEGIN");
    }
    const result = await client.query(sql);
    if (args.transaction) {
      await client.query("COMMIT");
    }

    return {
      file: sqlFile,
      command: result.command,
      rowCount: result.rowCount,
      rows: result.rows ?? [],
    };
  } catch (error) {
    if (args.transaction) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore rollback failure
      }
    }
    throw error;
  } finally {
    await client.end();
  }
}

