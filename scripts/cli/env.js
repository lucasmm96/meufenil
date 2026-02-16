import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const eqIndex = trimmed.indexOf("=");
  if (eqIndex === -1) return null;
  const key = trimmed.slice(0, eqIndex).trim();
  let value = trimmed.slice(eqIndex + 1).trim();
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return { key, value };
}

export function loadEnvFileIfPresent(envFile) {
  if (!envFile) return { loaded: false, path: null };
  const fullPath = path.isAbsolute(envFile)
    ? envFile
    : path.resolve(repoRoot, envFile);

  if (!fs.existsSync(fullPath)) {
    return { loaded: false, path: fullPath };
  }

  const content = fs.readFileSync(fullPath, "utf8");
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    if (process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }
  }

  return { loaded: true, path: fullPath };
}

export function resolveDefaultEnvFile() {
  if (process.env.ENV_FILE) return process.env.ENV_FILE;
  if (process.env.NODE_ENV === "production") return ".env.production";
  return ".env.development";
}

