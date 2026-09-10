/**
 * Testes REALs (Abordagem B — Supabase JS client com JWTs reais) das RPCs do
 * M5 da FEAT-0017 (migration 20260906010000), exercitadas contra o banco de
 * desenvolvimento:
 *
 * - reverter_sync_referencias (§10.1) — rollback seletivo por admin com
 *   `pode_recuperacao`: para cada op de `alteracoes` (shape do M4 — create/
 *   archive) em ORDEM REVERSA, aplica a inversa com guarda de estado por op
 *   ("preservar alterações posteriores" — draft §29): reativação de archive
 *   só se a linha ainda estiver inativa E com a mesma identidade pós-sync;
 *   arquivamento de create só se ainda ativa; colisão 23505 no índice de
 *   identidade ativa → skip por op (decisão humana 2026-09-06). Pendências
 *   open da sync → cancelled (decididas permanecem — histórico). Evento
 *   `rollback` por operação + `pendencia_cancelada` por pendência; GUC
 *   app.audit_origin suprime o trigger is_ativa_manual nos flips. Status →
 *   `reverted` + message-resumo. Guarda B10c POR ENVIRONMENT (decisão humana
 *   2026-09-06): bloqueia apenas syncs running no environment do alvo.
 *   Testes via Abordagem B HTTP (as operações são direcionadas a ids/env
 *   próprios — seguras no dev DB compartilhado).
 * - restaurar_referencias_de_backup (§10.2) — recuperação excepcional do
 *   catálogo global a partir do backup (payload completo + payload_sha256
 *   verificado ANTES de qualquer efeito — design §9): reativa a arquivada de
 *   mesmo id (guarda de identidade), cria do backup (id original, actor
 *   Sistema — B5) ou arquiva ativas de hoje sem correspondência; nunca toca
 *   pessoais (D-4), nunca DELETE; cancela TODAS as pendências open (decisão
 *   humana 2026-09-06); evento `restore` único com contagens/ids; não cria
 *   linha de sync (D-5).
 *
 * A RPC de restore REEESCREVE O CATÁLOGO GLOBAL por design (sem filtro de
 * environment — produção só tem 'prod'). Executá-la fora de transação contra
 * o dev DB compartilhado arquivaria as ~3.1k globais reais do dev. Decisões
 * humanas 2026-09-06: (1) o happy path roda DENTRO DE TRANSAÇÃO PG DIRETA
 * (SUPABASE_DATABASE_URL) com claims de sessão forjadas para o admin com a
 * flag — execução real da RPC com ROLLBACK ao final + asserts pós-rollback
 * provando zero persistência; (2) os caminhos que abortam ANTES de efeito
 * (permissão, backup inexistente, integridade, guarda running) e o conflito
 * (aborta antes da varredura global) seguem via HTTP com JWT real; (3)
 * vitest roda arquivos em paralelo por padrão — `fileParallelism: false`
 * foi adotado no vitest.config.ts (suítes REAL serializadas; o happy path
 * transacional seria seguro até em paralelo, mas os demais testes REAL
 * compartilham o dev DB).
 *
 * PRÉ-REQUISITOS (dev): migrations M1–M5 aplicadas E ator Sistema
 * provisionado (scripts/provisionar-ator-sistema.js — necessário apenas no
 * ramo de criação do restore). Guards comportamentais: isFeat0017M5Applied +
 * isSistemaProvisionado — sem eles, os itens retornam cedo (skip limpo). O
 * happy path do restore exige também SUPABASE_DATABASE_URL (conexão PG
 * direta). Sem service role, o describe inteiro é pulado.
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import {
  getAdminClient,
  createTestUser,
  signInAsTestUser,
  cleanupAllTestUsers,
  createTestReference,
  isFeat0017M5Applied,
  isSistemaProvisionado,
  TestUser,
} from "./test-helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const describeOrSkip = hasServiceRole ? describe : describe.skip;

const EMAIL_SISTEMA = "sistema@meufenil.local";
const UUID_ZERO = "00000000-0000-0000-0000-000000000000";

/** Conexão PG direta — usada APENAS no happy path do restore (transação com
 *  rollback); sem ela o teste retorna cedo (skip limpo). */
const dbUrl =
  process.env.SUPABASE_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL;

