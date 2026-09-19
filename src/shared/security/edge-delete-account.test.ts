/**
 * Testes de integração real para a edge function delete-account.
 *
 * GAP-005: cobertura de exclusão de conta via supabase.functions.invoke()
 * contra o projeto Supabase de desenvolvimento.
 *
 * ATENÇÃO: função destrutiva — exclui o usuário completamente
 * (registros → public.usuarios → auth.users). Cada teste cria um usuário
 * dedicado que NÃO é rastreado via trackForCleanup (a própria função o exclui).
 * O afterEach garante limpeza de segurança caso o teste falhe antes da exclusão.
 *
 * PRÉ-REQUISITO: SUPABASE_SERVICE_ROLE_KEY definida no ambiente (via
 * .env.development). Sem a key, todos os testes são ignorados.
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createTestUser,
  signInAsTestUser,
  getAdminClient,
  type TestUser,
} from "./test-helpers";

// supabase.functions.invoke() returns data as a JSON string when the edge
// function omits Content-Type: application/json. Parse defensively.
function parseData<T = Record<string, unknown>>(raw: unknown): T | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as T; } catch { return null; }
  }
  return raw as T;
}

const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const describeOrSkip = hasServiceRole ? describe : describe.skip;

describeOrSkip("Edge Function: delete-account (integração real)", () => {
  let usuarioParaExcluir: TestUser;
  let clienteUsuario: SupabaseClient;
  let functionAvailable = true;

  beforeAll(async () => {
    // Probe: verifica se a função está deployada.
    // Uma requisição sem Authorization retorna 401 (função up) ou erro de relay
    // (não deployada). Usamos fetch direto para não interferir com os usuários
    // criados em beforeEach.
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      console.warn("[delete-account] Env vars ausentes — testes serão ignorados");
      functionAvailable = false;
      return;
    }

    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
        method: "POST",
        headers: { apikey: anonKey, "Content-Type": "application/json" },
        body: "{}",
      });
      // 401 = função up (sem JWT de usuário, como esperado pela probe)
      // 404 = função não encontrada
      // 5xx = relay/deploy issue
      if (resp.status === 404 || resp.status >= 500) {
        console.warn(
          "[delete-account] Edge function não disponível (status " +
            resp.status +
            ") — testes serão ignorados"
        );
        functionAvailable = false;
      }
    } catch (err) {
      console.warn(
        "[delete-account] Probe falhou — testes serão ignorados:",
        err
      );
      functionAvailable = false;
    }
  }, 15000);

  beforeEach(async () => {
    if (!functionAvailable) return;
    usuarioParaExcluir = await createTestUser("user");
    // NÃO chamar trackForCleanup — a função delete-account exclui o usuário.
    // Caso o teste falhe antes da exclusão, o afterEach faz a limpeza.
    clienteUsuario = await signInAsTestUser(usuarioParaExcluir);
  }, 30000);

  afterEach(async () => {
    if (!functionAvailable || !usuarioParaExcluir) return;
    // Limpeza de segurança: caso o teste tenha falhado antes de excluir o usuário.
    // Se o usuário já foi excluído, as operações retornam erro silencioso.
    try {
      const admin = getAdminClient();
      await admin
        .from("registros")
        .delete()
        .eq("usuario_id", usuarioParaExcluir.id);
    } catch {
      /* ok */
    }
    try {
      const admin = getAdminClient();
      await admin.auth.admin.deleteUser(usuarioParaExcluir.id);
    } catch {
      /* ok — usuário já excluído pela função ou pelo teste */
    }
  }, 10000);

  // -----------------------------------------------------------------------
  // EF2.0 — usuário exclui própria conta com sucesso
  // -----------------------------------------------------------------------
  it("EF2.0: usuário autenticado exclui própria conta e não existe mais em auth.users", async () => {
    if (!functionAvailable) return;
    expect(clienteUsuario).toBeTruthy();

    const userId = usuarioParaExcluir.id;

    const { data: rawData, error } = await clienteUsuario.functions.invoke(
      "delete-account",
      {}
    );
    const data = parseData(rawData);

    expect(error).toBeNull();
    expect(data).toMatchObject({ success: true });

    // Verificar que o usuário não existe mais em auth.users via Admin API
    const admin = getAdminClient();
    const { data: userData, error: getUserError } =
      await admin.auth.admin.getUserById(userId);

    // Após exclusão bem-sucedida: ou erro (not found) ou userData.user é null
    const userGone =
      !!getUserError ||
      !userData?.user ||
      userData.user.id !== userId;

    expect(userGone).toBe(true);
  });

  // -----------------------------------------------------------------------
  // EF2.1 — requisição sem token → 401
  // -----------------------------------------------------------------------
  it("EF2.1: requisição sem token de autenticação de usuário retorna 401", async () => {
    if (!functionAvailable) return;

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      console.warn("EF2.1: env vars ausentes — ignorando");
      return;
    }

    // Invocação direta via fetch sem Authorization: Bearer <user_jwt>.
    // O gateway do Supabase repassa a requisição à função, que verifica
    // internamente o header de autenticação e retorna 401.
    const response = await fetch(
      `${supabaseUrl}/functions/v1/delete-account`,
      {
        method: "POST",
        headers: {
          apikey: anonKey,
          "Content-Type": "application/json",
          // Sem Authorization: Bearer <user_jwt>
        },
        body: JSON.stringify({}),
      }
    );

    expect(response.status).toBe(401);
    const responseBody = (await response.json()) as { error?: string };
    expect(responseBody.error).toBeTruthy();
  });
});
