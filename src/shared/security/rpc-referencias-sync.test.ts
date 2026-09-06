/**
 * Testes REALs (Abordagem B — Supabase JS client com JWTs reais) das RPCs do
 * M4 da FEAT-0017 (migration 20260906000000), exercitadas contra o banco de
 * desenvolvimento:
 *
 * - aplicar_sync_referencias (service_role only, §7.5) — aplica o plano do
 *   motor (M3) numa transação única: criações (actor Sistema, fail-high se
 *   ausente), arquivamentos por ausência (guarda is_ativa + RETURNING),
 *   pendências open, eventos, contadores e `alteracoes` da sync. Qualquer
 *   exceção (versão, sync não-running, 23505, estado mudou) → ROLLBACK total.
 * - decidir_pendencia_referencia (admin, §8) — curadoria de pendência open:
 *   aprovar (substitution = arquivar atual + criar proposta; absence =
 *   arquivar; new_item = criar proposta) ou rejeitar (motivo obrigatório, sem
 *   alterações). Eventos com actor = admin que decidiu; GUC app.audit_origin
 *   (D-7) suprime o trigger is_ativa_manual no arquivamento da curadoria.
 *   Última pendência open decidida → sync success.
 *
 * PRÉ-REQUISITOS (dev): migrations M1–M4 aplicadas E ator Sistema
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

describeOrSkip("RPCs FEAT-0017 M4: aplicar_sync_referencias + decidir_pendencia_referencia (Abordagem B)", () => {
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

  /** Cria pendência open fixture (sync já deve existir e não estar running). */
  async function criarPendencia(
    syncId: string,
    linha: Record<string, unknown>
  ): Promise<string> {
    const { data, error } = await admin
      .from("referencia_sync_pendencias")
      .insert({ sync_id: syncId, ...linha })
      .select("id, tipo, referencia_id, proposta")
      .single();

    if (error) {
      throw new Error(`Falha ao criar pendência de teste: ${error.message}`);
    }
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

  async function eventosPorPendencia(pendenciaId: string) {
    const { data, error } = await admin
      .from("referencia_eventos")
      .select("tipo, actor_id, referencia_id, pendencia_id, detalhes, created_at")
      .eq("pendencia_id", pendenciaId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`Falha ao consultar eventos: ${error.message}`);
    return (data ?? []) as {
      tipo: string;
      actor_id: string | null;
      referencia_id: string | null;
      detalhes: Record<string, unknown>;
    }[];
  }

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
    it("aplica plano com criação + arquivamento + pendência numa transação única", async () => {
      if (!m4Aplicada || !sistemaId) return;

      const syncId = await criarSync("running");
      const alvoArquivar = await createTestReference(adminUser.id, {
        is_global: true,
        nome: nomeUnico("alvo_arquivar"),
      });
      const nomeNovo = nomeUnico("criada");
      const nomePendencia = nomeUnico("pendencia");

      const plano = {
        versao: 1,
        modo: "pos_bootstrap",
        criacoes: [
          { op: "create", identidade: { nome: nomeNovo, marca: "", fenil_mg_por_100g: 15 } },
        ],
        arquivamentos: [
          { op: "archive", referencia_id: alvoArquivar.id },
        ],
        pendencias: [
          {
            tipo: "new_item",
            referencia_id: null,
            proposta: { nome: nomePendencia, marca: "", fenil_mg_por_100g: 20 },
            diff: null,
          },
        ],
        resumo: { equivalentes: 0, criadas: 1, arquivadas: 1, divergencias: 1 },
      };

      const { data, error } = await admin.rpc("aplicar_sync_referencias", {
        p_sync_id: syncId,
        p_plano: plano,
      });

      expect(error).toBeNull();
      expect(data).toEqual({
        sync_id: syncId,
        equivalentes: 0,
        criadas: 1,
        arquivadas: 1,
        divergencias: 1,
      });

      // Criação: linha com identidade do plano, global ativa, criado_por Sistema
      const { data: criada } = await admin
        .from("referencias")
        .select("id, nome, marca, fenil_mg_por_100g, is_global, is_ativa, criado_por")
        .eq("nome", nomeNovo)
        .single();
      expect(criada).toMatchObject({
        nome: nomeNovo,
        marca: "",
        fenil_mg_por_100g: 15,
        is_global: true,
        is_ativa: true,
        criado_por: sistemaId,
      });
      sistemaCreatedRefIds.push(criada.id);

      // Arquivamento: alvo inativo
      const { data: alvo } = await admin
        .from("referencias")
        .select("is_ativa")
        .eq("id", alvoArquivar.id)
        .single();
      expect(alvo.is_ativa).toBe(false);

      // Pendência aberta da sync
      const { data: pendencias } = await admin
        .from("referencia_sync_pendencias")
        .select("tipo, proposta, diff, status")
        .eq("sync_id", syncId);
      expect(pendencias).toHaveLength(1);
      expect(pendencias[0]).toMatchObject({
        tipo: "new_item",
        status: "open",
        diff: null,
      });
      expect(pendencias[0].proposta.nome).toBe(nomePendencia);

      // Eventos com actor Sistema; NENHUM is_ativa_manual (uid null)
      const eventos = await eventosPorSync(syncId);
      expect(eventos.map((e) => e.tipo).sort()).toEqual([
        "referencia_arquivada",
        "referencia_criada",
      ]);
      expect(eventos.every((e) => e.actor_id === sistemaId)).toBe(true);

      // Sync: contadores absolutos + alteracoes (create → archive) com
      // antes/depois — base do rollback M5
      const { data: sync } = await admin
        .from("referencia_syncs")
        .select("status, equivalentes, criadas, arquivadas, divergencias, alteracoes")
        .eq("id", syncId)
        .single();
      expect(sync).toMatchObject({
        status: "running", // a rota finaliza no estágio 8 — a RPC não transiciona
        equivalentes: 0,
        criadas: 1,
        arquivadas: 1,
        divergencias: 1,
      });
      expect(sync.alteracoes).toHaveLength(2);
      expect(sync.alteracoes[0]).toMatchObject({
        op: "create",
        antes: null,
        depois: { nome: nomeNovo, marca: "", fenil_mg_por_100g: 15 },
      });
      expect(sync.alteracoes[0].referencia_id).toBe(criada.id);
      expect(sync.alteracoes[1]).toMatchObject({
        op: "archive",
        antes: { nome: alvoArquivar.nome, marca: "", fenil_mg_por_100g: 10 },
        depois: null,
      });
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
        pendenciasAbertas: [],
        decisoes: [],
        modo: "pos_bootstrap",
      });

      expect(plano.criacoes).toHaveLength(1);

      const { data, error } = await admin.rpc("aplicar_sync_referencias", {
        p_sync_id: syncId,
        p_plano: plano,
      });

      expect(error).toBeNull();
      expect(data).toMatchObject({ sync_id: syncId, criadas: 1, divergencias: 0 });

      const { data: criada } = await admin
        .from("referencias")
        .select("id, nome, marca, fenil_mg_por_100g, is_global, criado_por")
        .eq("nome", nomeNovo)
        .single();
      expect(criada).toMatchObject({
        nome: nomeNovo,
        marca: "Marca Real",
        fenil_mg_por_100g: 33,
        is_global: true,
        criado_por: sistemaId,
      });
      sistemaCreatedRefIds.push(criada.id);
    });

    it("plano sem criações não exige o ator Sistema (resolução só quando cria)", async () => {
      if (!m4Aplicada) return;

      const syncId = await criarSync("running");

      const plano = {
        versao: 1,
        modo: "bootstrap",
        criacoes: [],
        arquivamentos: [],
        pendencias: [
          {
            tipo: "absence",
            referencia_id: null,
            proposta: null,
            diff: null,
          },
        ],
        resumo: { equivalentes: 0, divergencias: 1 },
      };

      // Este cenário roda até com o Sistema ausente (ausência só falha com
      // criações); com ele provisionado, o resultado é o mesmo.
      const { data, error } = await admin.rpc("aplicar_sync_referencias", {
        p_sync_id: syncId,
        p_plano: plano,
      });

      expect(error).toBeNull();
      expect(data).toMatchObject({ sync_id: syncId, criadas: 0, divergencias: 1 });
    });

    it("versão do plano inválida ou ausente → exceção sem efeitos", async () => {
      if (!m4Aplicada) return;

      for (const [rotulo, p_plano] of [
        ["sem versão", { modo: "bootstrap" }],
        ["versão desconhecida", { versao: 2, modo: "bootstrap" }],
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
          .select("criadas, arquivadas, divergencias, alteracoes")
          .eq("id", syncId)
          .single();
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
          pendencias: [
            {
              tipo: "new_item",
              referencia_id: null,
              proposta: { nome: nomeUnico("nao_criada"), marca: "", fenil_mg_por_100g: 3 },
              diff: null,
            },
          ],
        },
      });

      expect(error).toBeTruthy();
      expect(error!.code).toBe("23505");
      expect(error!.message).toMatch(/Estado mudou durante a sync: identidade já ativa/);

      // Rollback: a linha da sync voltou ao estado da fixture (divergencias
      // NULL — o UPDATE que o setaria para 1 foi desfeito) e alteracoes []
      const { data: pendencias } = await admin
        .from("referencia_sync_pendencias")
        .select("id")
        .eq("sync_id", syncId);
      expect(pendencias).toHaveLength(0);

      const { data: sync } = await admin
        .from("referencia_syncs")
        .select("criadas, arquivadas, divergencias, alteracoes")
        .eq("id", syncId)
        .single();
      expect(sync).toMatchObject({ criadas: 0, arquivadas: 0 });
      expect(sync.divergencias).not.toBe(1);
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

  // ---------------------------------------------------------------------------
  // decidir_pendencia_referencia (§8)
  // ---------------------------------------------------------------------------

  describe("decidir_pendencia_referencia", () => {
    it("aprovar new_item → cria a proposta (criado_por Sistema) e conclui a sync", async () => {
      if (!m4Aplicada || !sistemaId) return;

      const syncId = await criarSync("pending_review");
      const nomeProposta = nomeUnico("new_item");
      const pendenciaId = await criarPendencia(syncId, {
        tipo: "new_item",
        proposta: { nome: nomeProposta, marca: "", fenil_mg_por_100g: 25 },
      });

      const { data, error } = await adminAuthClient.rpc(
        "decidir_pendencia_referencia",
        { p_pendencia_id: pendenciaId, p_aprovar: true }
      );

      expect(error).toBeNull();
      expect(data).toMatchObject({
        pendencia_id: pendenciaId,
        status: "approved",
        sync_id: syncId,
        sync_status: "success",
      });

      const { data: criada } = await admin
        .from("referencias")
        .select("id, is_global, is_ativa, criado_por")
        .eq("nome", nomeProposta)
        .single();
      expect(criada).toMatchObject({ is_global: true, is_ativa: true, criado_por: sistemaId });
      sistemaCreatedRefIds.push(criada.id);

      // Eventos: mudanca_aprovada (actor admin) + referencia_criada (actor
      // admin, referencia_id da nova linha). created_at é now() — estável na
      // transação — então compara-se o multiset e localiza-se por tipo.
      const eventos = await eventosPorPendencia(pendenciaId);
      expect(eventos.map((e) => e.tipo).sort()).toEqual(["mudanca_aprovada", "referencia_criada"]);
      expect(eventos.every((e) => e.actor_id === adminUser.id)).toBe(true);
      const aprovacao = eventos.find((e) => e.tipo === "mudanca_aprovada")!;
      const criacao = eventos.find((e) => e.tipo === "referencia_criada")!;
      expect(aprovacao.detalhes).toMatchObject({ tipo: "new_item", diff: null });
      expect(criacao.referencia_id).toBe(criada.id);

      const { data: sync } = await admin
        .from("referencia_syncs")
        .select("status, criadas, alteracoes")
        .eq("id", syncId)
        .single();
      expect(sync.status).toBe("success");
      expect(sync.criadas).toBe(1);
      expect(sync.alteracoes).toHaveLength(1);
      expect(sync.alteracoes[0]).toMatchObject({
        op: "create",
        depois: { nome: nomeProposta, marca: "", fenil_mg_por_100g: 25 },
      });
    });

    it("aprovar absence → arquiva a referência sem evento is_ativa_manual (GUC D-7)", async () => {
      if (!m4Aplicada) return;

      const syncId = await criarSync("pending_review");
      const alvo = await createTestReference(adminUser.id, {
        is_global: true,
        nome: nomeUnico("absence"),
      });
      const pendenciaId = await criarPendencia(syncId, {
        tipo: "absence",
        referencia_id: alvo.id,
      });

      const { data, error } = await adminAuthClient.rpc(
        "decidir_pendencia_referencia",
        { p_pendencia_id: pendenciaId, p_aprovar: true }
      );

      expect(error).toBeNull();
      expect(data).toMatchObject({ status: "approved", sync_status: "success" });

      const { data: alvoFinal } = await admin
        .from("referencias")
        .select("is_ativa")
        .eq("id", alvo.id)
        .single();
      expect(alvoFinal.is_ativa).toBe(false);

      // GUC app.audit_origin='curadoria' (D-7): o arquivamento da decisão NÃO
      // dispara o trigger is_ativa_manual (o evento específico já existe)
      const { data: manuais } = await admin
        .from("referencia_eventos")
        .select("id")
        .eq("referencia_id", alvo.id)
        .eq("tipo", "is_ativa_manual");
      expect(manuais).toHaveLength(0);

      const eventos = await eventosPorPendencia(pendenciaId);
      expect(eventos.map((e) => e.tipo).sort()).toEqual(["mudanca_aprovada", "referencia_arquivada"]);
      expect(eventos.every((e) => e.actor_id === adminUser.id)).toBe(true);

      const { data: sync } = await admin
        .from("referencia_syncs")
        .select("arquivadas, alteracoes")
        .eq("id", syncId)
        .single();
      expect(sync.arquivadas).toBe(1);
      expect(sync.alteracoes).toHaveLength(1);
      expect(sync.alteracoes[0].op).toBe("archive");
    });

    it("aprovar substitution → arquiva a atual e cria a proposta (2 alteracoes)", async () => {
      if (!m4Aplicada || !sistemaId) return;

      const syncId = await criarSync("pending_review");
      const nomeAlvo = nomeUnico("substituicao");
      const alvo = await createTestReference(adminUser.id, {
        is_global: true,
        nome: nomeAlvo,
      });
      const pendenciaId = await criarPendencia(syncId, {
        tipo: "substitution",
        referencia_id: alvo.id,
        proposta: { nome: nomeAlvo, marca: "", fenil_mg_por_100g: 30 },
        diff: [{ campo: "fenil_mg_por_100g", antes: 10, depois: 30 }],
      });

      const { data, error } = await adminAuthClient.rpc(
        "decidir_pendencia_referencia",
        { p_pendencia_id: pendenciaId, p_aprovar: true }
      );

      expect(error).toBeNull();
      expect(data).toMatchObject({ status: "approved", sync_status: "success" });

      const { data: criada } = await admin
        .from("referencias")
        .select("id, nome, fenil_mg_por_100g, is_ativa, criado_por")
        .eq("nome", nomeAlvo)
        .eq("is_ativa", true)
        .single();
      expect(criada).toMatchObject({ nome: nomeAlvo, fenil_mg_por_100g: 30, criado_por: sistemaId });
      sistemaCreatedRefIds.push(criada.id);

      const eventos = await eventosPorPendencia(pendenciaId);
      expect(eventos.map((e) => e.tipo).sort()).toEqual([
        "mudanca_aprovada",
        "referencia_arquivada",
        "referencia_criada",
      ]);
      expect(eventos.every((e) => e.actor_id === adminUser.id)).toBe(true);
      const aprovacao = eventos.find((e) => e.tipo === "mudanca_aprovada")!;
      const criacao = eventos.find((e) => e.tipo === "referencia_criada")!;
      expect(aprovacao.detalhes.diff).toEqual([
        { campo: "fenil_mg_por_100g", antes: 10, depois: 30 },
      ]);
      expect(criacao.referencia_id).toBe(criada.id);

      const { data: sync } = await admin
        .from("referencia_syncs")
        .select("criadas, arquivadas, alteracoes")
        .eq("id", syncId)
        .single();
      expect(sync).toMatchObject({ criadas: 1, arquivadas: 1 });
      expect(sync.alteracoes).toHaveLength(2);
      expect(sync.alteracoes.map((a: { op: string }) => a.op).sort()).toEqual([
        "archive",
        "create",
      ]);
    });

    it("rejeitar exige motivo (CHECK + RPC)", async () => {
      if (!m4Aplicada) return;

      const syncId = await criarSync("pending_review");
      const pendenciaId = await criarPendencia(syncId, {
        tipo: "new_item",
        proposta: { nome: nomeUnico("sem_motivo"), marca: "", fenil_mg_por_100g: 1 },
      });

      const { error } = await adminAuthClient.rpc("decidir_pendencia_referencia", {
        p_pendencia_id: pendenciaId,
        p_aprovar: false,
      });
      expect(error).toBeTruthy();
      expect(error!.message).toMatch(/Rejeição exige motivo/);

      const { data: pendencia } = await admin
        .from("referencia_sync_pendencias")
        .select("status")
        .eq("id", pendenciaId)
        .single();
      expect(pendencia.status).toBe("open");
    });

    it("rejeitar com motivo → divergência conhecida, sem alterações de dados", async () => {
      if (!m4Aplicada) return;

      const syncId = await criarSync("pending_review");
      const alvo = await createTestReference(adminUser.id, {
        is_global: true,
        nome: nomeUnico("rejeitada"),
      });
      // Segunda pendência na mesma sync: a rejeição da 1ª não conclui a sync
      const pendenciaId = await criarPendencia(syncId, {
        tipo: "absence",
        referencia_id: alvo.id,
      });
      await criarPendencia(syncId, {
        tipo: "absence",
        referencia_id: (await createTestReference(adminUser.id, {
          is_global: true,
          nome: nomeUnico("rejeitada_2"),
        })).id,
      });

      const { data, error } = await adminAuthClient.rpc("decidir_pendencia_referencia", {
        p_pendencia_id: pendenciaId,
        p_aprovar: false,
        p_motivo: "  Alimento descontinuado pela fonte  ",
      });

      expect(error).toBeNull();
      expect(data).toMatchObject({
        pendencia_id: pendenciaId,
        status: "rejected",
        sync_status: "pending_review", // ainda há aberta — não conclui
      });

      const { data: pendencia } = await admin
        .from("referencia_sync_pendencias")
        .select("status, motivo, decided_by")
        .eq("id", pendenciaId)
        .single();
      expect(pendencia).toMatchObject({
        status: "rejected",
        motivo: "Alimento descontinuado pela fonte", // btrim
        decided_by: adminUser.id,
      });

      // Nenhuma alteração de dados: alvo segue ativa, contadores zerados
      const { data: alvoFinal } = await admin
        .from("referencias")
        .select("is_ativa")
        .eq("id", alvo.id)
        .single();
      expect(alvoFinal.is_ativa).toBe(true);

      const eventos = await eventosPorPendencia(pendenciaId);
      expect(eventos).toHaveLength(1);
      expect(eventos[0]).toMatchObject({
        tipo: "mudanca_rejeitada",
        actor_id: adminUser.id,
        detalhes: {
          tipo: "absence",
          motivo: "Alimento descontinuado pela fonte",
        },
      });
    });

    it("pendência terminal (rejected) não aceita nova decisão", async () => {
      if (!m4Aplicada) return;

      const syncId = await criarSync("pending_review");
      const pendenciaId = await criarPendencia(syncId, {
        tipo: "new_item",
        proposta: { nome: nomeUnico("terminal"), marca: "", fenil_mg_por_100g: 2 },
      });

      await adminAuthClient.rpc("decidir_pendencia_referencia", {
        p_pendencia_id: pendenciaId,
        p_aprovar: false,
        p_motivo: "Item fora do escopo",
      });

      const { error } = await adminAuthClient.rpc("decidir_pendencia_referencia", {
        p_pendencia_id: pendenciaId,
        p_aprovar: true,
      });
      expect(error).toBeTruthy();
      expect(error!.message).toMatch(/PENDENCIA_NAO_ENCONTRADA: pendência não está aberta/);

      // Nada criado pela segunda decisão
      const { data: criadas } = await admin
        .from("referencias")
        .select("id")
        .eq("criado_por", sistemaId ?? "00000000-0000-0000-0000-000000000000")
        .ilike("nome", `_test_m4_terminal%`);
      expect(criadas).toHaveLength(0);
    });

    it("pendência de sync running → exceção, nada decidido", async () => {
      if (!m4Aplicada) return;

      const syncId = await criarSync("running");
      const pendenciaId = await criarPendencia(syncId, {
        tipo: "new_item",
        proposta: { nome: nomeUnico("running"), marca: "", fenil_mg_por_100g: 4 },
      });

      const { error } = await adminAuthClient.rpc("decidir_pendencia_referencia", {
        p_pendencia_id: pendenciaId,
        p_aprovar: true,
      });
      expect(error).toBeTruthy();
      expect(error!.message).toMatch(/Sync ainda em execução/);

      const { data: pendencia } = await admin
        .from("referencia_sync_pendencias")
        .select("status")
        .eq("id", pendenciaId)
        .single();
      expect(pendencia.status).toBe("open");

      const eventos = await eventosPorSync(syncId);
      expect(eventos).toHaveLength(0);
    });

    it("pendência inexistente → PENDENCIA_NAO_ENCONTRADA", async () => {
      if (!m4Aplicada) return;

      const { error } = await adminAuthClient.rpc("decidir_pendencia_referencia", {
        p_pendencia_id: "00000000-0000-0000-0000-000000000000",
        p_aprovar: true,
      });
      expect(error).toBeTruthy();
      expect(error!.message).toMatch(/PENDENCIA_NAO_ENCONTRADA/);
    });

    it("service_role NÃO pode decidir — curadoria é ação de admin com sessão", async () => {
      if (!m4Aplicada) return;

      const { error } = await admin.rpc("decidir_pendencia_referencia", {
        p_pendencia_id: "00000000-0000-0000-0000-000000000000",
        p_aprovar: true,
      });
      expect(error).toBeTruthy();
      expect(error!.message).toMatch(/permission denied|Permissão negada/i);
    });

    it("última pendência aberta decidida (mesmo rejeitada) → sync success", async () => {
      if (!m4Aplicada) return;

      const syncId = await criarSync("pending_review");
      const alvo = await createTestReference(adminUser.id, {
        is_global: true,
        nome: nomeUnico("ultima"),
      });
      const pendenciaId = await criarPendencia(syncId, {
        tipo: "absence",
        referencia_id: alvo.id,
      });

      const { data, error } = await adminAuthClient.rpc("decidir_pendencia_referencia", {
        p_pendencia_id: pendenciaId,
        p_aprovar: false,
        p_motivo: "Ausência aceita — item fora da lista vigente",
      });

      expect(error).toBeNull();
      expect(data).toMatchObject({ status: "rejected", sync_status: "success" });

      const { data: sync } = await admin
        .from("referencia_syncs")
        .select("status, message")
        .eq("id", syncId)
        .single();
      expect(sync).toMatchObject({
        status: "success",
        message: "Curadoria concluída — todas as pendências foram decididas",
      });
    });
  });
});
