import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { URL, fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..", "..");

function toHtml(message) {
  return `<!doctype html>
<html lang="pt-br">
  <head>
    <meta charset="utf-8" />
    <title>Login concluido</title>
  </head>
  <body>
    <h1>${message}</h1>
    <p>Voce pode fechar esta aba e voltar ao terminal.</p>
    <script>
      (function () {
        var hash = window.location.hash || "";
        if (!hash) return;
        var payload = { hash: hash };
        fetch("/callback/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).catch(function () {});
      })();
    </script>
  </body>
</html>`;
}

function waitForAuthCodeOrToken({ port, path }) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const requestUrl = new URL(req.url ?? "/", `http://localhost:${port}`);
        const isComplete =
          requestUrl.pathname === `${path}/complete` ||
          requestUrl.pathname.endsWith("/complete");

        if (isComplete) {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk;
          });
          req.on("end", () => {
            try {
              const parsed = JSON.parse(body || "{}");
              const hash = parsed.hash || "";
              if (!hash) {
                res.writeHead(400, { "Content-Type": "text/plain" });
                res.end("Hash ausente.");
                server.close();
                reject(new Error("Hash OAuth ausente."));
                return;
              }

              res.writeHead(200, { "Content-Type": "text/plain" });
              res.end("OK");
              server.close();
              resolve({ type: "hash", value: hash });
            } catch (err) {
              res.writeHead(400, { "Content-Type": "text/plain" });
              res.end("JSON invalido.");
              server.close();
              reject(err);
            }
          });
          return;
        }

        const error = requestUrl.searchParams.get("error");
        const code = requestUrl.searchParams.get("code");
        if (error) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end(toHtml("Falha no login."));
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(toHtml("Login concluido."));

        if (code) {
          server.close();
          resolve({ type: "code", value: code });
        }
      } catch (err) {
        server.close();
        reject(err);
      }
    });

    server.listen(port, () => {
      // server ready
    });
  });
}

export async function loginOAuthCommand({ db, args }) {
  const provider = args.provider ?? "google";
  const port = args.port ? Number(args.port) : 54321;
  const callbackPath = args.path ?? "/callback";
  const redirectTo = `http://localhost:${port}${callbackPath}`;

  const { data, error } = await db.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (error) throw error;
  if (!data?.url) {
    throw new Error("URL de login nao recebida.");
  }

  console.log("Abra este link no navegador para autenticar:");
  console.log(data.url);
  console.log("");

  const result = await waitForAuthCodeOrToken({ port, path: callbackPath });
  let session = null;

  if (result.type === "code") {
    const { data: sessionData, error: exchangeError } =
      await db.auth.exchangeCodeForSession(result.value);
    if (exchangeError) throw exchangeError;
    session = sessionData?.session;
  } else if (result.type === "hash") {
    const hash = result.value.startsWith("#") ? result.value.slice(1) : result.value;
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    const expires_at = params.get("expires_at");
    if (!access_token) {
      throw new Error("access_token ausente no hash.");
    }
    session = {
      access_token,
      refresh_token,
      expires_at: expires_at ? Number(expires_at) : null,
      user: null,
    };
  }

  if (!session?.access_token) {
    throw new Error("Session invalida; access_token nao encontrado.");
  }

  const tokenFile = args["token-file"] ?? process.env.TOKEN_FILE ?? ".cli-token";
  const tokenPath = path.isAbsolute(tokenFile)
    ? tokenFile
    : path.resolve(repoRoot, tokenFile);
  fs.writeFileSync(tokenPath, session.access_token, "utf8");

  return {
    provider,
    redirectTo,
    token_file: tokenPath,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user_id: session.user?.id,
  };
}
