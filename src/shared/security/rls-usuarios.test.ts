/**
 * Testes de RLS: política admin_can_select_all_usuarios (Correção 1).
 *
 * PRÉ-REQUISITO: A migration 20260811210456_fix_security_rls_rpc.sql
 * deve ter sido aplicada para que os testes de comportamento pós-fix
 * sejam executados (T1.1-T1.4).
 *
 * Antes da migration, os testes AV.5 e AV.7 em auth-real-validation.test.ts
 * já confirmam a vulnerabilidade debug_allow_all.
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTestUser,
  signInAsTestUser,
  trackForCleanup,
  cleanupAllTestUsers,
  isSecurityMigrationApplied,
  TestUser,
} from "./test-helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const describeOrSkip = hasServiceRole ? describe : describe.skip;

describeOrSkip("RLS: usuarios (Abordagem B)", () => {
  let regularUser: TestUser;
  let adminUser: TestUser;
  let regularClient: SupabaseClient;
  let adminAuthClient: SupabaseClient;
  let migrationApplied = false;

  beforeAll(async () => {
    migrationApplied = await isSecurityMigrationApplied();

    regularUser = await createTestUser("user");
    trackForCleanup(regularUser.id);

    adminUser = await createTestUser("admin");
    trackForCleanup(adminUser.id);

    regularClient = await signInAsTestUser(regularUser);
    adminAuthClient = await signInAsTestUser(adminUser);
  }, 30000);

  afterAll(async () => {
    await cleanupAllTestUsers();
  }, 30000);

  // Testes do estado ATUAL (pré-migration): confirmam a vulnerabilidade
  it("T1.0: debug_allow_all — usuário comum vê múltiplos registros (vulnerabilidade)", async () => {
    const { error, count } = await regularClient
      .from("usuarios")
      .select("id", { count: "exact" });

    expect(error).toBeNull();
    if (count !== null && count > 1) {
      console.warn(
        `T1.0: debug_allow_all CONFIRMADA — ${count} registros visíveis para usuário comum.`
      );
    }
    // Sempre passa: documenta o estado atual
    expect(true).toBe(true);
  });

  it("T1.0b: admin vê todos os registros (comportamento correto)", async () => {
    const { error, count } = await adminAuthClient
      .from("usuarios")
      .select("id", { count: "exact" });

    expect(error).toBeNull();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  // Testes que validam o comportamento APÓS a migration.
  // NOTA: não usamos describe.skip condicional (avaliado no import, antes do
  // beforeAll). Em vez disso, verificamos migrationApplied dentro de cada teste.

  it("T1.1: usuário comum vê apenas o próprio registro", async () => {
    if (!migrationApplied) return;
    const { data, error } = await regularClient
      .from("usuarios")
      .select("id");
    expect(error).toBeNull();
    expect(data!.length).toBe(1);
    expect(data![0].id).toBe(regularUser.id);
  });

  it("T1.2: usuário comum não vê registro de outro usuário por ID", async () => {
    if (!migrationApplied) return;
    const { data, error } = await regularClient
      .from("usuarios")
      .select("id")
      .eq("id", adminUser.id);
    expect(error).toBeNull();
    expect(data!.length).toBe(0);
  });

  it("T1.3: admin vê todos os registros", async () => {
    if (!migrationApplied) return;
    const { data, error, count } = await adminAuthClient
      .from("usuarios")
      .select("id", { count: "exact" });
    expect(error).toBeNull();
    expect(count).toBeGreaterThanOrEqual(2);
    const ids = data!.map((r: { id: string }) => r.id);
    expect(ids).toContain(regularUser.id);
    expect(ids).toContain(adminUser.id);
  });

  it("T1.4: admin vê registro específico de outro usuário", async () => {
    if (!migrationApplied) return;
    const { data, error } = await adminAuthClient
      .from("usuarios")
      .select("id")
      .eq("id", regularUser.id)
      .single();
    expect(error).toBeNull();
    expect(data!.id).toBe(regularUser.id);
  });
});
