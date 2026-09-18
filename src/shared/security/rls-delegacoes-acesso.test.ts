/**
 * Testes de RLS: tabela delegacoes_acesso (Abordagem B).
 *
 * PRÉ-REQUISITO: A migration 20260814000000_baseline_objetos_nao_versionados.sql
 * deve ter sido aplicada (cria a tabela e as políticas).
 *
 * Modelo de autorização validado:
 *   SELECT  — concedente ✓, delegado (receptor) ✓, admin ✗, anon ✗
 *   INSERT  — concedente ✓ (delegado_id ≠ auth.uid()), delegado ✗, admin ✗
 *   UPDATE  — concedente ✓ (revogação: revoked_at = now()), delegado ✗, admin ✗
 *   DELETE  — nenhum papel (policy ausente)
 *
 * Estrutura dos usuários:
 *   - concedente: cria delegações; pode revogar as próprias
 *   - delegado1:  receptor da delegação criada via admin (beforeAll)
 *   - delegado2:  usado apenas no T4.0 (par único para insert via client)
 *   - adminUser:  não tem delegações → 0 resultados em SELECT
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
  TestUser,
} from "./test-helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const describeOrSkip = hasServiceRole ? describe : describe.skip;

describeOrSkip("RLS: delegacoes_acesso (Abordagem B)", () => {
  // O vitest coleta o callback mesmo em describe.skip — sem credenciais, não
  // instanciar o client na coleta (getAdminClient lança sem as vars de ambiente).
  const admin = hasServiceRole ? getAdminClient() : (null as unknown as SupabaseClient);

  let concedente: TestUser;
  let delegado1: TestUser;  // receptor da delegação pré-existente (beforeAll)
  let delegado2: TestUser;  // par exclusivo de T4.0 (par concedente+delegado2 não existe antes)
  let adminUser: TestUser;

  let concedenteClient: SupabaseClient;
  let delegado1Client: SupabaseClient;
  let delegado2Client: SupabaseClient;
  let adminClient: SupabaseClient;

  // delegacaoPreExistenteId: criada via admin no beforeAll, usada em T4.2-T4.3 e T4.6
  let delegacaoPreExistenteId: string;

  beforeAll(async () => {
    concedente = await createTestUser("user");
    trackForCleanup(concedente.id);
    delegado1 = await createTestUser("user");
    trackForCleanup(delegado1.id);
    delegado2 = await createTestUser("user");
    trackForCleanup(delegado2.id);
    adminUser = await createTestUser("admin");
    trackForCleanup(adminUser.id);

    concedenteClient = await signInAsTestUser(concedente);
    delegado1Client = await signInAsTestUser(delegado1);
    delegado2Client = await signInAsTestUser(delegado2);
    adminClient = await signInAsTestUser(adminUser);

    // Criar delegação concedente → delegado1 via admin para os testes de
    // SELECT (T4.2-T4.3) e tentativa de revogação pelo delegado (T4.6).
    const { data, error } = await admin
      .from("delegacoes_acesso")
      .insert({
        concedente_id: concedente.id,
        delegado_id: delegado1.id,
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(`Falha ao criar delegação base: ${error?.message}`);
    }
    delegacaoPreExistenteId = data.id;
  }, 30000);

  afterAll(async () => {
    // Limpar delegações antes dos usuários
    for (const userId of [concedente.id, delegado1.id, delegado2.id, adminUser.id]) {
      try {
        await admin.from("delegacoes_acesso").delete().eq("concedente_id", userId);
      } catch { /* ignora */ }
      try {
        await admin.from("delegacoes_acesso").delete().eq("delegado_id", userId);
      } catch { /* ignora */ }
    }
    await cleanupAllTestUsers();
  }, 30000);

  it("T4.0: concedente pode INSERT delegação para outro usuário (delegado2) → sucesso", async () => {
    // Par concedente → delegado2 ainda não existe → pode criar
    const { data, error } = await concedenteClient
      .from("delegacoes_acesso")
      .insert({
        concedente_id: concedente.id,
        delegado_id: delegado2.id,
      })
      .select("id, concedente_id, delegado_id, revoked_at")
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.concedente_id).toBe(concedente.id);
    expect(data!.delegado_id).toBe(delegado2.id);
    expect(data!.revoked_at).toBeNull();
  });

  it("T4.1: concedente NÃO pode delegar para si mesmo (delegado_id = concedente_id → falha)", async () => {
    // Policy: WITH CHECK (concedente_id = auth.uid() AND delegado_id <> auth.uid())
    const { error } = await concedenteClient
      .from("delegacoes_acesso")
      .insert({
        concedente_id: concedente.id,
        delegado_id: concedente.id,
      })
      .select("id")
      .single();

    expect(error).not.toBeNull();
  });

  it("T4.2: concedente vê as delegações que criou (SELECT)", async () => {
    const { data, error } = await concedenteClient
      .from("delegacoes_acesso")
      .select("id, concedente_id, delegado_id");

    expect(error).toBeNull();
    expect(data).not.toBeNull();

    // Todas as delegações visíveis têm concedente_id = concedente.id
    for (const d of data!) {
      expect(d.concedente_id).toBe(concedente.id);
    }

    // A delegação pré-existente deve estar visível
    const ids = data!.map((d) => d.id);
    expect(ids).toContain(delegacaoPreExistenteId);
  });

  it("T4.3: delegado1 vê as delegações recebidas (SELECT)", async () => {
    const { data, error } = await delegado1Client
      .from("delegacoes_acesso")
      .select("id, concedente_id, delegado_id");

    expect(error).toBeNull();
    expect(data).not.toBeNull();

    // delegado1 vê apenas delegações onde é o receptor
    for (const d of data!) {
      expect(d.delegado_id).toBe(delegado1.id);
    }

    // A delegação pré-existente deve estar visível
    expect(data!.some((d) => d.id === delegacaoPreExistenteId)).toBe(true);
  });

  it("T4.4: admin não tem SELECT via RLS direta → 0 resultados", async () => {
    // Admin não é concedente nem delegado em nenhuma delegação
    const { error, count } = await adminClient
      .from("delegacoes_acesso")
      .select("id", { count: "exact", head: true });

    expect(error).toBeNull();
    expect(count).toBe(0);
  });

  it("T4.5: concedente pode UPDATE (revogar) delegação criada em T4.0 → sucesso", async () => {
    // Revogar a delegação criada em T4.0 (concedente → delegado2)
    const revokedAt = new Date().toISOString();
    const { data, error } = await concedenteClient
      .from("delegacoes_acesso")
      .update({ revoked_at: revokedAt })
      .eq("concedente_id", concedente.id)
      .eq("delegado_id", delegado2.id)
      .is("revoked_at", null)
      .select("id, revoked_at")
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.revoked_at).not.toBeNull();
  });

  it("T4.6: delegado não pode UPDATE (revogar) delegação que recebeu", async () => {
    // A delegação pré-existente (concedente → delegado1) está ativa.
    // delegado1 tenta revogar — a policy exige concedente_id = auth.uid(),
    // mas delegado1 é o receptor, não o concedente → 0 rows updated.
    const revokedAt = new Date().toISOString();
    const { data, error } = await delegado1Client
      .from("delegacoes_acesso")
      .update({ revoked_at: revokedAt })
      .eq("id", delegacaoPreExistenteId)
      .select("id, revoked_at");

    expect(error).toBeNull();
    // RLS bloqueia a atualização (0 rows matched)
    expect(data?.length ?? 0).toBe(0);

    // Verificar via admin que a delegação ainda está ativa
    const { data: check } = await admin
      .from("delegacoes_acesso")
      .select("revoked_at")
      .eq("id", delegacaoPreExistenteId)
      .single();
    expect(check!.revoked_at).toBeNull();
  });
});
