import { createClient } from "@supabase/supabase-js";

type KeepaliveTarget = {
  label: string;
  url: string;
  serviceRoleKey: string;
};

type KeepaliveResult = {
  label: string;
  ok: boolean;
  elapsedMs: number;
  error?: string;
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
  console.info(`[keepalive] starting ${target.label}`);

  const supabase = createSupabaseClient(target.url, target.serviceRoleKey);
  const { error } = await supabase.from("usuarios").select("id").limit(1);
  const elapsedMs = Date.now() - startedAt;

  if (error) {
    console.error(
      `[keepalive] failed ${target.label} after ${elapsedMs}ms: ${error.message}`
    );

    return {
      label: target.label,
      ok: false,
      elapsedMs,
      error: error.message,
    };
  }

  console.info(`[keepalive] ok ${target.label} after ${elapsedMs}ms`);

  return {
    label: target.label,
    ok: true,
    elapsedMs,
  };
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method && req.method !== "GET" && req.method !== "HEAD") {
      res.statusCode = 405;
      res.setHeader("Allow", "GET, HEAD");
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    const startedAt = Date.now();

    const targets: KeepaliveTarget[] = [
      {
        label: "meufenil",
        url: requireEnv("KEEPALIVE_SUPABASE_URL", "VITE_SUPABASE_URL", "SUPABASE_URL"),
        serviceRoleKey: requireEnv(
          "KEEPALIVE_SUPABASE_SERVICE_ROLE_KEY",
          "SUPABASE_SERVICE_ROLE_KEY"
        ),
      },
      {
        label: "meufenil-dev",
        url: requireEnv("KEEPALIVE_DEV_SUPABASE_URL", "VITE_SUPABASE_URL", "SUPABASE_URL"),
        serviceRoleKey: requireEnv(
          "KEEPALIVE_DEV_SUPABASE_SERVICE_ROLE_KEY",
          "SUPABASE_SERVICE_ROLE_KEY"
        ),
      },
    ];

    console.info("[keepalive] run started");

    const results = await Promise.allSettled(targets.map(pingProject));
    const projects = results.map((result, index) => {
      const fallbackTarget = targets[index];

      if (result.status === "fulfilled") {
        return result.value;
      }

      const errorMessage =
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);

      console.error(
        `[keepalive] failed ${fallbackTarget.label} before query: ${errorMessage}`
      );

      return {
        label: fallbackTarget.label,
        ok: false,
        elapsedMs: 0,
        error: errorMessage,
      };
    });

    const ok = projects.every((project) => project.ok);
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
        durationMs,
        projects,
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
