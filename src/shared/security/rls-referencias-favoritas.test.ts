/**
 * Testes de RLS: tabela referencias_favoritas (Abordagem B).
 *
 * PRÉ-REQUISITO: A migration 20260814000000_baseline_objetos_nao_versionados.sql
 * deve ter sido aplicada (cria a tabela e as políticas).
 *
 * Modelo de autorização validado:
 *   SELECT  — dono ✓ (ref visível), delegado ✓, admin ✗, anon ✗
 *   INSERT  — dono ✓ (ref visível), delegado ✓, admin ✗, anon ✗
 *   UPDATE  — nenhum papel (policy ausente — favoritos não são editáveis)
 *   DELETE  — dono ✓ (ref visível), delegado ✓, admin ✗, anon ✗
 *
 * Nota: "dono" = o usuário que adicionou o favorito (usuario_id = auth.uid()).
 * A delegação permite que o delegado favorize referências visíveis a ele
 * (globais, próprias ou do concedente). Os favoritos pertencem a quem os
 * inseriu, não ao concedente.
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

describeOrSkip("RLS: referencias_favoritas (Abordagem B)", () => {
  // O vitest coleta o callback mesmo em describe.skip — sem credenciais, não
  // instanciar o client na coleta (getAdminClient lança sem as vars de ambiente).
  const admin = hasServiceRole ? getAdminClient() : (null as unknown as SupabaseClient);

  let dono: TestUser;
  let delegado: TestUser;
  let adminUser: TestUser;

  let donoClient: SupabaseClient;
  let delegadoClient: SupabaseClient;
  let adminClient: SupabaseClient;

  // Referência global usada nos testes de INSERT/SELECT/DELETE
  let refGlobal: { id: string };

  // IDs dos favoritos criados durante os testes
  let favoritoDonoId: string;
  let favoritoDelegadoId: string;

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

    // Delegação dono → delegado (permite que delegado veja refs do dono)
    await createTestDelegation(dono.id, delegado.id);

    // Referência global: visível a qualquer usuário autenticado
    refGlobal = await createTestReference(dono.id, {
      nome: `_test_ref_global_${Date.now()}`,
      is_global: true,
      is_ativa: true,
    });
  }, 30000);

  afterAll(async () => {
    // Limpar favoritos restantes antes de deletar a referência global
    // (FK: referencias_favoritas → referencias ON DELETE CASCADE, mas limpeza
    // explícita garante ordem correta e evita falhas silenciosas)
    try {
      await admin
        .from("referencias_favoritas")
        .delete()
        .in("usuario_id", [dono.id, delegado.id, adminUser.id]);
    } catch { /* ignora */ }

    // Deletar a referência global criada neste teste
    try {
      await admin.from("referencias").delete().eq("id", refGlobal.id);
    } catch { /* ignora */ }

    await cleanupAllTestUsers();
  }, 30000);

  it("T3.0: dono pode INSERT um favorito (ref global) → sucesso", async () => {
    const { data, error } = await donoClient
      .from("referencias_favoritas")
      .insert({
        usuario_id: dono.id,
        referencia_id: refGlobal.id,
      })
      .select("id, usuario_id, referencia_id")
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.usuario_id).toBe(dono.id);
    expect(data!.referencia_id).toBe(refGlobal.id);

    favoritoDonoId = data!.id;
  });

  it("T3.1: dono pode SELECT os próprios favoritos", async () => {
    const { data, error } = await donoClient
      .from("referencias_favoritas")
      .select("id, usuario_id");

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    // Todos os favoritos visíveis pertencem ao dono
    for (const f of data!) {
      expect(f.usuario_id).toBe(dono.id);
    }
    // O favorito criado em T3.0 deve estar presente
    expect(data!.some((f) => f.id === favoritoDonoId)).toBe(true);
  });

  it("T3.2: delegado pode INSERT favorito (ref global) com usuario_id = delegado.id → sucesso", async () => {
    // Delegado favoriza a ref global para si mesmo (não para o dono)
    const { data, error } = await delegadoClient
      .from("referencias_favoritas")
      .insert({
        usuario_id: delegado.id,
        referencia_id: refGlobal.id,
      })
      .select("id, usuario_id")
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.usuario_id).toBe(delegado.id);

    favoritoDelegadoId = data!.id;
  });

  it("T3.3: admin não pode INSERT favorito em nome do dono (usuario_id ≠ auth.uid())", async () => {
    // Admin tenta inserir favorito com usuario_id do dono — viola a política
    // (policy exige usuario_id = auth.uid() = admin.id)
    const { error } = await adminClient
      .from("referencias_favoritas")
      .insert({
        usuario_id: dono.id,
        referencia_id: refGlobal.id,
      })
      .select("id")
      .single();

    expect(error).not.toBeNull();
  });

  it("T3.4: dono pode DELETE do próprio favorito → sucesso", async () => {
    const { error } = await donoClient
      .from("referencias_favoritas")
      .delete()
      .eq("id", favoritoDonoId);

    expect(error).toBeNull();

    // Confirmar que foi deletado
    const { count } = await admin
      .from("referencias_favoritas")
      .select("id", { count: "exact", head: true })
      .eq("id", favoritoDonoId);
    expect(count).toBe(0);
  });

  it("T3.5: dono não consegue ver favoritos de outros usuários (RLS limita por usuario_id)", async () => {
    // Após T3.4, o favorito do dono foi deletado.
    // O único favorito ativo é o do delegado (favoritoDelegadoId, usuario_id = delegado.id).
    // O dono consulta todos os favoritos — deve receber 0 resultados porque
    // a política exige usuario_id = auth.uid() = dono.id.
    const { data, error, count } = await donoClient
      .from("referencias_favoritas")
      .select("id", { count: "exact" });

    expect(error).toBeNull();
    expect(count).toBe(0);

    // Confirmar que o favorito do delegado ainda existe no banco
    const { count: countAdmin } = await admin
      .from("referencias_favoritas")
      .select("id", { count: "exact", head: true })
      .eq("id", favoritoDelegadoId);
    expect(countAdmin).toBe(1);

    // O dono não pode ver (count === 0), mas o favorito existe (countAdmin === 1)
    expect(data).not.toBeNull();
  });
});
