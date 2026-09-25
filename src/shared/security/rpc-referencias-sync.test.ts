/**
 * Testes REALs (Abordagem B — Supabase JS client com JWTs reais) da RPC
 * aplicar_sync_referencias revisada pelo ENH-0009 (migration 20260923000000),
 * exercitada contra o banco de desenvolvimento:
 *
 * - aplicar_sync_referencias (service_role only) — aplica o plano do motor
 *   (M3) numa transação única: criações (actor Sistema, fail-high se ausente),
 *   arquivamentos por ausência (DELETE físico com fallback soft-archive) ou
 *   substituição (sempre soft-archive), eventos e contadores da sync. Qualquer
 *   exceção (versão, sync não-running, 23505, estado mudou) → ROLLBACK total.
 *   Sweep retroativo de globais is_ativa=false sem vínculos (LIMIT 100).
 *
 * PRÉ-REQUISITOS (dev): migrations ENH-0009 aplicadas E ator Sistema
 * provisionado (scripts/provisionar-ator-sistema.js). Guards comportamentais:
 * isFeat0017M4Applied + isSistemaProvisionado — sem eles, os itens retornam
 * cedo (skip limpo). Sem service role, o describe inteiro é pulado.
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
  isFeat0017M4Applied,
  isSistemaProvisionado,
  TestUser,
} from "./test-helpers";
import { construirPlanoSync } from "../referencias-sync/engine.js";
import type { SupabaseClient } from "@supabase/supabase-js";

const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const describeOrSkip = hasServiceRole ? describe : describe.skip;

const EMAIL_SISTEMA = "sistema@meufenil.local";

describeOrSkip("RPC ENH-0009: aplicar_sync_referencias (Abordagem B)", () => {
  // O vitest coleta o callback mesmo em describe.skip — sem credenciais, não
  // instanciar o client na coleta (getAdminClient lança sem as vars de ambiente).
  const admin = hasServiceRole ? getAdminClient() : (null as unknown as SupabaseClient);

  // Env dos syncs de teste com sufixo único por execução: o single-flight
  // (environment + running) rejeitaria o 2º sync running no mesmo environment.
  const runSuffix = `${Date.now()}.${Math.floor(Math.random() * 1e6)}`;
  let contador = 0;

  function nomeUnico(prefixo: string): string {
    contador += 1;
    return `_test_m4_${prefixo}_${runSuffix}_${contador}`;
  }

  /** Cria sync fixture com environment único; status e contadores configuráveis. */
  async function criarSync(
    status: string,
    extras: Record<string, unknown> = {}
  ): Promise<string> {
    contador += 1;
    const { data, error } = await admin
      .from("referencia_syncs")
      .insert({
        environment: `_test_m4_sync_${runSuffix}_${contador}`,
        trigger_source: "manual",
        status,
        criadas: 0,
        arquivadas: 0,
        ...extras,
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(`Falha ao criar sync de teste: ${error.message}`);
    }
    createdSyncIds.push(data.id);
    return data.id;
  }

  let adminUser: TestUser;
  let adminAuthClient: SupabaseClient;
  let m4Aplicada = false;
  let sistemaId: string | null = null;

  // Rastreamento da limpeza (ordem das FKs RESTRICT): eventos → pendências →
  // syncs → referências criadas pelo Sistema → usuários de teste.
  const createdSyncIds: string[] = [];
  const sistemaCreatedRefIds: string[] = [];

  async function eventosPorSync(syncId: string) {
    const { data, error } = await admin
      .from("referencia_eventos")
      .select("tipo, actor_id, referencia_id, pendencia_id, detalhes, created_at")
      .eq("sync_id", syncId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`Falha ao consultar eventos: ${error.message}`);
    return (data ?? []) as {
      tipo: string;
      actor_id: string | null;
      referencia_id: string | null;
      detalhes: Record<string, unknown>;
    }[];
  }

  beforeAll(async () => {
    m4Aplicada = await isFeat0017M4Applied();
    if (await isSistemaProvisionado()) {
      const { data } = await admin
        .from("usuarios")
        .select("id")
        .eq("email", EMAIL_SISTEMA)
        .maybeSingle();
      sistemaId = (data?.id as string | undefined) ?? null;
    }

    adminUser = await createTestUser("admin");
    trackForCleanup(adminUser.id);
    adminAuthClient = await signInAsTestUser(adminUser);
  }, 60000);

  afterAll(async () => {
    // 1. Filhas por sync (RESTRICT impede deletar o sync antes)
    for (const syncId of createdSyncIds) {
      try {
        await admin.from("referencia_eventos").delete().eq("sync_id", syncId);
      } catch { /* ignora */ }
      try {
        await admin.from("referencia_syncs").delete().eq("id", syncId);
      } catch { /* ignora */ }
    }
    // 2. Referências criadas pelo Sistema durante os testes (criado_por não é
    //    de usuário de teste — cleanupAllTestUsers não as alcança)
    for (const refId of sistemaCreatedRefIds) {
      try {
        await admin.from("referencias").delete().eq("id", refId);
      } catch { /* ignora */ }
    }
    await cleanupAllTestUsers();
  }, 30000);

  // ---------------------------------------------------------------------------
  // aplicar_sync_referencias (§7.5)
  // ---------------------------------------------------------------------------

  describe("aplicar_sync_referencias", () => {
    it("aplica plano com criação e arquivamento (substituicao) numa transação única", async () => {
      if (!m4Aplicada || !sistemaId) return;

      const syncId = await criarSync("running");
      const alvoArquivar = await createTestReference(adminUser.id, {
        is_global: true,
        nome: nomeUnico("alvo_arquivar"),
      });
      const nomeNovo = nomeUnico("criada");

      const plano = {
        versao: 1,
        criacoes: [
          { op: "create", identidade: { nome: nomeNovo, marca: "", fenil_mg_por_100g: 15 } },
        ],
        arquivamentos: [
          { op: "archive", referencia_id: alvoArquivar.id, motivo: "substituicao" },
        ],
        resumo: { equivalentes: 0, criadas: 1, arquivadas: 1 },
      };

      const { data, error } = await admin.rpc("aplicar_sync_referencias", {
        p_sync_id: syncId,
        p_plano: plano,
      });

      expect(error).toBeNull();
      expect(data).toMatchObject({
        sync_id: syncId,
        equivalentes: 0,
        criadas: 1,
        arquivadas: 1,
      });

      // Criação: linha com identidade do plano, global ativa, criado_por Sistema
      const { data: criada } = await admin
        .from("referencias")
        .select("id, nome, marca, fenil_mg_por_100g, is_global, is_ativa, criado_por")
        .eq("nome", nomeNovo)
        .single();
      if (!criada) throw new Error("Fixture ausente: referência criada pelo plano");
      expect(criada).toMatchObject({
        nome: nomeNovo,
        marca: "",
        fenil_mg_por_100g: 15,
        is_global: true,
        is_ativa: true,
        criado_por: sistemaId,
      });
      sistemaCreatedRefIds.push(criada.id);

      // Arquivamento (substituicao): alvo inativo, permanece no banco
      const { data: alvo } = await admin
        .from("referencias")
        .select("is_ativa")
        .eq("id", alvoArquivar.id)
        .single();
      if (!alvo) throw new Error("Fixture ausente: referência arquivada");
      expect(alvo.is_ativa).toBe(false);

      // Eventos com actor Sistema
      // O sweep retroativo (ENH-0009) pode gerar referencia_deletada para stale
      // refs acumuladas no banco de teste; separamos os eventos do plano do sweep.
      const eventos = await eventosPorSync(syncId);
      const eventosPlano = eventos.filter((e) => e.tipo !== "referencia_deletada");
      const eventosSweep = eventos.filter((e) => e.tipo === "referencia_deletada");
      expect(eventosPlano.map((e) => e.tipo).sort()).toEqual([
        "referencia_arquivada",
        "referencia_criada",
      ]);
      expect(eventos.every((e) => e.actor_id === sistemaId)).toBe(true);

      // Sync: contadores e alteracoes vazias (rollback removido no ENH-0009)
      const { data: sync } = await admin
        .from("referencia_syncs")
        .select("status, equivalentes, criadas, arquivadas, deletadas, alteracoes")
        .eq("id", syncId)
        .single();
      if (!sync) throw new Error("Fixture ausente: sync após aplicar");
      expect(sync).toMatchObject({
        status: "running", // a rota finaliza no estágio 8 — a RPC não transiciona
        equivalentes: 0,
        criadas: 1,
        arquivadas: 1,
        deletadas: eventosSweep.length, // sweep pode apagar stale refs do banco
      });
      expect(sync.alteracoes).toEqual([]);
    });

    it("aceita o plano produzido pelo motor real (construirPlanoSync, M3)", async () => {
      if (!m4Aplicada || !sistemaId) return;

      const syncId = await criarSync("running");
      const nomeNovo = nomeUnico("motor");

      const plano = construirPlanoSync({
        origem: [
          {
            "Nome do Produto": nomeNovo,
            "Marca do Produto": "Marca Real",
            NU_MAX_AMINOACIDO: 33,
          },
        ],
        ativas: [],
        arquivadas: [],
      });

      expect(plano.criacoes).toHaveLength(1);

      const { data, error } = await admin.rpc("aplicar_sync_referencias", {
        p_sync_id: syncId,
        p_plano: plano,
      });

      expect(error).toBeNull();
      expect(data).toMatchObject({ sync_id: syncId, criadas: 1, arquivadas: 0 });

      const { data: criada } = await admin
        .from("referencias")
        .select("id, nome, marca, fenil_mg_por_100g, is_global, criado_por")
        .eq("nome", nomeNovo)
        .single();
      if (!criada) throw new Error("Fixture ausente: referência criada pelo motor");
      expect(criada).toMatchObject({
        nome: nomeNovo,
        marca: "Marca Real",
        fenil_mg_por_100g: 33,
        is_global: true,
        criado_por: sistemaId,
      });
      sistemaCreatedRefIds.push(criada.id);
    });

    it("plano sem criações conclui a sync com success (Sistema não é exigido)", async () => {
      if (!m4Aplicada) return;

      const syncId = await criarSync("running");

      // Sem criações, Sistema não é necessário; plano vazio é válido.
      const { data, error } = await admin.rpc("aplicar_sync_referencias", {
        p_sync_id: syncId,
        p_plano: { versao: 1, criacoes: [], arquivamentos: [] },
      });

      expect(error).toBeNull();
      expect(data).toMatchObject({ sync_id: syncId, criadas: 0, arquivadas: 0 });
    });

    it("versão do plano inválida ou ausente → exceção sem efeitos", async () => {
      if (!m4Aplicada) return;

      for (const [rotulo, p_plano] of [
        ["sem versão", {}],
        ["versão desconhecida", { versao: 2 }],
      ] as const) {
        const syncId = await criarSync("running");
        const { error } = await admin.rpc("aplicar_sync_referencias", {
          p_sync_id: syncId,
          p_plano,
        });
        expect(error, rotulo).toBeTruthy();
        expect(error!.message, rotulo).toMatch(
          rotulo === "sem versão" ? /Plano de sync ausente ou sem versão/ : /Versão de plano não suportada/
        );
        // Nada foi aplicado — sync intacta
        const { data: sync } = await admin
          .from("referencia_syncs")
          .select("criadas, arquivadas, alteracoes")
          .eq("id", syncId)
          .single();
        if (!sync) throw new Error("Fixture ausente: registro de sync");
        expect(sync.alteracoes).toEqual([]);
      }
    });

    it("sync inexistente ou fora de running → exceção", async () => {
      if (!m4Aplicada) return;

      const inexistente = await admin.rpc("aplicar_sync_referencias", {
        p_sync_id: "00000000-0000-0000-0000-000000000000",
        p_plano: { versao: 1 },
      });
      expect(inexistente.error).toBeTruthy();
      expect(inexistente.error!.message).toMatch(/Sync não encontrada/);

      const syncConcluida = await criarSync("success");
      const { error } = await admin.rpc("aplicar_sync_referencias", {
        p_sync_id: syncConcluida,
        p_plano: { versao: 1 },
      });
      expect(error).toBeTruthy();
      expect(error!.message).toMatch(/Sync não está em execução/);
    });

    it("operação desconhecida no plano → exceção", async () => {
      if (!m4Aplicada) return;

      const syncId = await criarSync("running");
      const { error } = await admin.rpc("aplicar_sync_referencias", {
        p_sync_id: syncId,
        p_plano: {
          versao: 1,
          criacoes: [{ op: "delete", identidade: { nome: "X", marca: "", fenil_mg_por_100g: 1 } }],
        },
      });
      expect(error).toBeTruthy();
      expect(error!.message).toMatch(/Operação desconhecida no plano: delete/);
    });

    it("arquivar referência já inativa → exceção e ROLLBACK da criação anterior", async () => {
      if (!m4Aplicada) return;

      const syncId = await criarSync("running");
      const jaInativa = await createTestReference(adminUser.id, {
        is_global: true,
        is_ativa: false,
        nome: nomeUnico("ja_inativa"),
      });
      const nomeNaoCriado = nomeUnico("rollback");

      const { error } = await admin.rpc("aplicar_sync_referencias", {
        p_sync_id: syncId,
        p_plano: {
          versao: 1,
          criacoes: [
            { op: "create", identidade: { nome: nomeNaoCriado, marca: "", fenil_mg_por_100g: 5 } },
          ],
          arquivamentos: [{ op: "archive", referencia_id: jaInativa.id }],
        },
      });

      expect(error).toBeTruthy();
      expect(error!.message).toMatch(/não encontrada ou já inativa/);

      // Atomicidade: a criação anterior ao erro foi desfeita
      const { data: tentativa } = await admin
        .from("referencias")
        .select("id")
        .eq("nome", nomeNaoCriado);
      expect(tentativa).toHaveLength(0);
    });

    it("identidade já ativa no banco → 23505 (estado mudou) com rollback total", async () => {
      if (!m4Aplicada) return;

      const syncId = await criarSync("running");
      const existente = await createTestReference(adminUser.id, {
        is_global: true,
        nome: nomeUnico("duplicada"),
      });

      const { error } = await admin.rpc("aplicar_sync_referencias", {
        p_sync_id: syncId,
        p_plano: {
          versao: 1,
          criacoes: [
            {
              op: "create",
              identidade: { nome: existente.nome, marca: "", fenil_mg_por_100g: 10 },
            },
          ],
        },
      });

      expect(error).toBeTruthy();
      expect(error!.code).toBe("23505");
      expect(error!.message).toMatch(/Estado mudou durante a sync: identidade já ativa/);

      // Rollback: contadores zerados e alteracoes []
      const { data: sync } = await admin
        .from("referencia_syncs")
        .select("criadas, arquivadas, deletadas, alteracoes")
        .eq("id", syncId)
        .single();
      if (!sync) throw new Error("Fixture ausente: registro de sync");
      expect(sync).toMatchObject({ criadas: 0, arquivadas: 0 });
      expect(sync.alteracoes).toEqual([]);
    });

    it("authenticated (admin) NÃO pode aplicar plano — exclusivo service_role", async () => {
      if (!m4Aplicada) return;

      const { error } = await adminAuthClient.rpc("aplicar_sync_referencias", {
        p_sync_id: "00000000-0000-0000-0000-000000000000",
        p_plano: { versao: 1 },
      });
      expect(error).toBeTruthy();
      expect(error!.message).toMatch(/permission denied|Permissão negada/i);
    });
  });


});
