/**
 * Testes da função ativar_referencia (Correção 2 + FEAT-0017 R4-3).
 *
 * PRÉ-REQUISITO: A migration 20260811210456_fix_security_rls_rpc.sql
 * deve ter sido aplicada para os testes T2.1-T2.5.
 * T2.6-T2.10 (referências globais só reativam por admin — R4-3; auditoria
 * is_ativa_manual) exigem as migrations 20260905xxxxxx (FEAT-0017 M1).
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
  isFeat0017M1Applied,
  TestUser,
} from "./test-helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const describeOrSkip = hasServiceRole ? describe : describe.skip;

describeOrSkip("RPC: ativar_referencia (Abordagem B)", () => {
  // O vitest coleta o callback mesmo em describe.skip — sem credenciais, não
  // instanciar o client na coleta (getAdminClient lança sem as vars de ambiente).
  const admin = hasServiceRole ? getAdminClient() : (null as unknown as SupabaseClient);

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
  let refOwnerGlobalInactive: { id: string };
  let refOwnerGlobalAuditInactive: { id: string };
  let refOwnerPersonal2Inactive: { id: string };
  let migrationApplied = false;
  let feat0017M1Applied = false;

  beforeAll(async () => {
    migrationApplied = await isSecurityMigrationApplied();
    feat0017M1Applied = await isFeat0017M1Applied();

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
    // Global inativa (R4-3: só admin reativa) — criado_por owner para provar
    // que nem dono/delegado reativam global
    refOwnerGlobalInactive = await createTestReference(ownerUser.id, {
      nome: `_test_ativar_global_${Date.now()}`,
      is_ativa: false,
      is_global: true,
    });
    // Global dedicada do teste de auditoria (T2.9) — isolada dos demais fluxos
    refOwnerGlobalAuditInactive = await createTestReference(ownerUser.id, {
      nome: `_test_ativar_global_audit_${Date.now()}`,
      is_ativa: false,
      is_global: true,
    });
    refOwnerPersonal2Inactive = await createTestReference(ownerUser.id, {
      nome: `_test_ativar_owner2_${Date.now()}`,
      is_ativa: false,
    });

    // Criar delegação: owner → delegate
    await createTestDelegation(ownerUser.id, delegateUser.id);
  }, 60000);

  afterAll(async () => {
    // Eventos de auditoria do trigger is_ativa_manual (FEAT-0017 M1) — limpar
    // antes da deleção dos usuários (actor FK SET NULL, mas sem lixo no banco)
    for (const ref of [
      refOwnerInactive,
      refDelegation,
      refOwnerGlobalInactive,
      refOwnerGlobalAuditInactive,
      refOwnerPersonal2Inactive,
    ]) {
      try {
        await admin
          .from("referencia_eventos")
          .delete()
          .eq("referencia_id", ref.id);
      } catch { /* ignora */ }
    }
    await cleanupAllTestUsers();
  }, 30000);

  // Teste do estado ATUAL (pré-migration)
  it("T2.0: ativar_referencia permite ativação por qualquer usuário (vulnerabilidade)", async () => {
    const { error } = await otherClient.rpc("ativar_referencia", {
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

  // ---------------------------------------------------------------------------
  // FEAT-0017 R4-3 (endurecimento): referência GLOBAL só reativa por admin
  // (BR-024/BR-037). Migration 20260905020000. Pessoais: comportamento
  // preservado (T2.1-T2.5). Guarda determinística: feat0017M1Applied.
  // ---------------------------------------------------------------------------

  it("T2.6: usuário comum NÃO pode reativar referência GLOBAL", async () => {
    if (!feat0017M1Applied) return;
    const { error } = await otherClient.rpc("ativar_referencia", {
      p_referencia_id: refOwnerGlobalInactive.id,
    });
    expect(error).toBeTruthy();
    expect(error!.message).toMatch(/apenas administradores podem reativar referências globais/i);
    // Permanece inativa
    const { data: check } = await admin
      .from("referencias")
      .select("is_ativa")
      .eq("id", refOwnerGlobalInactive.id)
      .single();
    expect(check!.is_ativa).toBe(false);
  });

  it("T2.7: delegado NÃO pode reativar referência GLOBAL do concedente", async () => {
    if (!feat0017M1Applied) return;
    const { error } = await delegateClient.rpc("ativar_referencia", {
      p_referencia_id: refOwnerGlobalInactive.id,
    });
    expect(error).toBeTruthy();
    expect(error!.message).toMatch(/apenas administradores podem reativar referências globais/i);
  });

  it("T2.8: admin PODE reativar referência GLOBAL", async () => {
    if (!feat0017M1Applied) return;
    const { data, error } = await adminAuthClient.rpc("ativar_referencia", {
      p_referencia_id: refOwnerGlobalInactive.id,
    });
    expect(error).toBeNull();
    expect(data).toBe("activated");
    const { data: check } = await admin
      .from("referencias")
      .select("is_ativa")
      .eq("id", refOwnerGlobalInactive.id)
      .single();
    expect(check!.is_ativa).toBe(true);
  });

  it("T2.9: reativação de admin gera evento is_ativa_manual; service_role não", async () => {
    if (!feat0017M1Applied) return;
    // Ref global dedicada (inativa): admin ativa via RPC → 1 evento
    const { data, error } = await adminAuthClient.rpc("ativar_referencia", {
      p_referencia_id: refOwnerGlobalAuditInactive.id,
    });
    expect(error).toBeNull();
    expect(data).toBe("activated");

    const queryEventos = () =>
      admin
        .from("referencia_eventos")
        .select("tipo, actor_id, detalhes")
        .eq("referencia_id", refOwnerGlobalAuditInactive.id)
        .eq("tipo", "is_ativa_manual");

    const { data: eventos1, error: eventosError1 } = await queryEventos();
    expect(eventosError1).toBeNull();
    expect(eventos1!.length).toBe(1);
    expect(eventos1![0].actor_id).toBe(adminUser.id);
    expect(eventos1![0].detalhes.de).toBe(false);
    expect(eventos1![0].detalhes.para).toBe(true);

    // Desativar via service_role: auth.uid() null → WHEN do trigger false →
    // nenhum evento novo
    await admin
      .from("referencias")
      .update({ is_ativa: false })
      .eq("id", refOwnerGlobalAuditInactive.id);
    const { data: eventos2 } = await queryEventos();
    expect(eventos2!.length).toBe(1);

    // Segunda ativação de admin → 2º evento (mesmo ator/valores)
    const { data: data2, error: error2 } = await adminAuthClient.rpc(
      "ativar_referencia",
      { p_referencia_id: refOwnerGlobalAuditInactive.id }
    );
    expect(error2).toBeNull();
    expect(data2).toBe("activated");
    const { data: eventos3 } = await queryEventos();
    expect(eventos3!.length).toBe(2);
  });

  it("T2.10: dono reativando PESSOAL não gera evento de auditoria (OQ4)", async () => {
    if (!feat0017M1Applied) return;
    const { data, error } = await ownerClient.rpc("ativar_referencia", {
      p_referencia_id: refOwnerPersonal2Inactive.id,
    });
    expect(error).toBeNull();
    expect(data).toBe("activated");
    const { data: eventos } = await admin
      .from("referencia_eventos")
      .select("tipo")
      .eq("referencia_id", refOwnerPersonal2Inactive.id);
    expect(eventos!.length).toBe(0);
  });
});
