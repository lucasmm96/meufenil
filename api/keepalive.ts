import { createClient } from "@supabase/supabase-js";
import {
  recordBackgroundJobExecution,
  type BackgroundJobStatus,
} from "../src/shared/background-jobs.js";

type KeepaliveTarget = {
  label: string;
  environment: "prod" | "dev";
  url: string;
  serviceRoleKey: string;
};

type KeepaliveResult = {
  label: string;
  environment: "prod" | "dev";
  ok: boolean;
  elapsedMs: number;
  startedAt: string;
  finishedAt: string;
  error?: string;
};

type KeepaliveRequest = {
  method?: string;
};

type KeepaliveResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
};

function requireEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];

    if (value) {
      return value;
    }
  }

  throw new Error(`Missing environment variable: ${names.join(" or ")}`);
}

function resolveKeepaliveEnvironment(): "prod" | "dev" {
  return process.env.VERCEL_ENV === "production" ? "prod" : "dev";
}

function resolveKeepaliveTarget(environment: "prod" | "dev"): KeepaliveTarget {
  if (environment === "prod") {
    return {
      label: "meufenil",
      environment,
      url: requireEnv("KEEPALIVE_SUPABASE_URL", "VITE_SUPABASE_URL", "SUPABASE_URL"),
      serviceRoleKey: requireEnv(
        "KEEPALIVE_SUPABASE_SERVICE_ROLE_KEY",
        "SUPABASE_SERVICE_ROLE_KEY"
      ),
    };
  }

  return {
    label: "meufenil-dev",
    environment,
    url: requireEnv("KEEPALIVE_DEV_SUPABASE_URL", "VITE_SUPABASE_URL", "SUPABASE_URL"),
    serviceRoleKey: requireEnv(
      "KEEPALIVE_DEV_SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_SERVICE_ROLE_KEY"
    ),
  };
}

function createSupabaseClient(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function pingProject(target: KeepaliveTarget): Promise<KeepaliveResult> {
  const startedAt = Date.now();
  const startedAtIso = new Date(startedAt).toISOString();
  console.info(`[keepalive] starting ${target.label}`);

  const supabase = createSupabaseClient(target.url, target.serviceRoleKey);
  const result = await supabase.from("usuarios").select("id").limit(1);
  const elapsedMs = Date.now() - startedAt;
  const finishedAtIso = new Date().toISOString();

  if (result.error) {
    console.error(
      `[keepalive] failed ${target.label} after ${elapsedMs}ms: ${result.error.message}`
    );

    return {
      label: target.label,
      environment: target.environment,
      ok: false,
      elapsedMs,
      startedAt: startedAtIso,
      finishedAt: finishedAtIso,
      error: result.error.message,
    };
  }

  console.info(`[keepalive] ok ${target.label} after ${elapsedMs}ms`);

  return {
    label: target.label,
    environment: target.environment,
    ok: true,
    elapsedMs,
    startedAt: startedAtIso,
    finishedAt: finishedAtIso,
  };
}

async function persistProjectExecution(
  supabase: ReturnType<typeof createSupabaseClient>,
  runId: string,
  project: KeepaliveResult
): Promise<void> {
  const status: BackgroundJobStatus = project.ok ? "success" : "failure";

  await recordBackgroundJobExecution(supabase, {
    runId,
    jobKey: "keepalive",
    environment: project.environment,
    status,
    startedAt: project.startedAt,
    finishedAt: project.finishedAt,
    durationMs: project.elapsedMs,
    message: project.ok
      ? `Keepalive do ambiente ${project.environment} concluído com sucesso`
      : project.error ?? `Keepalive do ambiente ${project.environment} falhou`,
    details: {
      target: project.label,
      table: "usuarios",
      operation: "select",
      limit: 1,
    },
  });
}

export default async function handler(req: KeepaliveRequest, res: KeepaliveResponse) {
  try {
    if (req.method && req.method !== "GET" && req.method !== "HEAD") {
      res.statusCode = 405;
      res.setHeader("Allow", "GET, HEAD");
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    const startedAt = Date.now();
    const runId = crypto.randomUUID();
    const environment = resolveKeepaliveEnvironment();
    const target = resolveKeepaliveTarget(environment);

    console.info("[keepalive] run started");

    const project = await pingProject(target);
    const logClient = createSupabaseClient(target.url, target.serviceRoleKey);

    try {
      await persistProjectExecution(logClient, runId, project);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[keepalive] failed to persist ${project.environment} result: ${message}`
      );
    }

    const ok = project.ok;
    const durationMs = Date.now() - startedAt;

    console.info(
      `[keepalive] run finished in ${durationMs}ms with ${ok ? "success" : "errors"}`
    );

    res.statusCode = ok ? 200 : 500;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(
      JSON.stringify({
        ok,
        runId,
        durationMs,
        projects: [project],
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[keepalive] unexpected failure: ${message}`);

    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ ok: false, error: message }));
  }
}
