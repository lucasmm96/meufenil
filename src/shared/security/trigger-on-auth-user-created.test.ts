/**
 * Testes de integração real para o trigger on_auth_user_created.
 *
 * GAP-008: verifica que a criação de um usuário em auth.users dispara
 * automaticamente a criação do perfil correspondente em public.usuarios
 * (trigger handle_new_user / on_auth_user_created).
 *
 * PRÉ-REQUISITO: SUPABASE_SERVICE_ROLE_KEY definida no ambiente (via
 * .env.development). Sem a key, todos os testes são ignorados.
 *
 * @vitest-environment node
 */

import { describe, it, expect, afterAll } from "vitest";
import { getAdminClient } from "./test-helpers";

const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const describeOrSkip = hasServiceRole ? describe : describe.skip;

describeOrSkip("Trigger: on_auth_user_created (integração real)", () => {
  let testUserId: string | null = null;

  afterAll(async () => {
    if (!testUserId) return;

    // Limpeza: remover dados gerados pelo teste
    const admin = getAdminClient();
    try {
      await admin.from("registros").delete().eq("usuario_id", testUserId);
    } catch {
      /* ok */
    }
    try {
      await admin.auth.admin.deleteUser(testUserId);
    } catch {
      /* ok — pode já ter sido excluído */
    }
  }, 30000);

  // -----------------------------------------------------------------------
  // TR2.0 — criação via Admin API dispara criação de perfil em public.usuarios
  // -----------------------------------------------------------------------
  it(
    "TR2.0: criação de usuário via Admin API dispara criação de perfil em public.usuarios",
    async () => {
      const admin = getAdminClient();
      const email = `test.trigger.${crypto.randomUUID().slice(0, 8)}@meufenil-test.local`;
      const password = `test-${crypto.randomUUID()}`;

      const { data: authData, error: createError } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: "Test Trigger TR2.0" },
        });

      expect(createError).toBeNull();
      expect(authData?.user).toBeTruthy();

      testUserId = authData!.user!.id;

      // Aguardar o trigger ser executado (geralmente síncrono no Postgres,
      // mas pode haver latência de rede/rpc entre o Supabase auth e o
      // trigger de database — 500ms é suficiente)
      await new Promise((r) => setTimeout(r, 500));

      const { data: perfil, error: perfilError } = await admin
        .from("usuarios")
        .select("id, email, role")
        .eq("id", testUserId)
        .single();

      expect(perfilError).toBeNull();
      expect(perfil).not.toBeNull();
      expect(perfil!.id).toBe(testUserId);
      expect(perfil!.email).toBe(email);
      // Role padrão para novos usuários é 'user'
      expect(perfil!.role).toBe("user");
    }
  );
});
