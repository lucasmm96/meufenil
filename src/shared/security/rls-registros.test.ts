/**
 * Testes de RLS: tabela registros (Abordagem B).
 *
 * PRÉ-REQUISITO: A migration 20260814000000_baseline_objetos_nao_versionados.sql
 * deve ter sido aplicada para as políticas de dono/delegado (substitui as
 * políticas simples da migration original).
 *
 * Modelo de autorização validado:
 *   SELECT  — dono ✓, delegado ✓, admin ✗, anon ✗
 *   INSERT  — dono ✓ (ref ativa), delegado ✓ (ref ativa), admin ✗, anon ✗
 *   UPDATE  — nenhum papel (policy ausente — registros são imutáveis)
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
  createTestReference,
  createTestDelegation,
  TestUser,
} from "./test-helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const describeOrSkip = hasServiceRole ? describe : describe.skip;

describeOrSkip("RLS: registros (Abordagem B)", () => {
  // O vitest coleta o callback mesmo em describe.skip — sem credenciais, não
  // instanciar o client na coleta (getAdminClient lança sem as vars de ambiente).
  const admin = hasServiceRole ? getAdminClient() : (null as unknown as SupabaseClient);

  let dono: TestUser;
  let delegado: TestUser;
  let adminUser: TestUser;

  let donoClient: SupabaseClient;
  let delegadoClient: SupabaseClient;
  let adminClient: SupabaseClient;

  let refAtiva: { id: string; fenil_mg_por_100g: number };
  let registroBaseId: string;
  const registrosPesoOriginal = 100;

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

    // Criar delegação e referência ativa para os testes
    await createTestDelegation(dono.id, delegado.id);
    refAtiva = await createTestReference(dono.id, { is_ativa: true });

    // Criar um registro base do dono para os testes de SELECT/UPDATE/DELETE
    const { data, error } = await admin
      .from("registros")
      .insert({
        usuario_id: dono.id,
        referencia_id: refAtiva.id,
        data: "2026-01-01",
        peso_g: registrosPesoOriginal,
        fenil_mg: 10,
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(`Falha ao criar registro base: ${error?.message}`);
    }
    registroBaseId = data.id;
  }, 30000);

  afterAll(async () => {
    // Limpar registros criados nos testes (antes dos usuários)
    for (const userId of [dono.id, delegado.id, adminUser.id]) {
      try {
        await admin.from("registros").delete().eq("usuario_id", userId);
      } catch { /* ignora */ }
    }
    try {
      await admin.from("referencias").delete().eq("id", refAtiva.id);
    } catch { /* ignora */ }
    await cleanupAllTestUsers();
  }, 30000);

  it("T1.0: dono faz SELECT em registros → retorna apenas os próprios", async () => {
    const { data, error } = await donoClient
      .from("registros")
      .select("id, usuario_id");
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(1);
    // Todos os registros retornados pertencem ao dono
    for (const r of data!) {
      expect(r.usuario_id).toBe(dono.id);
    }
  });

  it("T1.1: delegado faz SELECT → vê registros do dono", async () => {
    const { data, error } = await delegadoClient
      .from("registros")
      .select("id, usuario_id");
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    const donoRegistros = data!.filter((r) => r.usuario_id === dono.id);
    expect(donoRegistros.length).toBeGreaterThanOrEqual(1);
    expect(donoRegistros.some((r) => r.id === registroBaseId)).toBe(true);
  });

  it("T1.2: admin faz SELECT em registros → vê 0 registros (sem acesso RLS)", async () => {
    const { error, count } = await adminClient
      .from("registros")
      .select("id", { count: "exact", head: true });
    expect(error).toBeNull();
    // Admin não tem delegação nem registros próprios — RLS retorna 0
    expect(count).toBe(0);
  });

  it("T1.3: dono faz INSERT (com ref ativa) → sucesso", async () => {
    const { data, error } = await donoClient
      .from("registros")
      .insert({
        usuario_id: dono.id,
        referencia_id: refAtiva.id,
        data: "2026-01-02",
        peso_g: 50,
        fenil_mg: 5,
      })
      .select("id, usuario_id")
      .single();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.usuario_id).toBe(dono.id);
  });

  it("T1.4: delegado faz INSERT (com ref ativa do dono) → sucesso", async () => {
    // Delegado cria registro em nome do dono (usuario_id = dono.id)
    const { data, error } = await delegadoClient
      .from("registros")
      .insert({
        usuario_id: dono.id,
        referencia_id: refAtiva.id,
        data: "2026-01-03",
        peso_g: 75,
        fenil_mg: 7.5,
      })
      .select("id, usuario_id")
      .single();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.usuario_id).toBe(dono.id);
  });

  it("T1.5: admin faz INSERT para o dono (sem delegação) → falha", async () => {
    // Admin não tem delegação do dono e não é o dono → RLS bloqueia
    const { error } = await adminClient
      .from("registros")
      .insert({
        usuario_id: dono.id,
        referencia_id: refAtiva.id,
        data: "2026-01-04",
        peso_g: 60,
        fenil_mg: 6,
      })
      .select("id")
      .single();
    expect(error).not.toBeNull();
  });

  it("T1.6: nenhum papel pode fazer UPDATE (policy ausente — registros são imutáveis)", async () => {
    // Tentativas de UPDATE por dono, delegado e admin
    await donoClient.from("registros").update({ peso_g: 9999 }).eq("id", registroBaseId);
    await delegadoClient.from("registros").update({ peso_g: 9999 }).eq("id", registroBaseId);
    await adminClient.from("registros").update({ peso_g: 9999 }).eq("id", registroBaseId);

    // Verificar via admin que o valor original não foi alterado
    const { data, error } = await admin
      .from("registros")
      .select("peso_g")
      .eq("id", registroBaseId)
      .single();
    expect(error).toBeNull();
    expect(data!.peso_g).toBe(registrosPesoOriginal);
  });

  it("T1.7: dono pode fazer DELETE do próprio registro", async () => {
    // Criar registro específico para deletar
    const { data: novo } = await admin
      .from("registros")
      .insert({
        usuario_id: dono.id,
        referencia_id: refAtiva.id,
        data: "2026-01-07",
        peso_g: 100,
        fenil_mg: 10,
      })
      .select("id")
      .single();
    expect(novo).not.toBeNull();

    const { error } = await donoClient
      .from("registros")
      .delete()
      .eq("id", novo!.id);
    expect(error).toBeNull();

    // Confirmar que foi deletado
    const { count } = await admin
      .from("registros")
      .select("id", { count: "exact", head: true })
      .eq("id", novo!.id);
    expect(count).toBe(0);
  });

  it("T1.8: delegado pode fazer DELETE de registro do dono", async () => {
    // Criar registro do dono para deletar via delegado
    const { data: novo } = await admin
      .from("registros")
      .insert({
        usuario_id: dono.id,
        referencia_id: refAtiva.id,
        data: "2026-01-08",
        peso_g: 100,
        fenil_mg: 10,
      })
      .select("id")
      .single();
    expect(novo).not.toBeNull();

    const { error } = await delegadoClient
      .from("registros")
      .delete()
      .eq("id", novo!.id);
    expect(error).toBeNull();

    const { count } = await admin
      .from("registros")
      .select("id", { count: "exact", head: true })
      .eq("id", novo!.id);
    expect(count).toBe(0);
  });

  it("T1.9: admin não pode fazer DELETE de registro do dono (sem policy)", async () => {
    // Criar registro do dono para admin tentar deletar
    const { data: novo } = await admin
      .from("registros")
      .insert({
        usuario_id: dono.id,
        referencia_id: refAtiva.id,
        data: "2026-01-09",
        peso_g: 100,
        fenil_mg: 10,
      })
      .select("id")
      .single();
    expect(novo).not.toBeNull();

    // Admin não tem delegação do dono → RLS filtra o registro → 0 rows deleted
    await adminClient.from("registros").delete().eq("id", novo!.id);

    // Verificar que o registro ainda existe
    const { count } = await admin
      .from("registros")
      .select("id", { count: "exact", head: true })
      .eq("id", novo!.id);
    expect(count).toBe(1);
  });
});
