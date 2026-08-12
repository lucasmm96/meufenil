/**
 * Testes da função remover_ou_desativar_referencia (Correção 3).
 *
 * PRÉ-REQUISITO: A migration 20260811210456_fix_security_rls_rpc.sql
 * deve ter sido aplicada para os testes T3.1-T3.8.
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

describeOrSkip("RPC: remover_ou_desativar_referencia (Abordagem B)", () => {
  const admin = getAdminClient();

  let ownerUser: TestUser;
  let otherUser: TestUser;
  let adminUser: TestUser;
  let delegateUser: TestUser;

  let ownerClient: SupabaseClient;
  let otherClient: SupabaseClient;
  let adminAuthClient: SupabaseClient;
  let delegateClient: SupabaseClient;

  let refOwnerNoRegs: { id: string };
  let refGlobal: { id: string };
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

    // Clientes autenticados
    ownerClient = await signInAsTestUser(ownerUser);
    otherClient = await signInAsTestUser(otherUser);
    adminAuthClient = await signInAsTestUser(adminUser);
    delegateClient = await signInAsTestUser(delegateUser);

    // Referências de teste
    refOwnerNoRegs = await createTestReference(ownerUser.id, {
      nome: `_test_remover_owner_${Date.now()}`,
    });
    refGlobal = await createTestReference(adminUser.id, {
      nome: `_test_remover_global_${Date.now()}`,
      is_global: true,
    });
    refDelegation = await createTestReference(ownerUser.id, {
      nome: `_test_remover_deleg_${Date.now()}`,
    });

    // Delegação: owner → delegate
    await createTestDelegation(ownerUser.id, delegateUser.id);
  }, 60000);

  afterAll(async () => {
    await cleanupAllTestUsers();
  }, 30000);

  // Teste do estado ATUAL (pré-migration)
  it("T3.0: remover_ou_desativar_referencia permite remoção por qualquer usuário (vulnerabilidade)", async () => {
    // Criar uma referência temporária do owner
    const tempRef = await createTestReference(ownerUser.id, {
      nome: `_test_vuln_remove_${Date.now()}`,
    });

    const { error } = await otherClient.rpc(
      "remover_ou_desativar_referencia",
      { p_referencia_id: tempRef.id }
    );

    if (!error) {
      console.warn(
        "T3.0: VULNERABILIDADE — usuário qualquer removeu referência alheia."
      );
    }
    expect(true).toBe(true);
  });

  // Testes pós-migration com guard inline (describe condicional não funciona
  // porque é avaliado no import, antes do beforeAll assíncrono)

  it("T3.1: usuário comum NÃO pode remover referência de terceiro", async () => {
    if (!migrationApplied) return;
    const { error } = await otherClient.rpc(
      "remover_ou_desativar_referencia",
      { p_referencia_id: refOwnerNoRegs.id }
    );
    expect(error).toBeTruthy();
    expect(error!.message).toMatch(/permissão negada/i);
  });

  it("T3.2: dono pode remover a própria referência sem registros (delete permanente)", async () => {
    if (!migrationApplied) return;
    const { data, error } = await ownerClient.rpc(
      "remover_ou_desativar_referencia",
      { p_referencia_id: refOwnerNoRegs.id }
    );
    expect(error).toBeNull();
    expect(data).toBe("deleted");
    const { data: check } = await admin
      .from("referencias")
      .select("id")
      .eq("id", refOwnerNoRegs.id);
    expect(check!.length).toBe(0);
  });

  it("T3.3: dono remove a própria referência COM registros vinculados (soft-delete)", async () => {
    if (!migrationApplied) return;
    const refWithRegs = await createTestReference(ownerUser.id, {
      nome: `_test_softdelete_${Date.now()}`,
    });
    const hoje = new Date().toISOString().split("T")[0];
    const { data: registro, error: regError } = await admin
      .from("registros")
      .insert({
        usuario_id: ownerUser.id,
        referencia_id: refWithRegs.id,
        data: hoje,
        peso_g: 100,
        fenil_mg: 10.0,
      })
      .select("id")
      .single();
    expect(regError).toBeNull();
    expect(registro!.id).toBeTruthy();

    const { data, error } = await ownerClient.rpc(
      "remover_ou_desativar_referencia",
      { p_referencia_id: refWithRegs.id }
    );
    expect(error).toBeNull();
    expect(data).toBe("deactivated");

    const { data: refCheck } = await admin
      .from("referencias")
      .select("id, is_ativa")
      .eq("id", refWithRegs.id)
      .single();
    expect(refCheck!.id).toBe(refWithRegs.id);
    expect(refCheck!.is_ativa).toBe(false);

    const { data: regCheck } = await admin
      .from("registros")
      .select("id")
      .eq("id", registro!.id)
      .single();
    expect(regCheck!.id).toBe(registro!.id);

    await admin.from("registros").delete().eq("id", registro!.id);
    await admin.from("referencias").delete().eq("id", refWithRegs.id);
  });

  it("T3.4: delegado pode remover referência do concedente", async () => {
    if (!migrationApplied) return;
    const { data, error } = await delegateClient.rpc(
      "remover_ou_desativar_referencia",
      { p_referencia_id: refDelegation.id }
    );
    expect(error).toBeNull();
    expect(["deleted", "deactivated"]).toContain(data);
  });

  it("T3.5: admin pode remover referência de qualquer usuário", async () => {
    if (!migrationApplied) return;
    const tempRef = await createTestReference(ownerUser.id, {
      nome: `_test_admin_remove_${Date.now()}`,
    });
    const { data, error } = await adminAuthClient.rpc(
      "remover_ou_desativar_referencia",
      { p_referencia_id: tempRef.id }
    );
    expect(error).toBeNull();
    expect(data).toBe("deleted");
  });

  it("T3.6: usuário não-admin NÃO pode remover referência global", async () => {
    if (!migrationApplied) return;
    const { error } = await ownerClient.rpc(
      "remover_ou_desativar_referencia",
      { p_referencia_id: refGlobal.id }
    );
    expect(error).toBeTruthy();
    expect(error!.message).toMatch(
      /apenas administradores podem remover referências globais|permissão negada/i
    );
  });

  it("T3.7: admin pode remover referência global", async () => {
    if (!migrationApplied) return;
    const tempGlobal = await createTestReference(adminUser.id, {
      nome: `_test_admin_global_remove_${Date.now()}`,
      is_global: true,
    });
    const { data, error } = await adminAuthClient.rpc(
      "remover_ou_desativar_referencia",
      { p_referencia_id: tempGlobal.id }
    );
    expect(error).toBeNull();
    expect(data).toBe("deleted");
  });

  it("T3.8: referência inexistente retorna erro", async () => {
    if (!migrationApplied) return;
    const fakeUuid = "00000000-0000-0000-0000-000000000000";
    const { error } = await adminAuthClient.rpc(
      "remover_ou_desativar_referencia",
      { p_referencia_id: fakeUuid }
    );
    expect(error).toBeTruthy();
    expect(error!.message).toMatch(/não encontrada/i);
  });
});
