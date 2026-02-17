import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

function readTokenFromFile() {
  const tokenFile = process.env.TOKEN_FILE ?? ".cli-token";
  const fullPath = path.isAbsolute(tokenFile)
    ? tokenFile
    : path.resolve(repoRoot, tokenFile);

  if (!fs.existsSync(fullPath)) return null;
  const token = fs.readFileSync(fullPath, "utf8").trim();
  return token || null;
}

function requireEnv(name, fallbackName = null) {
  const value = process.env[name] ?? (fallbackName ? process.env[fallbackName] : undefined);
  if (!value) {
    throw new Error(
      `Variável de ambiente ausente: ${name}${
        fallbackName ? ` (ou ${fallbackName})` : ""
      }`
    );
  }
  return value;
}

export function createDbClient({ role, allowMissingToken = false }) {
  const supabaseUrl = requireEnv("SUPABASE_URL", "VITE_SUPABASE_URL");
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let supabaseKey = anonKey;
  if (role === "service") {
    if (!serviceKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY não definida.");
    }
    supabaseKey = serviceKey;
  } else {
    if (!supabaseKey) {
      throw new Error("SUPABASE_ANON_KEY (ou VITE_SUPABASE_ANON_KEY) não definida.");
    }
  }

  const options = {};
  if (role !== "service") {
    const token = readTokenFromFile();
    if (!token) {
      if (!allowMissingToken) {
        throw new Error(
          "Token ausente. Gere com login-oauth e salve no arquivo definido por TOKEN_FILE (default .cli-token)."
        );
      }
    } else {
      options.global = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };
    }
  }

  return createClient(supabaseUrl, supabaseKey, options);
}
