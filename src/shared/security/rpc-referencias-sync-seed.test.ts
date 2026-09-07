/**
 * Testes REALs (Abordagem B — Supabase JS client com JWTs reais) do seed do
 * M6 da FEAT-0017 (migration 20260907000000), exercitados contra o banco de
 * desenvolvimento:
 *
 * - `aplicar_sync_referencias` ganhou o passo 7 (seed R4-2a/design §14.5):
 *   SOMENTE quando p_plano.modo = 'bootstrap' (1ª sync confiável do ambiente),
 *   grava 1 evento `pre_sync_inativa` por global inativa SEM NENHUM evento de
 *   auditoria — histórico honesto do arquivamento manual pré-FEAT. Actor NULL
 *   (não é ação do Sistema nem de admin; §5.3). Mesma transação da aplicação.
 *
 * O seed é SQL puro — não há unidade TS a testar (o plano bootstrap = zero
 * auto já é coberto pelo compare.test.ts do M3); a cobertura real exercita o
 * comportamento: seed na 1ª sync (bootstrap), NÃO-seed quando a global já tem
 * evento (is_ativa_manual), NÃO-seed fora do modo bootstrap e idempotência.
 *
 * PRÉ-REQUISITOS (dev): migrations M1–M6 aplicadas E conexão direta
 * (SUPABASE_DATABASE_URL no .env.development — o guard isFeat0017M6Applied
 * inspeciona o corpo da função no pg_proc). Guards comportamentais: sem eles,
 * os itens retornam cedo (skip limpo). Sem service role, o describe inteiro é
 * pulado.
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

describeOrSkip("FEAT-0017 M6: seed pre_sync_inativa em aplicar_sync_referencias (Abordagem B)", () => {
  // O vitest coleta o callback mesmo em describe.skip — sem credenciais, não
  // instanciar o client na coleta (getAdminClient lança sem as vars de ambiente).
  const admin = hasServiceRole ? getAdminClient() : (null as unknown as SupabaseClient);

  // Env dos syncs de teste com sufixo único por execução: o single-flight
  // (environment + running) rejeitaria o 2º sync running no mesmo environment.
  const runSuffix = `${Date.now()}.${Math.floor(Math.random() * 1e6)}`;
  let contador = 0;

  function nomeUnico(prefixo: string): string {
    contador += 1;
    return `_test_m6_${prefixo}_${runSuffix}_${contador}`;
  }

  /** Cria sync fixture com environment único; status configurável. */
  async function criarSync(status: string): Promise<string> {
    contador += 1;
    const { data, error } = await admin
      .from("referencia_syncs")
      .insert({
        environment: `_test_m6_sync_${runSuffix}_${contador}`,
        trigger_source: "manual",
        status,
        criadas: 0,
        arquivadas: 0,
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(`Falha ao criar sync de teste: ${error.message}`);
    }
    createdSyncIds.push(data.id);
    return data.id;
  }

  /** Global inativa "legada" (is_ativa = false no INSERT — sem trigger de
   *  auditoria: o trigger M1 é AFTER UPDATE; INSERT direto não gera evento). */
  async function criarGlobalInativaLegada(): Promise<string> {
    const ref = await createTestReference(adminUser.id, {
      is_global: true,
      is_ativa: false,
      nome: nomeUnico("legada"),
    });
    createdRefIds.push(ref.id);
    return ref.id;
  }

  /** Evento de auditoria manual pré-existente (simula is_ativa_manual do
   *  trigger M1 em arquivamento feito por admin antes do sync). */
  async function adicionarEventoManual(refId: string): Promise<void> {
    const { error } = await admin.from("referencia_eventos").insert({
      referencia_id: refId,
      tipo: "is_ativa_manual",
      actor_id: adminUser.id,
      detalhes: { de: true, para: false },
    });
    if (error) {
      throw new Error(`Falha ao criar evento manual de teste: ${error.message}`);
    }
  }

  let adminUser: TestUser;
  let m6Aplicada = false;

  // Rastreamento da limpeza (ordem das FKs RESTRICT): eventos → pendências →
  // syncs → referências criadas pelo usuário de teste → usuários de teste.
  const createdSyncIds: string[] = [];
  const createdRefIds: string[] = [];

  async function eventosDaReferencia(refId: string) {
    const { data, error } = await admin
      .from("referencia_eventos")
      .select("sync_id, tipo, actor_id, detalhes")
      .eq("referencia_id", refId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`Falha ao consultar eventos: ${error.message}`);
    return (data ?? []) as {
      sync_id: string | null;
      tipo: string;
      actor_id: string | null;
      detalhes: Record<string, unknown>;
    }[];
  }

  beforeAll(async () => {
    m6Aplicada = await isFeat0017M6Applied();
    adminUser = await createTestUser("admin");
    trackForCleanup(adminUser.id);
  }, 60000);

  afterAll(async () => {
    // 1. Filhas por sync (RESTRICT impede deletar o sync antes)
    for (const syncId of createdSyncIds) {
      for (const tabela of [
        "referencia_eventos",
        "referencia_sync_pendencias",
      ]) {
        try {
          await admin.from(tabela).delete().eq("sync_id", syncId);
        } catch { /* ignora */ }
      }
      try {
        await admin.from("referencia_syncs").delete().eq("id", syncId);
      } catch { /* ignora */ }
    }
    // 2. Referências dos testes (o cleanup de usuários também as alcançaria —
    //    eventos com FK ON DELETE SET NULL não bloqueiam; ordem redundante por
    //    clareza, já que o cleanupAllTestUsers roda ao final)
    for (const refId of createdRefIds) {
      try {
        await admin.from("referencia_eventos").delete().eq("referencia_id", refId);
      } catch { /* ignora */ }
    }
    await cleanupAllTestUsers();
  }, 30000);

  /** Plano bootstrap mínimo (zero auto — o motor nunca emite efeito). */
  function planoBootstrap() {
    return {
      versao: 1,
      modo: "bootstrap",
      criacoes: [],
      arquivamentos: [],
      pendencias: [],
      resumo: { equivalentes: 0, criadas: 0, arquivadas: 0, divergencias: 0 },
    };
  }

  it("bootstrap com global inativa legada → 1 evento pre_sync_inativa (actor NULL, sync da 1ª sync)", async () => {
    if (!m6Aplicada) return;

    const syncId = await criarSync("running");
    const legadaId = await criarGlobalInativaLegada();

    const { data, error } = await admin.rpc("aplicar_sync_referencias", {
      p_sync_id: syncId,
      p_plano: planoBootstrap(),
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({
      sync_id: syncId,
      equivalentes: 0,
      criadas: 0,
      arquivadas: 0,
      divergencias: 0,
    });

    // Seed: 1 evento pre_sync_inativa vinculado à sync bootstrap; actor NULL
    // (arquivamento manual pré-FEAT — não é ação do Sistema nem de admin) e
    // detalhes vazios (o tipo carrega a semântica; identidade vive na linha).
    const eventos = await eventosDaReferencia(legadaId);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({
      sync_id: syncId,
      tipo: "pre_sync_inativa",
      actor_id: null,
      detalhes: {},
    });

    // Seed não altera contadores nem status (a rota finaliza no estágio 8)
    const { data: sync } = await admin
      .from("referencia_syncs")
      .select("status, criadas, arquivadas, divergencias, alteracoes")
      .eq("id", syncId)
      .single();
    if (!sync) throw new Error("Fixture ausente: registro de sync");
    expect(sync).toMatchObject({
      status: "running",
      criadas: 0,
      arquivadas: 0,
      divergencias: 0,
    });
    expect(sync.alteracoes).toEqual([]);
  });

  it("bootstrap com global inativa QUE JÁ TEM evento → sem seed (histórico honesto preservado)", async () => {
    if (!m6Aplicada) return;

    const syncId = await criarSync("running");
    const jaAuditadaId = await criarGlobalInativaLegada();
    await adicionarEventoManual(jaAuditadaId);

    const { data, error } = await admin.rpc("aplicar_sync_referencias", {
      p_sync_id: syncId,
      p_plano: planoBootstrap(),
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ sync_id: syncId });

    // Só o evento manual pré-existente; nenhum pre_sync_inativa duplicado
    const eventos = await eventosDaReferencia(jaAuditadaId);
    expect(eventos.map((e) => e.tipo)).toEqual(["is_ativa_manual"]);
    expect(eventos.filter((e) => e.sync_id === syncId)).toHaveLength(0);
  });

  it("NÃO-bootstrap (pos_bootstrap) com global inativa legada → sem seed", async () => {
    if (!m6Aplicada) return;

    const syncId = await criarSync("running");
    const legadaId = await criarGlobalInativaLegada();

    const plano = {
      ...planoBootstrap(),
      modo: "pos_bootstrap",
    };

    const { data, error } = await admin.rpc("aplicar_sync_referencias", {
      p_sync_id: syncId,
      p_plano: plano,
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ sync_id: syncId });

    // 2ª sync do ambiente (confiável): o seed pertence à 1ª — nada gravado
    const eventos = await eventosDaReferencia(legadaId);
    expect(eventos).toHaveLength(0);
  });

  it("plano sem o campo modo (contrato antigo) → sem seed (default seguro)", async () => {
    if (!m6Aplicada) return;

    const syncId = await criarSync("running");
    const legadaId = await criarGlobalInativaLegada();

    const plano = {
      versao: 1,
      criacoes: [],
      arquivamentos: [],
      pendencias: [],
      resumo: { equivalentes: 0, divergencias: 0 },
    };

    const { data, error } = await admin.rpc("aplicar_sync_referencias", {
      p_sync_id: syncId,
      p_plano: plano,
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ sync_id: syncId });

    const eventos = await eventosDaReferencia(legadaId);
    expect(eventos).toHaveLength(0);
  });

  it("seed é idempotente por construção — 2ª aplicação bootstrap não duplica eventos", async () => {
    if (!m6Aplicada) return;

    const syncId = await criarSync("running");
    const legadaId = await criarGlobalInativaLegada();

    // 1ª aplicação: seed gravado
    const primeira = await admin.rpc("aplicar_sync_referencias", {
      p_sync_id: syncId,
      p_plano: planoBootstrap(),
    });
    expect(primeira.error).toBeNull();

    // 2ª aplicação na mesma sync ainda running (a rota finaliza depois):
    // a legada já tem evento → candidatura some → nenhum evento novo
    const segunda = await admin.rpc("aplicar_sync_referencias", {
      p_sync_id: syncId,
      p_plano: planoBootstrap(),
    });
    expect(segunda.error).toBeNull();

    const eventos = await eventosDaReferencia(legadaId);
    expect(eventos.map((e) => e.tipo)).toEqual(["pre_sync_inativa"]);
    expect(eventos).toHaveLength(1);
  });

  it("seed não dispara o trigger is_ativa_manual (é INSERT de evento, não UPDATE de referência)", async () => {
    if (!m6Aplicada) return;

    const syncId = await criarSync("running");
    const legadaId = await criarGlobalInativaLegada();

    const { error } = await admin.rpc("aplicar_sync_referencias", {
      p_sync_id: syncId,
      p_plano: planoBootstrap(),
    });
    expect(error).toBeNull();

    const { data: linha } = await admin
      .from("referencias")
      .select("is_ativa")
      .eq("id", legadaId)
      .single();
    if (!linha) throw new Error("Fixture ausente: referência legada");
    expect(linha.is_ativa).toBe(false);

    // Referência segue inativa; trilha apenas com o evento do seed
    const eventos = await eventosDaReferencia(legadaId);
    expect(eventos.map((e) => e.tipo)).toEqual(["pre_sync_inativa"]);
  });
});
