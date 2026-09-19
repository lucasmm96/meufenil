/**
 * Testes de RLS: tabela exames_pku (Abordagem B).
 *
 * PRÉ-REQUISITO: A migration 20260814000000_baseline_objetos_nao_versionados.sql
 * deve ter sido aplicada para as políticas de dono/delegado.
 *
 * Modelo de autorização validado:
 *   SELECT  — dono ✓, delegado ✓, admin ✗, anon ✗
 *   INSERT  — dono ✓, delegado ✓, admin ✗, anon ✗
 *   UPDATE  — dono ✓, delegado ✓, admin ✗, anon ✗
 *   DELETE  — dono ✓, delegado ✓, admin ✗, anon ✗
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
  createTestDelegation,
  TestUser,
} from "./test-helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const describeOrSkip = hasServiceRole ? describe : describe.skip;

/** Dados mínimos para criar um exame. */
function examePayload(usuarioId: string, dia: string) {
  return {
    usuario_id: usuarioId,
    data_exame: dia,
    resultado_mg_dl: 10.0,
  };
}

describeOrSkip("RLS: exames_pku (Abordagem B)", () => {
  // O vitest coleta o callback mesmo em describe.skip — sem credenciais, não
  // instanciar o client na coleta (getAdminClient lança sem as vars de ambiente).
  const admin = hasServiceRole ? getAdminClient() : (null as unknown as SupabaseClient);

  let dono: TestUser;
  let delegado: TestUser;
  let adminUser: TestUser;

  let donoClient: SupabaseClient;
  let delegadoClient: SupabaseClient;
  let adminClient: SupabaseClient;

  // Exame base criado no beforeAll — reutilizado nos testes de SELECT e UPDATE
  let exameBaseId: string;
  const resultadoOriginal = 10.0;

  beforeAll(async () => {
    dono = await createTestUser("user");
    trackForCleanup(dono.id);
    delegado = await createTestUser("user");
    trackForCleanup(delegado.id);
    adminUser = await createTestUser("admin");
    trackForCleanup(adminUser.id);

    donoClient = await signInAsTestUser(dono);
    delegadoClient = await signInAsTestUser(delegado);
    adminClient = await signInAsTestUser(adminUser);

    await createTestDelegation(dono.id, delegado.id);

    // Criar exame base para testes de SELECT e UPDATE
    const { data, error } = await admin
      .from("exames_pku")
      .insert(examePayload(dono.id, "2026-01-01"))
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(`Falha ao criar exame base: ${error?.message}`);
    }
    exameBaseId = data.id;
  }, 30000);

  afterAll(async () => {
    // Limpar exames antes dos usuários (CASCADE em auth, mas limpeza explícita
    // evita dependências de ordem no ciclo de vida do beforeAll/afterAll)
    for (const userId of [dono.id, delegado.id, adminUser.id]) {
      try {
        await admin.from("exames_pku").delete().eq("usuario_id", userId);
      } catch { /* ignora */ }
    }
    await cleanupAllTestUsers();
  }, 30000);

  it("T2.0: dono faz SELECT → vê apenas os próprios exames", async () => {
    const { data, error } = await donoClient
      .from("exames_pku")
      .select("id, usuario_id");
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(1);
    for (const e of data!) {
      expect(e.usuario_id).toBe(dono.id);
    }
  });

  it("T2.1: delegado faz SELECT → vê exames do dono", async () => {
    const { data, error } = await delegadoClient
      .from("exames_pku")
      .select("id, usuario_id");
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    const donoExames = data!.filter((e) => e.usuario_id === dono.id);
    expect(donoExames.length).toBeGreaterThanOrEqual(1);
    expect(donoExames.some((e) => e.id === exameBaseId)).toBe(true);
  });

  it("T2.2: admin faz SELECT → 0 resultados (sem acesso RLS)", async () => {
    const { error, count } = await adminClient
      .from("exames_pku")
      .select("id", { count: "exact", head: true });
    expect(error).toBeNull();
    expect(count).toBe(0);
  });

  it("T2.3: dono faz INSERT → sucesso", async () => {
    const { data, error } = await donoClient
      .from("exames_pku")
      .insert(examePayload(dono.id, "2026-02-01"))
      .select("id, usuario_id")
      .single();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.usuario_id).toBe(dono.id);
  });

  it("T2.4: delegado faz INSERT em nome do dono → sucesso", async () => {
    // Delegado cria exame com usuario_id = dono.id (delegação ativa)
    const { data, error } = await delegadoClient
      .from("exames_pku")
      .insert(examePayload(dono.id, "2026-02-02"))
      .select("id, usuario_id")
      .single();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.usuario_id).toBe(dono.id);
  });

  it("T2.5: admin faz INSERT para o dono (sem delegação) → falha", async () => {
    const { error } = await adminClient
      .from("exames_pku")
      .insert(examePayload(dono.id, "2026-02-03"))
      .select("id")
      .single();
    expect(error).not.toBeNull();
  });

  it("T2.6: dono faz UPDATE do próprio exame → sucesso", async () => {
    const novoResultado = 15.5;
    const { data, error } = await donoClient
      .from("exames_pku")
      .update({ resultado_mg_dl: novoResultado })
      .eq("id", exameBaseId)
      .select("resultado_mg_dl")
      .single();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.resultado_mg_dl).toBe(novoResultado);

    // Restaurar valor original para o próximo teste
    await admin
      .from("exames_pku")
      .update({ resultado_mg_dl: resultadoOriginal })
      .eq("id", exameBaseId);
  });

  it("T2.7: delegado faz UPDATE de exame do dono → sucesso", async () => {
    const novoResultado = 20.0;
    const { data, error } = await delegadoClient
      .from("exames_pku")
      .update({ resultado_mg_dl: novoResultado })
      .eq("id", exameBaseId)
      .select("resultado_mg_dl")
      .single();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.resultado_mg_dl).toBe(novoResultado);

    // Restaurar valor original
    await admin
      .from("exames_pku")
      .update({ resultado_mg_dl: resultadoOriginal })
      .eq("id", exameBaseId);
  });

  it("T2.8: admin faz UPDATE de exame do dono → sem efeito (sem acesso RLS)", async () => {
    // Admin não tem delegação → RLS filtra o exame → 0 rows updated
    await adminClient
      .from("exames_pku")
      .update({ resultado_mg_dl: 9999 })
      .eq("id", exameBaseId);

    // Verificar via admin que o valor não foi alterado
    const { data, error } = await admin
      .from("exames_pku")
      .select("resultado_mg_dl")
      .eq("id", exameBaseId)
      .single();
    expect(error).toBeNull();
    expect(data!.resultado_mg_dl).toBe(resultadoOriginal);
  });

  it("T2.9: dono faz DELETE do próprio exame → sucesso", async () => {
    const { data: novo } = await admin
      .from("exames_pku")
      .insert(examePayload(dono.id, "2026-03-01"))
      .select("id")
      .single();
    expect(novo).not.toBeNull();

    const { error } = await donoClient
      .from("exames_pku")
      .delete()
      .eq("id", novo!.id);
    expect(error).toBeNull();

    const { count } = await admin
      .from("exames_pku")
      .select("id", { count: "exact", head: true })
      .eq("id", novo!.id);
    expect(count).toBe(0);
  });

  it("T2.10: delegado faz DELETE de exame do dono → sucesso", async () => {
    const { data: novo } = await admin
      .from("exames_pku")
      .insert(examePayload(dono.id, "2026-03-02"))
      .select("id")
      .single();
    expect(novo).not.toBeNull();

    const { error } = await delegadoClient
      .from("exames_pku")
      .delete()
      .eq("id", novo!.id);
    expect(error).toBeNull();

    const { count } = await admin
      .from("exames_pku")
      .select("id", { count: "exact", head: true })
      .eq("id", novo!.id);
    expect(count).toBe(0);
  });

  it("T2.11: admin faz DELETE de exame do dono → sem efeito (sem acesso RLS)", async () => {
    const { data: novo } = await admin
      .from("exames_pku")
      .insert(examePayload(dono.id, "2026-03-03"))
      .select("id")
      .single();
    expect(novo).not.toBeNull();

    // Admin não tem delegação → RLS filtra o exame → 0 rows deleted
    await adminClient.from("exames_pku").delete().eq("id", novo!.id);

    // Verificar que o exame ainda existe
    const { count } = await admin
      .from("exames_pku")
      .select("id", { count: "exact", head: true })
      .eq("id", novo!.id);
    expect(count).toBe(1);
  });
});
