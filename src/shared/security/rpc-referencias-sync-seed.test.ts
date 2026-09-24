/**
 * Testes REALs (Abordagem B — Supabase JS client com JWTs reais) de
 * comportamentos de `aplicar_sync_referencias` pós-ENH-0009 (migration
 * 20260923000000), exercitados contra o banco de desenvolvimento:
 *
 * ENH-0009 removeu o seed de `pre_sync_inativa` (FEAT-0017 M6) — o campo
 * `p_plano.modo` não existe mais no contrato do plano; globais inativas
 * legadas NÃO recebem mais eventos `pre_sync_inativa` em nenhum caso.
 *
 * PRÉ-REQUISITOS (dev): migrations ENH-0009 aplicadas. Guards comportamentais:
 * sem eles, os itens retornam cedo (skip limpo). Sem service role, o describe
 * inteiro é pulado.
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  getAdminClient,
  createTestUser,
  trackForCleanup,
  cleanupAllTestUsers,
  createTestReference,
  isFeat0017M6Applied,
  TestUser,
} from "./test-helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const describeOrSkip = hasServiceRole ? describe : describe.skip;

describeOrSkip("ENH-0009: ausência de seed pre_sync_inativa em aplicar_sync_referencias (Abordagem B)", () => {
  // O vitest coleta o callback mesmo em describe.skip — sem credenciais, não
  // instanciar o client na coleta (getAdminClient lança sem as vars de ambiente).
  const admin = hasServiceRole ? getAdminClient() : (null as unknown as SupabaseClient);

  const runSuffix = `${Date.now()}.${Math.floor(Math.random() * 1e6)}`;
  let contador = 0;

  function nomeUnico(prefixo: string): string {
    contador += 1;
    return `_test_enh9_${prefixo}_${runSuffix}_${contador}`;
  }

  async function criarSync(status: string): Promise<string> {
    contador += 1;
    const { data, error } = await admin
      .from("referencia_syncs")
      .insert({
        environment: `_test_enh9_sync_${runSuffix}_${contador}`,
        trigger_source: "manual",
        status,
        criadas: 0,
        arquivadas: 0,
      })
      .select("id")
      .single();

    if (error) throw new Error(`Falha ao criar sync de teste: ${error.message}`);
    createdSyncIds.push(data.id);
    return data.id;
  }

  let adminUser: TestUser;
  let m6Aplicada = false;

  const createdSyncIds: string[] = [];
  const createdRefIds: string[] = [];

  async function eventosDaReferencia(refId: string) {
    const { data, error } = await admin
      .from("referencia_eventos")
      .select("sync_id, tipo, actor_id")
      .eq("referencia_id", refId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`Falha ao consultar eventos: ${error.message}`);
    return (data ?? []) as { sync_id: string | null; tipo: string; actor_id: string | null }[];
  }

  beforeAll(async () => {
    m6Aplicada = await isFeat0017M6Applied();
    adminUser = await createTestUser("admin");
    trackForCleanup(adminUser.id);
  }, 60000);

  afterAll(async () => {
    for (const syncId of createdSyncIds) {
      for (const tabela of ["referencia_eventos"]) {
        try { await admin.from(tabela).delete().eq("sync_id", syncId); } catch { /* ignora */ }
      }
      try { await admin.from("referencia_syncs").delete().eq("id", syncId); } catch { /* ignora */ }
    }
    for (const refId of createdRefIds) {
      try { await admin.from("referencia_eventos").delete().eq("referencia_id", refId); } catch { /* ignora */ }
    }
    await cleanupAllTestUsers();
  }, 30000);

  it("global inativa legada + plano vazio → zero pre_sync_inativa (seed removido no ENH-0009)", async () => {
    if (!m6Aplicada) return;

    const syncId = await criarSync("running");
    const ref = await createTestReference(adminUser.id, {
      is_global: true,
      is_ativa: false,
      nome: nomeUnico("legada"),
    });
    createdRefIds.push(ref.id);

    const { data, error } = await admin.rpc("aplicar_sync_referencias", {
      p_sync_id: syncId,
      p_plano: { versao: 1, criacoes: [], arquivamentos: [] },
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ sync_id: syncId, criadas: 0, arquivadas: 0 });

    const eventos = await eventosDaReferencia(ref.id);
    expect(eventos.filter((e) => e.tipo === "pre_sync_inativa")).toHaveLength(0);
  });
});
