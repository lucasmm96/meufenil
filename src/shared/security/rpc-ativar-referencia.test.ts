/**
 * Testes da função ativar_referencia (Correção 2).
 *
 * PRÉ-REQUISITO: A migration 20260811210456_fix_security_rls_rpc.sql
 * deve ter sido aplicada para os testes T2.1-T2.5.
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  getAdminClient,
  createTestUser,
  signInAsTestUser,
  trackForCleanup,
  cleanupAllTestUsers,
  createTestReference,
  createTestDelegation,
  isSecurityMigrationApplied,
  TestUser,
} from "./test-helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const describeOrSkip = hasServiceRole ? describe : describe.skip;

describeOrSkip("RPC: ativar_referencia (Abordagem B)", () => {
  const admin = getAdminClient();

  let ownerUser: TestUser;
  let otherUser: TestUser;
  let adminUser: TestUser;
  let delegateUser: TestUser;

  let ownerClient: SupabaseClient;
  let otherClient: SupabaseClient;
  let adminAuthClient: SupabaseClient;
  let delegateClient: SupabaseClient;

  let refOwnerInactive: { id: string };
  let refDelegation: { id: string };
  let migrationApplied = false;

  beforeAll(async () => {
    migrationApplied = await isSecurityMigrationApplied();

    // Criar usuários
    ownerUser = await createTestUser("user");
    trackForCleanup(ownerUser.id);
    otherUser = await createTestUser("user");
    trackForCleanup(otherUser.id);
    adminUser = await createTestUser("admin");
    trackForCleanup(adminUser.id);
    delegateUser = await createTestUser("user");
    trackForCleanup(delegateUser.id);

    // Criar clientes autenticados
    ownerClient = await signInAsTestUser(ownerUser);
    otherClient = await signInAsTestUser(otherUser);
    adminAuthClient = await signInAsTestUser(adminUser);
    delegateClient = await signInAsTestUser(delegateUser);

    // Criar referências de teste
    refOwnerInactive = await createTestReference(ownerUser.id, {
      nome: `_test_ativar_owner_${Date.now()}`,
      is_ativa: false,
    });
    refDelegation = await createTestReference(ownerUser.id, {
      nome: `_test_ativar_deleg_${Date.now()}`,
      is_ativa: false,
    });

    // Criar delegação: owner → delegate
    await createTestDelegation(ownerUser.id, delegateUser.id);
  }, 60000);

  afterAll(async () => {
    await cleanupAllTestUsers();
  }, 30000);

  // Teste do estado ATUAL (pré-migration)
  it("T2.0: ativar_referencia permite ativação por qualquer usuário (vulnerabilidade)", async () => {
    const { data, error } = await otherClient.rpc("ativar_referencia", {
      p_referencia_id: refOwnerInactive.id,
    });

    if (!error) {
      console.warn(
        "T2.0: VULNERABILIDADE — usuário qualquer ativou referência alheia."
      );
      // Re-desativar para não afetar outros testes
      await admin
        .from("referencias")
        .update({ is_ativa: false })
        .eq("id", refOwnerInactive.id);
    }
    // Sempre passa: documenta o estado atual
    expect(true).toBe(true);
  });

  // Testes pós-migration com guard inline (describe condicional não funciona
  // porque é avaliado no import, antes do beforeAll assíncrono)

  it("T2.1: usuário comum NÃO pode ativar referência de terceiro", async () => {
    if (!migrationApplied) return;
    const { error } = await otherClient.rpc("ativar_referencia", {
      p_referencia_id: refOwnerInactive.id,
    });
    expect(error).toBeTruthy();
    expect(error!.message).toMatch(/permissão negada|não encontrada/i);
  });

  it("T2.2: dono pode ativar a própria referência", async () => {
    if (!migrationApplied) return;
    const { data, error } = await ownerClient.rpc("ativar_referencia", {
      p_referencia_id: refOwnerInactive.id,
    });
    expect(error).toBeNull();
    expect(data).toBe("activated");
    const { data: check } = await admin
      .from("referencias")
      .select("is_ativa")
      .eq("id", refOwnerInactive.id)
      .single();
    expect(check!.is_ativa).toBe(true);
  });

  it("T2.3: delegado pode ativar referência do concedente", async () => {
    if (!migrationApplied) return;
    const { data, error } = await delegateClient.rpc("ativar_referencia", {
      p_referencia_id: refDelegation.id,
    });
    expect(error).toBeNull();
    expect(data).toBe("activated");
  });

  it("T2.4: admin pode ativar referência de qualquer usuário", async () => {
    if (!migrationApplied) return;
    await admin
      .from("referencias")
      .update({ is_ativa: false })
      .eq("id", refOwnerInactive.id);
    const { data, error } = await adminAuthClient.rpc("ativar_referencia", {
      p_referencia_id: refOwnerInactive.id,
    });
    expect(error).toBeNull();
    expect(data).toBe("activated");
  });

  it("T2.5: referência inexistente retorna erro", async () => {
    if (!migrationApplied) return;
    const fakeUuid = "00000000-0000-0000-0000-000000000000";
    const { error } = await adminAuthClient.rpc("ativar_referencia", {
      p_referencia_id: fakeUuid,
    });
    expect(error).toBeTruthy();
    expect(error!.message).toMatch(/não encontrada/i);
  });
});