describeOrSkip("RPCs FEAT-0017 M5: reverter_sync_referencias + restaurar_referencias_de_backup (Abordagem B)", () => {
  // O vitest coleta o callback mesmo em describe.skip — sem credenciais, não
  // instanciar o client na coleta (getAdminClient lança sem as vars de ambiente).
  const admin = hasServiceRole ? getAdminClient() : (null as unknown as SupabaseClient);

  // Env dos syncs de teste com sufixo único por execução: o single-flight
  // (environment + running) rejeitaria o 2º sync running no mesmo environment.
  const runSuffix = `${Date.now()}.${Math.floor(Math.random() * 1e6)}`;
  let contador = 0;

  function nomeUnico(prefixo: string): string {
    contador += 1;
    return `_test_m5_${prefixo}_${runSuffix}_${contador}`;
  }

  /** Cria sync fixture; environment único por padrão (override via extras). */
  async function criarSync(
    status: string,
    extras: Record<string, unknown> = {}
  ): Promise<string> {
    contador += 1;
    const { data, error } = await admin
      .from("referencia_syncs")
      .insert({
        environment: `_test_m5_sync_${runSuffix}_${contador}`,
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

  /** Cria pendência fixture (sync já deve existir; status default open). */
  async function criarPendencia(
    syncId: string,
    linha: Record<string, unknown>
  ): Promise<string> {
    const { data, error } = await admin
      .from("referencia_sync_pendencias")
      .insert({ sync_id: syncId, ...linha })
      .select("id, tipo, referencia_id, status")
      .single();

    if (error) {
      throw new Error(`Falha ao criar pendência de teste: ${error.message}`);
    }
    createdPendenciaIds.push(data.id);
    return data.id;
  }

  /** Cria backup fixture no formato do produtor (M2): payload = TEXTO do
   *  JSON.stringify das linhas, inserido como string → jsonb string scalar. */
  async function criarBackup(
    syncId: string,
    payloadTexto: string,
    payloadSha256: string
  ): Promise<string> {
    const { data, error } = await admin
      .from("referencia_backups")
      .insert({
        sync_id: syncId,
        payload: payloadTexto,
        payload_sha256: payloadSha256,
        contagem: 1,
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(`Falha ao criar backup de teste: ${error.message}`);
    }
    createdBackupIds.push(data.id);
    return data.id;
  }

  /** Identidade {nome, marca, fenil_mg_por_100g} — shape do shape `antes`/
   *  `depois` de `alteracoes` (M4). */
  function identidadeDa(row: {
    nome: string;
    marca: string;
    fenil_mg_por_100g: number;
  }): { nome: string; marca: string; fenil_mg_por_100g: number } {
    return { nome: row.nome, marca: row.marca, fenil_mg_por_100g: row.fenil_mg_por_100g };
  }

  async function linhaDa(refId: string): Promise<{
    id: string;
    nome: string;
    marca: string;
    fenil_mg_por_100g: number;
    is_ativa: boolean;
  }> {
    const { data, error } = await admin
      .from("referencias")
      .select("id, nome, marca, fenil_mg_por_100g, is_ativa")
      .eq("id", refId)
      .single();

    if (!data || error) {
      throw new Error(`Falha ao consultar referência ${refId}: ${error?.message}`);
    }
    return data;
  }

  type LinhaEvento = {
    tipo: string;
    actor_id: string | null;
    sync_id: string | null;
    pendencia_id: string | null;
    referencia_id: string | null;
    detalhes: Record<string, unknown>;
  };

  const COLUNAS_EVENTO =
    "tipo, actor_id, sync_id, pendencia_id, referencia_id, detalhes, created_at";

  async function eventosPorSync(syncId: string): Promise<LinhaEvento[]> {
    const { data, error } = await admin
      .from("referencia_eventos")
      .select(COLUNAS_EVENTO)
      .eq("sync_id", syncId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`Falha ao consultar eventos: ${error.message}`);
    return (data ?? []) as LinhaEvento[];
  }

  async function eventosPorPendencia(pendenciaId: string): Promise<LinhaEvento[]> {
    const { data, error } = await admin
      .from("referencia_eventos")
      .select(COLUNAS_EVENTO)
      .eq("pendencia_id", pendenciaId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`Falha ao consultar eventos: ${error.message}`);
    return (data ?? []) as LinhaEvento[];
  }

  /** Eventos `restore` cujo detalhe referencia este backup (sync_id null). */
  async function eventosRestoreDoBackup(backupId: string): Promise<LinhaEvento[]> {
    const { data, error } = await admin
      .from("referencia_eventos")
      .select(COLUNAS_EVENTO)
      .eq("tipo", "restore")
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Falha ao consultar eventos restore: ${error.message}`);
    return ((data ?? []) as LinhaEvento[]).filter(
      (e) => e.detalhes?.backup_id === backupId
    );
  }

  async function eventosManualDe(refId: string): Promise<LinhaEvento[]> {
    const { data, error } = await admin
      .from("referencia_eventos")
      .select(COLUNAS_EVENTO)
      .eq("tipo", "is_ativa_manual")
      .eq("referencia_id", refId);
    if (error) throw new Error(`Falha ao consultar eventos manuais: ${error.message}`);
    return (data ?? []) as LinhaEvento[];
  }

  /** Total de globais ATIVAS no catálogo (inclui as reais do dev) — prova de
   *  zero colateral do happy path do restore após o rollback. */
  async function contarGlobaisAtivas(): Promise<number> {
    const { count, error } = await admin
      .from("referencias")
      .select("id", { count: "exact", head: true })
      .eq("is_global", true)
      .eq("is_ativa", true);
    if (error) throw new Error(`Falha ao contar globais ativas: ${error.message}`);
    return count ?? 0;
  }

  let adminAutorizado: TestUser;
  let adminAutorizadoClient: SupabaseClient;
  let adminSemFlag: TestUser;
  let adminSemFlagClient: SupabaseClient;
  let sistemaId: string | null = null;
  let m5Aplicada = false;

  // Rastreamento da limpeza (ordem das FKs RESTRICT): eventos → pendências →
  // backups → syncs → usuários de teste (as referências fixtures são dos
  // usuários de teste — cleanupAllTestUsers as remove por criado_por).
  const createdSyncIds: string[] = [];
  const createdPendenciaIds: string[] = [];
  const createdBackupIds: string[] = [];

  beforeAll(async () => {
    m5Aplicada = await isFeat0017M5Applied();
    if (!m5Aplicada) return;

    if (await isSistemaProvisionado()) {
      const { data } = await admin
        .from("usuarios")
        .select("id")
        .eq("email", EMAIL_SISTEMA)
        .maybeSingle();
      sistemaId = data?.id ?? null;
    }

    // Dois admins reais: um com pode_recuperacao (concedida manualmente — a
    // flag nasce false e só o dono do projeto concede), outro sem a flag.
    adminAutorizado = await createTestUser("admin");
    adminAutorizadoClient = await signInAsTestUser(adminAutorizado);

    adminSemFlag = await createTestUser("admin");
    adminSemFlagClient = await signInAsTestUser(adminSemFlag);

    const { error: erroFlag } = await admin
      .from("usuarios")
      .update({ pode_recuperacao: true })
      .eq("id", adminAutorizado.id);
    if (erroFlag) {
      throw new Error(`Falha ao conceder pode_recuperacao: ${erroFlag.message}`);
    }
  }, 60000);

  afterAll(async () => {
    // Filhas por sync (RESTRICT impede deletar sync antes): eventos,
    // pendências, backups, snapshots. O happy path do restore roda em
    // transação com ROLLBACK — nada dele persiste (nem eventos restore de
    // sync_id null, nem referências criadas com ator Sistema), então a
    // limpeza não precisa alcançá-los.
    for (const syncId of createdSyncIds) {
      for (const tabela of [
        "referencia_eventos",
        "referencia_sync_pendencias",
        "referencia_backups",
        "referencia_snapshots",
      ]) {
        try {
          await admin.from(tabela).delete().eq("sync_id", syncId);
        } catch { /* ignora */ }
      }
      try {
        await admin.from("referencia_syncs").delete().eq("id", syncId);
      } catch { /* ignora */ }
    }
    await cleanupAllTestUsers();
  }, 30000);

  // ---------------------------------------------------------------------------
  // reverter_sync_referencias (§10.1)
  // ---------------------------------------------------------------------------

  describe("reverter_sync_referencias", () => {
    it("nega a admin sem pode_recuperacao (permissão específica §12.4)", async () => {
      if (!m5Aplicada) return;

      const { error } = await adminSemFlagClient.rpc("reverter_sync_referencias", {
        p_sync_id: UUID_ZERO,
      });
      expect(error).toBeTruthy();
      expect(error!.message).toMatch(/apenas administradores com permissão de recuperação/);
    });

    it("sync inexistente → exceção", async () => {
      if (!m5Aplicada) return;

      const { error } = await adminAutorizadoClient.rpc("reverter_sync_referencias", {
        p_sync_id: UUID_ZERO,
      });
      expect(error).toBeTruthy();
      expect(error!.message).toMatch(/Sync não encontrada/);
    });

    it("reverte create + archive (ordem reversa) com eventos `rollback` por op e sem is_ativa_manual", async () => {
      if (!m5Aplicada) return;

      // Estado fabricado "pós-sync": A arquivada pela sync, C criada pela sync
      const refA = await createTestReference(adminAutorizado.id, {
        is_global: true,
        nome: nomeUnico("revert_a"),
      });
      await admin.from("referencias").update({ is_ativa: false }).eq("id", refA.id);
      const refC = await createTestReference(adminAutorizado.id, {
        is_global: true,
        nome: nomeUnico("revert_c"),
      });

      const identA = await linhaDa(refA.id);
      const identC = await linhaDa(refC.id);

      const syncId = await criarSync("success", {
        alteracoes: [
          { op: "archive", referencia_id: refA.id, antes: identidadeDa(identA), depois: null },
          { op: "create", referencia_id: refC.id, antes: null, depois: identidadeDa(identC) },
        ],
      });

      const retorno = await adminAutorizadoClient.rpc("reverter_sync_referencias", {
        p_sync_id: syncId,
      });
      expect(retorno.error).toBeFalsy();
      expect(retorno.data).toMatchObject({
        sync_id: syncId,
        status: "reverted",
        revertidas: 2,
        preservadas: 0,
      });

      // Estado: A reativada, C arquivada — e AMBAS permanecem (nunca DELETE)
      const aPos = await linhaDa(refA.id);
      const cPos = await linhaDa(refC.id);
      expect(aPos.is_ativa).toBe(true);
      expect(cPos.is_ativa).toBe(false);

      const { data: sync } = await admin
        .from("referencia_syncs")
        .select("status, message, alteracoes")
        .eq("id", syncId)
        .single();
      expect(sync?.status).toBe("reverted");
      expect(sync?.message).toContain("2");
      // Histórico da execução original preservado (contadores/alteracoes)
      expect(sync?.alteracoes).toHaveLength(2);

      // Eventos rollback por operação, actor = admin que reverteu
      const rollbacks = (await eventosPorSync(syncId)).filter((e) => e.tipo === "rollback");
      expect(rollbacks).toHaveLength(2);
      const evA = rollbacks.find((e) => e.referencia_id === refA.id);
      const evC = rollbacks.find((e) => e.referencia_id === refC.id);
      expect(evA?.detalhes).toMatchObject({
        operacao: "archive",
        inversa: "reativar",
        resultado: "aplicada",
      });
      expect(evC?.detalhes).toMatchObject({
        operacao: "create",
        inversa: "arquivar",
        resultado: "aplicada",
      });
      for (const ev of rollbacks) {
        expect(ev.actor_id).toBe(adminAutorizado.id);
      }

      // GUC app.audit_origin='curadoria': os flips NÃO viraram is_ativa_manual
      expect(await eventosManualDe(refA.id)).toHaveLength(0);
      expect(await eventosManualDe(refC.id)).toHaveLength(0);
    });

    it("no-op: sync sem alterações permanece como está (status e pendências intactos)", async () => {
      if (!m5Aplicada) return;

      const syncId = await criarSync("success");
      const pendenciaId = await criarPendencia(syncId, {
        tipo: "new_item",
        proposta: { nome: nomeUnico("noop"), marca: "", fenil_mg_por_100g: 2 },
      });

      const retorno = await adminAutorizadoClient.rpc("reverter_sync_referencias", {
        p_sync_id: syncId,
      });
      expect(retorno.error).toBeFalsy();
      expect(retorno.data).toMatchObject({ revertida: false });

      const { data: sync } = await admin
        .from("referencia_syncs")
        .select("status")
        .eq("id", syncId)
        .single();
      expect(sync?.status).toBe("success");

      // Pendência aberta permanece decidível (a divergência continua válida)
      const { data: pendencia } = await admin
        .from("referencia_sync_pendencias")
        .select("status")
        .eq("id", pendenciaId)
        .single();
      expect(pendencia?.status).toBe("open");
      expect(await eventosPorSync(syncId)).toHaveLength(0);
    });

    it("skip de create cuja referência já foi arquivada por fluxo posterior", async () => {
      if (!m5Aplicada) return;

      const refC = await createTestReference(adminAutorizado.id, {
        is_global: true,
        nome: nomeUnico("skip_create"),
      });
      const identC = await linhaDa(refC.id);

      const syncId = await criarSync("success", {
        alteracoes: [
          { op: "create", referencia_id: refC.id, antes: null, depois: identidadeDa(identC) },
        ],
      });

      // Fluxo posterior (outra sync/curadoria) arquivou C depois da sync
      await admin.from("referencias").update({ is_ativa: false }).eq("id", refC.id);

      const retorno = await adminAutorizadoClient.rpc("reverter_sync_referencias", {
        p_sync_id: syncId,
      });
      expect(retorno.error).toBeFalsy();
      expect(retorno.data).toMatchObject({ revertidas: 0, preservadas: 1 });

      const cPos = await linhaDa(refC.id);
      expect(cPos.is_ativa).toBe(false);

      const ev = (await eventosPorSync(syncId)).find((e) => e.referencia_id === refC.id);
      expect(ev?.detalhes).toMatchObject({
        operacao: "create",
        inversa: "arquivar",
        resultado: "skip",
      });
      expect(String(ev?.detalhes?.motivo)).toContain("já inativa");
    });

    it("skip de archive cuja referência foi reativada manualmente depois", async () => {
      if (!m5Aplicada) return;

      const refA = await createTestReference(adminAutorizado.id, {
        is_global: true,
        nome: nomeUnico("skip_reativada"),
      });
      const identA = await linhaDa(refA.id);
      // Efeito da sync: arquiva A
      await admin.from("referencias").update({ is_ativa: false }).eq("id", refA.id);

      const syncId = await criarSync("success", {
        alteracoes: [
          { op: "archive", referencia_id: refA.id, antes: identidadeDa(identA), depois: null },
        ],
      });

      // Fluxo posterior: admin reativa A manualmente (com sessão real → o
      // trigger is_ativa_manual legítimo dispara — fora do GUC da curadoria)
      const reativacao = await adminAutorizadoClient
        .from("referencias")
        .update({ is_ativa: true })
        .eq("id", refA.id);
      expect(reativacao.error).toBeFalsy();

      const retorno = await adminAutorizadoClient.rpc("reverter_sync_referencias", {
        p_sync_id: syncId,
      });
      expect(retorno.error).toBeFalsy();
      expect(retorno.data).toMatchObject({ revertidas: 0, preservadas: 1 });

      const aPos = await linhaDa(refA.id);
      expect(aPos.is_ativa).toBe(true); // alteração posterior preservada

      const ev = (await eventosPorSync(syncId)).find((e) => e.referencia_id === refA.id);
      expect(ev?.detalhes).toMatchObject({ resultado: "skip" });
      expect(String(ev?.detalhes?.motivo)).toContain("alteração posterior preservada");
      // A reativação manual (legítima) gerou exatamente 1 is_ativa_manual
      expect(await eventosManualDe(refA.id)).toHaveLength(1);
    });

    it("skip por colisão de identidade ativa (23505) — criação posterior vence", async () => {
      if (!m5Aplicada) return;

      // A arquivada pela sync com identidade K
      const nomeCompartilhado = nomeUnico("colisao");
      const refA = await createTestReference(adminAutorizado.id, {
        is_global: true,
        nome: nomeCompartilhado,
      });
      const identA = await linhaDa(refA.id);
      await admin.from("referencias").update({ is_ativa: false }).eq("id", refA.id);

      const syncId = await criarSync("success", {
        alteracoes: [
          { op: "archive", referencia_id: refA.id, antes: identidadeDa(identA), depois: null },
        ],
      });

      // Fluxo posterior: sync recriou a MESMA identidade K ATIVA (A inativa
      // liberou a chave do índice referencias_identidade_ativa_unique)
      const refNova = await createTestReference(adminAutorizado.id, {
        is_global: true,
        nome: nomeCompartilhado,
      });

      const retorno = await adminAutorizadoClient.rpc("reverter_sync_referencias", {
        p_sync_id: syncId,
      });
      expect(retorno.error).toBeFalsy();
      expect(retorno.data).toMatchObject({ revertidas: 0, preservadas: 1 });

      // A permanece inativa (reativar duplicaria a identidade); a nova vence
      const aPos = await linhaDa(refA.id);
      const novaPos = await linhaDa(refNova.id);
      expect(aPos.is_ativa).toBe(false);
      expect(novaPos.is_ativa).toBe(true);

      const ev = (await eventosPorSync(syncId)).find((e) => e.referencia_id === refA.id);
      expect(ev?.detalhes).toMatchObject({ resultado: "skip" });
      expect(String(ev?.detalhes?.motivo)).toContain("identidade já ativa");
    });

    it("cancela apenas pendências open da sync (decididas e de outras syncs ficam)", async () => {
      if (!m5Aplicada) return;

      const refC = await createTestReference(adminAutorizado.id, {
        is_global: true,
        nome: nomeUnico("revert_pendencias"),
      });
      const identC = await linhaDa(refC.id);

      const syncId = await criarSync("success", {
        alteracoes: [
          { op: "create", referencia_id: refC.id, antes: null, depois: identidadeDa(identC) },
        ],
      });
      const pendAberta = await criarPendencia(syncId, {
        tipo: "new_item",
        proposta: { nome: nomeUnico("pend_aberta"), marca: "", fenil_mg_por_100g: 2 },
      });
      // Decidida na MESMA sync — permanece no histórico
      const pendDecidida = await criarPendencia(syncId, {
        tipo: "new_item",
        status: "approved",
        proposta: { nome: nomeUnico("pend_decidida"), marca: "", fenil_mg_por_100g: 3 },
      });
      // Pendência open de OUTRA sync — fora do escopo
      const outraSync = await criarSync("success");
      const pendOutra = await criarPendencia(outraSync, {
        tipo: "new_item",
        proposta: { nome: nomeUnico("pend_outra"), marca: "", fenil_mg_por_100g: 4 },
      });

      const retorno = await adminAutorizadoClient.rpc("reverter_sync_referencias", {
        p_sync_id: syncId,
      });
      expect(retorno.error).toBeFalsy();
      expect(retorno.data).toMatchObject({ pendencias_canceladas: 1 });

      for (const [pendId, esperado] of [
        [pendAberta, "cancelled"],
        [pendDecidida, "approved"],
        [pendOutra, "open"],
      ] as const) {
        const { data: pendencia } = await admin
          .from("referencia_sync_pendencias")
          .select("status")
          .eq("id", pendId)
          .single();
        expect(pendencia?.status).toBe(esperado);
      }

      const eventoCancel = (await eventosPorPendencia(pendAberta)).find(
        (e) => e.tipo === "pendencia_cancelada"
      );
      expect(eventoCancel).toBeTruthy();
      expect(eventoCancel!.actor_id).toBe(adminAutorizado.id);
      expect(String(eventoCancel!.detalhes?.motivo)).toContain("rollback");
      expect(await eventosPorPendencia(pendDecidida)).toHaveLength(0);
      expect(await eventosPorPendencia(pendOutra)).toHaveLength(0);
    });

    it("recusa sync em status não revertível (failure)", async () => {
      if (!m5Aplicada) return;

      const refC = await createTestReference(adminAutorizado.id, {
        is_global: true,
        nome: nomeUnico("revert_failure"),
      });
      const identC = await linhaDa(refC.id);
      const syncId = await criarSync("failure", {
        alteracoes: [
          { op: "create", referencia_id: refC.id, antes: null, depois: identidadeDa(identC) },
        ],
      });

      const { error } = await adminAutorizadoClient.rpc("reverter_sync_referencias", {
        p_sync_id: syncId,
      });
      expect(error).toBeTruthy();
      expect(error!.message).toMatch(/não pode ser revertida .* apenas success\/pending_review/);
    });

    it("guarda B10c por environment: sync running no MESMO environment bloqueia", async () => {
      if (!m5Aplicada) return;

      const refC = await createTestReference(adminAutorizado.id, {
        is_global: true,
        nome: nomeUnico("revert_env"),
      });
      const identC = await linhaDa(refC.id);

      const envCompartilhado = `_test_m5_env_${runSuffix}_${++contador}`;
      const alvoId = await criarSync("success", {
        environment: envCompartilhado,
        alteracoes: [
          { op: "create", referencia_id: refC.id, antes: null, depois: identidadeDa(identC) },
        ],
      });
      await criarSync("running", { environment: envCompartilhado });

      const { error } = await adminAutorizadoClient.rpc("reverter_sync_referencias", {
        p_sync_id: alvoId,
      });
      expect(error).toBeTruthy();
      expect(error!.message).toMatch(/Existe sync em execução neste environment/);

      // Nada foi revertido
      const { data: sync } = await admin
        .from("referencia_syncs")
        .select("status")
        .eq("id", alvoId)
        .single();
      expect(sync?.status).toBe("success");
      expect((await linhaDa(refC.id)).is_ativa).toBe(true);
    });

    it("guarda B10c por environment: sync running em OUTRO environment não bloqueia", async () => {
      if (!m5Aplicada) return;

      const refC = await createTestReference(adminAutorizado.id, {
        is_global: true,
        nome: nomeUnico("revert_outro_env"),
      });
      const identC = await linhaDa(refC.id);

      const alvoId = await criarSync("success", {
        alteracoes: [
          { op: "create", referencia_id: refC.id, antes: null, depois: identidadeDa(identC) },
        ],
      });
      await criarSync("running"); // environment próprio, distinto do alvo

      const retorno = await adminAutorizadoClient.rpc("reverter_sync_referencias", {
        p_sync_id: alvoId,
      });
      expect(retorno.error).toBeFalsy();
      expect(retorno.data).toMatchObject({ status: "reverted", revertidas: 1 });
      expect((await linhaDa(refC.id)).is_ativa).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // restaurar_referencias_de_backup (§10.2)
  // ---------------------------------------------------------------------------

  describe("restaurar_referencias_de_backup", () => {
    it("nega a admin sem pode_recuperacao (permissão específica §12.4)", async () => {
      if (!m5Aplicada) return;

      const { error } = await adminSemFlagClient.rpc("restaurar_referencias_de_backup", {
        p_backup_id: UUID_ZERO,
      });
      expect(error).toBeTruthy();
      expect(error!.message).toMatch(/apenas administradores com permissão de recuperação/);
    });

    it("backup inexistente → exceção", async () => {
      if (!m5Aplicada) return;

      const { error } = await adminAutorizadoClient.rpc("restaurar_referencias_de_backup", {
        p_backup_id: UUID_ZERO,
      });
      expect(error).toBeTruthy();
      expect(error!.message).toMatch(/Backup não encontrado/);
    });

    it("integridade: payload_sha256 divergente → exceção antes de qualquer efeito", async () => {
      if (!m5Aplicada) return;

      const syncId = await criarSync("success");
      const payloadTexto = JSON.stringify([
        { id: randomUUID(), nome: "qualquer", marca: "", fenil_mg_por_100g: 10, is_global: true, is_ativa: true },
      ]);
      const backupId = await criarBackup(syncId, payloadTexto, "f".repeat(64));

      const { error } = await adminAutorizadoClient.rpc("restaurar_referencias_de_backup", {
        p_backup_id: backupId,
      });
      expect(error).toBeTruthy();
      expect(error!.message).toMatch(/Integridade do backup não verificada/);
      expect(await eventosRestoreDoBackup(backupId)).toHaveLength(0);
    });

    it("restaura o conjunto global ao backup (reativa/cria/arquiva; pessoais preservadas; cancela TODAS as open; sem sync nova) — transação real com rollback", async () => {
      if (!m5Aplicada || !sistemaId || !dbUrl) return;

      // Estado "hoje" (fixtures persistidas — fora da transação)
      const g1 = await createTestReference(adminAutorizado.id, {
        is_global: true,
        nome: nomeUnico("rest_g1"),
      }); // ativa no backup E hoje → intocada
      const g2 = await createTestReference(adminAutorizado.id, {
        is_global: true,
        nome: nomeUnico("rest_g2"),
      }); // inativa hoje, ativa no backup → reativada
      await admin.from("referencias").update({ is_ativa: false }).eq("id", g2.id);
      const gx = await createTestReference(adminAutorizado.id, {
        is_global: true,
        nome: nomeUnico("rest_gx"),
      }); // ativa hoje, AUSENTE do backup → varredura global a arquiva
      const pessoal = await createTestReference(adminAutorizado.id, {
        is_global: false,
        nome: nomeUnico("rest_pessoal"),
      }); // pessoal ativa → NUNCA tocada (D-4)
      const idG3 = randomUUID(); // ausente hoje, ativa no backup → criada
      const nomeG3 = nomeUnico("rest_g3");

      const payloadTexto = JSON.stringify([
        { id: g1.id, nome: g1.nome, marca: "", fenil_mg_por_100g: 10, is_global: true, is_ativa: true },
        { id: g2.id, nome: g2.nome, marca: "", fenil_mg_por_100g: 10, is_global: true, is_ativa: true },
        { id: idG3, nome: nomeG3, marca: "", fenil_mg_por_100g: 10, is_global: true, is_ativa: true },
      ]);
      const sha256 = createHash("sha256").update(payloadTexto).digest("hex");

      const syncBackup = await criarSync("success");
      const backupId = await criarBackup(syncBackup, payloadTexto, sha256);

      // Pendências open de syncs distintas (TODAS as open são canceladas —
      // decisão 2026-09-06; inclui as deixadas por testes anteriores deste
      // arquivo, que seguem abertas)
      const syncP1 = await criarSync("pending_review");
      const p1 = await criarPendencia(syncP1, {
        tipo: "new_item",
        proposta: { nome: nomeUnico("rest_pend1"), marca: "", fenil_mg_por_100g: 2 },
      });
      const syncP2 = await criarSync("pending_review");
      const p2 = await criarPendencia(syncP2, {
        tipo: "absence",
        referencia_id: g1.id,
        diff: { de: g1.nome, para: null },
      });

      const globaisAtivasAntes = await contarGlobaisAtivas();

      // Transação PG direta: forja a sessão do admin com pode_recuperacao e
      // executa a RPC REAL — a varredura global acontece DENTRO da transação
      // e é revertida no rollback (as ~3.1k globais reais do dev só são
      // tocadas transitoriamente; zero persistência).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pgModule: any = await import("pg");
      const client = new pgModule.Client({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false },
      });
      await client.connect();
      try {
        await client.query("begin");
        await client.query(
          "select set_config('request.jwt.claims', $1::text, true)",
          [JSON.stringify({ sub: adminAutorizado.id, role: "authenticated" })]
        );

        const { rows: abertas } = await client.query(
          "select count(*)::int as n from public.referencia_sync_pendencias where status = 'open'"
        );
        const { rows: syncsAntes } = await client.query(
          "select count(*)::int as n from public.referencia_syncs"
        );

        const { rows: rpcRows } = await client.query(
          "select public.restaurar_referencias_de_backup($1) as r",
          [backupId]
        );
        const r = rpcRows[0].r as {
          reativadas: number;
          criadas: number;
          arquivadas: number;
          pendencias_canceladas: number;
        };
        expect(r.reativadas).toBe(1); // g2
        expect(r.criadas).toBe(1); // g3
        expect(r.arquivadas).toBeGreaterThanOrEqual(1); // varredura global
        expect(r.pendencias_canceladas).toBe(abertas[0].n); // TODAS as open

        // Estado pós-restauração (dentro da transação)
        const { rows: refs } = await client.query(
          `select id, nome, is_ativa, criado_por
           from public.referencias
           where id = any($1::uuid[])`,
          [[g1.id, g2.id, gx.id, pessoal.id, idG3]]
        );
        type LinhaRef = { id: string; nome: string; is_ativa: boolean; criado_por: string | null };
        const refsTipadas = refs as LinhaRef[];
        const porId = new Map(refsTipadas.map((l) => [l.id, l] as const));
        expect(porId.get(g1.id)?.is_ativa).toBe(true);
        expect(porId.get(g2.id)?.is_ativa).toBe(true); // reativada
        expect(porId.get(gx.id)?.is_ativa).toBe(false); // arquivada pela varredura
        expect(porId.get(pessoal.id)?.is_ativa).toBe(true); // pessoal preservada
        expect(porId.get(idG3)?.is_ativa).toBe(true);
        expect(porId.get(idG3)?.nome).toBe(nomeG3);
        expect(porId.get(idG3)?.criado_por).toBe(sistemaId); // ator Sistema (B5)

        for (const pendId of [p1, p2]) {
          const { rows: pen } = await client.query(
            "select status from public.referencia_sync_pendencias where id = $1",
            [pendId]
          );
          expect(pen[0]?.status).toBe("cancelled");
          const { rows: ev } = await client.query(
            "select 1 from public.referencia_eventos where pendencia_id = $1 and tipo = 'pendencia_cancelada'",
            [pendId]
          );
          expect(ev).toHaveLength(1);
        }

        // Evento restore único (sync_id null — D-5), actor = admin forjado;
        // detalhes carregam contagens + ids das linhas tocadas
        const { rows: restores } = await client.query(
          `select sync_id, actor_id, detalhes
           from public.referencia_eventos
           where tipo = 'restore' and detalhes->>'backup_id' = $1`,
          [backupId]
        );
        expect(restores).toHaveLength(1);
        expect(restores[0].sync_id).toBeNull();
        expect(restores[0].actor_id).toBe(adminAutorizado.id);
        const detalhesRestore = restores[0].detalhes as {
          backup_id: string;
          reativadas: number;
          criadas: number;
          arquivadas: number;
          reativadas_ids: string[];
          criadas_ids: string[];
          arquivadas_ids: string[];
        };
        expect(detalhesRestore).toMatchObject({
          backup_id: backupId,
          reativadas: 1,
          criadas: 1,
        });
        expect(detalhesRestore.arquivadas).toBeGreaterThanOrEqual(1);
        expect(detalhesRestore.reativadas_ids).toContain(g2.id);
        expect(detalhesRestore.criadas_ids).toContain(idG3);
        expect(detalhesRestore.arquivadas_ids).toContain(gx.id);

        // D-5: nenhuma linha de sync nova
        const { rows: syncsDepois } = await client.query(
          "select count(*)::int as n from public.referencia_syncs"
        );
        expect(syncsDepois[0].n).toBe(syncsAntes[0].n);

        await client.query("rollback");
      } finally {
        // Desconexão aborta qualquer transação residual (assert falho não
        // persiste nada)
        await client.end();
      }

      // Pós-rollback via HTTP: NADA persistiu — o catálogo real do dev está
      // intacto (prova de zero colateral da abordagem transacional)
      expect(await contarGlobaisAtivas()).toBe(globaisAtivasAntes);
      expect((await linhaDa(g1.id)).is_ativa).toBe(true);
      expect((await linhaDa(g2.id)).is_ativa).toBe(false); // reativação desfeita
      expect((await linhaDa(gx.id)).is_ativa).toBe(true); // arquivamento desfeito
      expect((await linhaDa(pessoal.id)).is_ativa).toBe(true);
      const { data: g3Depois } = await admin
        .from("referencias")
        .select("id")
        .eq("id", idG3)
        .maybeSingle();
      expect(g3Depois).toBeNull(); // criação desfeita
      for (const pendId of [p1, p2]) {
        const { data: pendencia } = await admin
          .from("referencia_sync_pendencias")
          .select("status")
          .eq("id", pendId)
          .single();
        expect(pendencia?.status).toBe("open"); // cancelamento desfeito
      }
      expect(await eventosRestoreDoBackup(backupId)).toHaveLength(0); // evento desfeito

      // Timeout próprio: a RPC reescreve o catálogo global inteiro (~3.1k
      // arquivamentos em loop dentro da transação) — ~5–15s no dev compartilhado.
    }, 120_000);

    it("conflito: referência com id do backup mas identidade divergente → aborta tudo", async () => {
      if (!m5Aplicada) return;

      // Legítima (seria reativada se o conflito não abortasse) — vem PRIMEIRO
      // no payload para provar que o ROLLBACK desfez o efeito anterior
      const g1 = await createTestReference(adminAutorizado.id, {
        is_global: true,
        nome: nomeUnico("conflito_g1"),
      });
      await admin.from("referencias").update({ is_ativa: false }).eq("id", g1.id);

      // Conflitante: existe inativa com o MESMO id, mas identidade editada
      const refM = await createTestReference(adminAutorizado.id, {
        is_global: true,
        nome: nomeUnico("conflito_m_antes"),
      });
      await admin.from("referencias").update({ is_ativa: false }).eq("id", refM.id);
      await admin
        .from("referencias")
        .update({ nome: nomeUnico("conflito_m_depois") })
        .eq("id", refM.id);

      const linhas = [
        { id: g1.id, nome: g1.nome, marca: "", fenil_mg_por_100g: 10, is_global: true, is_ativa: true },
        { id: refM.id, nome: nomeUnico("conflito_m_backup"), marca: "", fenil_mg_por_100g: 10, is_global: true, is_ativa: true },
      ];
      const payloadTexto = JSON.stringify(linhas);
      const sha256 = createHash("sha256").update(payloadTexto).digest("hex");

      const syncBackup = await criarSync("success");
      const backupId = await criarBackup(syncBackup, payloadTexto, sha256);

      // Pendência open que só seria cancelada ao final — deve permanecer
      const syncP = await criarSync("pending_review");
      const pendId = await criarPendencia(syncP, {
        tipo: "new_item",
        proposta: { nome: nomeUnico("conflito_pend"), marca: "", fenil_mg_por_100g: 2 },
      });

      const { error } = await adminAutorizadoClient.rpc("restaurar_referencias_de_backup", {
        p_backup_id: backupId,
      });
      expect(error).toBeTruthy();
      expect(error!.message).toMatch(/Conflito na restauração/);

      // Transação abortada: nada foi reativado, nada cancelado, sem evento
      expect((await linhaDa(g1.id)).is_ativa).toBe(false);
      expect((await linhaDa(refM.id)).is_ativa).toBe(false);
      const { data: pendencia } = await admin
        .from("referencia_sync_pendencias")
        .select("status")
        .eq("id", pendId)
        .single();
      expect(pendencia?.status).toBe("open");
      expect(await eventosRestoreDoBackup(backupId)).toHaveLength(0);
    });

    it("guarda B10c por environment: backup do sync ainda running bloqueia", async () => {
      if (!m5Aplicada) return;

      // Backup produzido DURANTE uma sync (estágio 5) — o próprio sync está
      // running; restaurar esse backup antes de a sync concluir é bloqueado.
      const syncRunning = await criarSync("running");
      const payloadTexto = JSON.stringify([]);
      const sha256 = createHash("sha256").update(payloadTexto).digest("hex");
      const backupId = await criarBackup(syncRunning, payloadTexto, sha256);

      const { error } = await adminAutorizadoClient.rpc("restaurar_referencias_de_backup", {
        p_backup_id: backupId,
      });
      expect(error).toBeTruthy();
      expect(error!.message).toMatch(/Existe sync em execução neste environment/);
    });
  });
});
