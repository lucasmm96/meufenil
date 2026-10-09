/**
 * api/notificacoes-cleanup.ts — FEAT-0018
 *
 * Background job: limpa notificações expiradas da tabela `notificacoes`.
 * Acionado pelo Vercel Cron (a cada 6 horas).
 *
 * Segue o mesmo padrão de keepalive.ts e referencias-sync.ts:
 * - Usa o cliente Supabase com service_role (bypassa RLS)
 * - Persiste o resultado em background_job_executions
 * - Falha de persistência não altera a resposta HTTP
 */
import { createClient } from "@supabase/supabase-js";
import {
  recordBackgroundJobExecution,
  type BackgroundJobStatus,
} from "../src/shared/background-jobs.js";

type CleanupRequest = {
  method?: string;
};

type CleanupResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
};

function requireEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(`Missing environment variable: ${names.join(" or ")}`);
}

function createSupabaseClient(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export default async function handler(req: CleanupRequest, res: CleanupResponse) {
  try {
    if (req.method && req.method !== "GET" && req.method !== "HEAD") {
      res.statusCode = 405;
      res.setHeader("Allow", "GET, HEAD");
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    const startedAt = Date.now();
    const startedAtIso = new Date(startedAt).toISOString();
    const runId = crypto.randomUUID();

    // Determina qual banco usar (prod é o padrão; a cleanup roda para o banco
    // onde o cron está configurado — no Vercel, VITE_SUPABASE_URL aponta para prod)
    const url = requireEnv(
      "KEEPALIVE_SUPABASE_URL",
      "VITE_SUPABASE_URL",
      "SUPABASE_URL"
    );
    const serviceRoleKey = requireEnv(
      "KEEPALIVE_SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_SERVICE_ROLE_KEY"
    );

    console.info("[notificacoes-cleanup] run started", { runId });

    const supabase = createSupabaseClient(url, serviceRoleKey);
    const now = new Date().toISOString();

    // Deleta notificações cujo expires_at já passou
    const { count, error } = await supabase
      .from("notificacoes")
      .delete({ count: "exact" })
      .lt("expires_at", now);

    const finishedAtIso = new Date().toISOString();
    const durationMs = Date.now() - startedAt;

    let ok = true;
    let message: string;
    let errorMessage: string | undefined;

    if (error) {
      ok = false;
      errorMessage = error.message;
      message = `Falha ao limpar notificações expiradas: ${error.message}`;
      console.error("[notificacoes-cleanup] failed:", error.message);
    } else {
      const deletedCount = count ?? 0;
      message = `${deletedCount} notificação(ões) expirada(s) removida(s)`;
      console.info(`[notificacoes-cleanup] ok — ${message} em ${durationMs}ms`);
    }

    const status: BackgroundJobStatus = ok ? "success" : "failure";

    try {
      await recordBackgroundJobExecution(supabase, {
        runId,
        jobKey: "notificacoes-cleanup",
        environment: process.env.VERCEL_ENV === "production" ? "prod" : "dev",
        status,
        startedAt: startedAtIso,
        finishedAt: finishedAtIso,
        durationMs,
        message,
        details: {
          deleted_count: count ?? 0,
          ...(errorMessage ? { error: errorMessage } : {}),
        },
      });
    } catch (persistError) {
      const persistMessage =
        persistError instanceof Error ? persistError.message : String(persistError);
      console.error(
        `[notificacoes-cleanup] failed to persist result: ${persistMessage}`
      );
      // Falha de persistência não altera a resposta
    }

    res.statusCode = ok ? 200 : 500;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(
      JSON.stringify({
        ok,
        runId,
        durationMs,
        deletedCount: count ?? 0,
        ...(errorMessage ? { error: errorMessage } : {}),
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[notificacoes-cleanup] unexpected failure: ${message}`);

    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}
