/**
 * Testes de integração real para o trigger trg_auditar_is_ativa_manual.
 *
 * GAP-008: verifica que o trigger cria evento is_ativa_manual em
 * referencia_eventos quando um admin autenticado atualiza is_ativa, e que
 * operações via service_role (auth.uid() null) NÃO disparam o trigger.
 *
 * Trigger: AFTER UPDATE OF is_ativa ON public.referencias FOR EACH ROW
 *          WHEN (auth.uid() IS NOT NULL)
 * Função:  fn_auditar_is_ativa_manual — insere evento somente se
 *          is_admin_user(auth.uid()) e app.audit_origin != 'curadoria'.
 *
 * PRÉ-REQUISITO:
 *   - SUPABASE_SERVICE_ROLE_KEY definida (via .env.development)
 *   - Migration FEAT-0017 M1 (20260905010000) aplicada no banco de dev
 *     (guard: isFeat0017M1Applied)
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getAdminClient,
  createTestUser,
  signInAsTestUser,
  trackForCleanup,
  cleanupAllTestUsers,
  createTestReference,
  isFeat0017M1Applied,
  type TestUser,
  type TestReference,
} from "./test-helpers";

const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const describeOrSkip = hasServiceRole ? describe : describe.skip;

describeOrSkip("Trigger: trg_auditar_is_ativa_manual (integração real)", () => {
  let adminUser: TestUser;
  let clienteAdmin: SupabaseClient;
  let testRef: TestReference;
  let feat0017M1Applied = false;

  beforeAll(async () => {
    feat0017M1Applied = await isFeat0017M1Applied();

    adminUser = await createTestUser("admin");
    trackForCleanup(adminUser.id);
    clienteAdmin = await signInAsTestUser(adminUser);

    // Criar referência com is_ativa: false via service_role.
    // Usar service_role evita restrições de RLS. A criação com service_role
    // (auth.uid() null) NÃO dispara o trigger even que is_ativa fosse alterada —
    // mas aqui estamos apenas inserindo, não atualizando is_ativa.
    testRef = await createTestReference(adminUser.id, { is_ativa: false });
  }, 30000);

  afterAll(async () => {
    // Limpar eventos de auditoria antes de excluir a referência e o usuário
    if (testRef) {
      const admin = getAdminClient();
      try {
        await admin
          .from("referencia_eventos")
          .delete()
          .eq("referencia_id", testRef.id);
      } catch {
        /* ok */
      }
      try {
        await admin.from("referencias").delete().eq("id", testRef.id);
      } catch {
        /* ok */
      }
    }
    await cleanupAllTestUsers();
  }, 30000);

  // -----------------------------------------------------------------------
  // TR1.0 — admin com JWT ativa referência via RPC → trigger gera evento
  // -----------------------------------------------------------------------
  it(
    "TR1.0: admin autenticado ativa referência via ativar_referencia → " +
      "referencia_eventos recebe is_ativa_manual com actor_id = adminUser.id",
    async () => {
      if (!feat0017M1Applied) {
        console.info(
          "TR1.0: FEAT-0017 M1 não aplicada — ignorando (migration 20260905010000)"
        );
        return;
      }

      // Admin autentica e chama ativar_referencia (referência pessoal,
      // is_ativa = false → true)
      const { data, error } = await clienteAdmin.rpc("ativar_referencia", {
        p_referencia_id: testRef.id,
      });
      expect(error).toBeNull();
      expect(data).toBe("activated");

      // Verificar que o trigger criou o evento via admin client (service_role)
      const admin = getAdminClient();
      const { data: eventos, error: eventosError } = await admin
        .from("referencia_eventos")
        .select("tipo, actor_id, detalhes")
        .eq("referencia_id", testRef.id)
        .eq("tipo", "is_ativa_manual");

      expect(eventosError).toBeNull();
      expect(eventos).toBeDefined();
      expect(eventos!.length).toBe(1);
      expect(eventos![0].actor_id).toBe(adminUser.id);
      expect(eventos![0].detalhes?.de).toBe(false);
      expect(eventos![0].detalhes?.para).toBe(true);
    }
  );

  // -----------------------------------------------------------------------
  // TR1.1 — service_role atualiza is_ativa diretamente → trigger NÃO dispara
  // -----------------------------------------------------------------------
  it(
    "TR1.1: service_role atualiza is_ativa diretamente → trigger não dispara " +
      "(auth.uid() null) — contagem de eventos permanece inalterada",
    async () => {
      if (!feat0017M1Applied) {
        console.info(
          "TR1.1: FEAT-0017 M1 não aplicada — ignorando (migration 20260905010000)"
        );
        return;
      }

      const admin = getAdminClient();

      // Contar eventos existentes (após TR1.0)
      const { data: eventosBefore } = await admin
        .from("referencia_eventos")
        .select("tipo")
        .eq("referencia_id", testRef.id)
        .eq("tipo", "is_ativa_manual");

      const countBefore = eventosBefore?.length ?? 0;

      // Atualizar is_ativa via service_role (auth.uid() = null)
      // → WHEN (auth.uid() IS NOT NULL) falha → trigger não executa
      const { error: updateError } = await admin
        .from("referencias")
        .update({ is_ativa: false })
        .eq("id", testRef.id);

      expect(updateError).toBeNull();

      // Verificar que a contagem de eventos não aumentou
      const { data: eventosAfter } = await admin
        .from("referencia_eventos")
        .select("tipo")
        .eq("referencia_id", testRef.id)
        .eq("tipo", "is_ativa_manual");

      const countAfter = eventosAfter?.length ?? 0;
      expect(countAfter).toBe(countBefore);
    }
  );
});
