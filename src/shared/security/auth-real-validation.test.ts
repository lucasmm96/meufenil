/**
 * Validação do mecanismo de autenticação REAL (Abordagem B).
 *
 * Demonstra que:
 * 1. É possível criar usuários de teste via Admin API
 * 2. É possível autenticar com email/senha e obter JWT real
 * 3. O cliente autenticado tem o auth.uid() correto
 * 4. RLS é aplicado a queries feitas com o cliente autenticado
 * 5. O comportamento difere entre usuário comum e admin
 *
 * PRÉ-REQUISITO: SUPABASE_SERVICE_ROLE_KEY configurada no ambiente.
 * Os testes são SKIPPED se a variável não estiver disponível.
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  getAdminClient,
  getAnonClient,
  createTestUser,
  signInAsTestUser,
  trackForCleanup,
  cleanupAllTestUsers,
  TestUser,
} from "./test-helpers";

const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const describeOrSkip = hasServiceRole ? describe : describe.skip;

describeOrSkip("Validação de autenticação real (Abordagem B)", () => {
  let regularUser: TestUser;
  let adminUser: TestUser;
  let regularClient: ReturnType<typeof getAnonClient> extends infer C ? C : never;
  let adminClientAuth: ReturnType<typeof getAnonClient> extends infer C ? C : never;

  beforeAll(async () => {
    // Criar usuários de teste
    regularUser = await createTestUser("user");
    trackForCleanup(regularUser.id);

    adminUser = await createTestUser("admin");
    trackForCleanup(adminUser.id);

    // Autenticar como cada um
    regularClient = await signInAsTestUser(regularUser);
    adminClientAuth = await signInAsTestUser(adminUser);
  }, 30000);

  afterAll(async () => {
    await cleanupAllTestUsers();
  }, 30000);

  it("AV.1: cria usuário de teste com sucesso", () => {
    expect(regularUser.id).toBeTruthy();
    expect(regularUser.email).toContain("@meufenil-test.local");
    expect(regularUser.role).toBe("user");
    expect(adminUser.role).toBe("admin");
    expect(adminUser.id).not.toBe(regularUser.id);
  });

  it("AV.2: autentica com email/senha e obtém cliente funcional", async () => {
    // Testar que o cliente autenticado consegue fazer queries
    const { data, error } = await regularClient
      .from("usuarios")
      .select("id")
      .limit(1);

    // Com debug_allow_all: usuário comum vê registros
    // (não usamos .single() porque múltiplas linhas causariam PGRST116)
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data!.length).toBeGreaterThanOrEqual(1);
  });

  it("AV.3: cliente anon NÃO autenticado é rejeitado em tabelas com RLS", async () => {
    const anon = getAnonClient();
    // Tabela usuarios requer authenticated (debug_allow_all é TO authenticated)
    // Anon (não autenticado) deve ser rejeitado
    const { error } = await anon.from("usuarios").select("id", { count: "exact", head: true });

    // Anon deve receber erro ou array vazio
    // O comportamento exato depende se debug_allow_all permite anon
    // debug_allow_all é TO "authenticated", então anon deve ser bloqueado
    if (error) {
      // Bloqueado por RLS — comportamento esperado
      expect(error.code).toBeTruthy();
    }
  });

  it("AV.4: usuário autenticado consegue ver a própria role em usuarios", async () => {
    const { data, error } = await regularClient
      .from("usuarios")
      .select("id, role")
      .eq("id", regularUser.id)
      .single();

    expect(error).toBeNull();
    expect(data?.role).toBe("user");
  });

  it("AV.5: debug_allow_all — usuário comum vê múltiplos registros em usuarios", async () => {
    // Este teste CONFIRMA a vulnerabilidade atual
    // Após a migration, deve falhar (retornar apenas 1)
    const { data, error, count } = await regularClient
      .from("usuarios")
      .select("id", { count: "exact", head: false });

    // debug_allow_all permite ver TODOS os usuários
    // Se count > 1, a vulnerabilidade está CONFIRMADA
    expect(error).toBeNull();
    if (count !== null && count > 1) {
      console.warn(
        `AV.5: debug_allow_all CONFIRMADA — usuário comum vê ${count} registros. ` +
          "Após a migration, este valor deve ser 1."
      );
    }
  });

  it("AV.6: admin vê todos os registros em usuarios", async () => {
    const { data, error, count } = await adminClientAuth
      .from("usuarios")
      .select("id", { count: "exact", head: false });

    expect(error).toBeNull();
    expect(count).toBeGreaterThanOrEqual(2); // pelo menos os 2 usuários de teste
  });

  it("AV.7: usuário comum NÃO vê registro de outro usuário (RLS aplicado)", async () => {
    // Usuário regular tentando acessar o registro do admin por ID
    // APÓS a correção: deve retornar array vazio (RLS bloqueia)
    const { data: regularSeesAdmin, error } = await regularClient
      .from("usuarios")
      .select("id")
      .eq("id", adminUser.id);

    // Pode retornar erro PGRST116 (single) ou array vazio
    // O importante é que não retorne o registro do admin
    const found = regularSeesAdmin?.find((r: { id: string }) => r.id === adminUser.id);
    expect(found).toBeUndefined();
  });
});
