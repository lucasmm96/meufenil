/**
 * Testes REALs (Abordagem B — Supabase JS client com JWTs reais) da RPC
 * restaurar_referencias_de_backup (FEAT-0017 M5, atualizada pelo ENH-0009),
 * exercitada contra o banco de desenvolvimento:
 *
 * - restaurar_referencias_de_backup (§10.2) — recuperação excepcional do
 *   catálogo global a partir do backup (payload completo + payload_sha256
 *   verificado ANTES de qualquer efeito — design §9): reativa a arquivada de
 *   mesmo id (guarda de identidade), cria do backup (id original, actor
 *   Sistema — B5) ou arquiva ativas de hoje sem correspondência; nunca toca
 *   pessoais (D-4), nunca DELETE; pendencias_canceladas sempre 0 (ENH-0009
 *   removeu a tabela de pendências); evento `restore` único com contagens/ids;
 *   não cria linha de sync (D-5).
 *
 * A RPC de restore REESCREVE O CATÁLOGO GLOBAL por design (sem filtro de
 * environment — produção só tem 'prod'). Executá-la fora de transação contra
 * o dev DB compartilhado arquivaria as ~3.1k globais reais do dev. Decisões:
 * (1) o happy path roda DENTRO DE TRANSAÇÃO PG DIRETA (SUPABASE_DATABASE_URL)
 * com claims de sessão forjadas para o admin com a flag — execução real da
 * RPC com ROLLBACK ao final + asserts pós-rollback provando zero persistência;
 * (2) os caminhos que abortam ANTES de efeito (permissão, backup inexistente,
 * integridade, guarda running) e o conflito seguem via HTTP com JWT real; (3)
 * vitest roda arquivos em paralelo por padrão — fileParallelism: false
 * adotado no vitest.config.ts (suítes REAL serializadas).
 *
 * PRÉ-REQUISITOS (dev): migrations ENH-0009 aplicadas E ator Sistema
 * provisionado (scripts/provisionar-ator-sistema.js — necessário apenas no
 * ramo de criação do restore). Guards: isFeat0017M5Applied +
 * isSistemaProvisionado. Happy path exige SUPABASE_DATABASE_URL.
 * Sem service role, o describe inteiro é pulado.
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

describeOrSkip("RPC ENH-0009: restaurar_referencias_de_backup (Abordagem B)", () => {
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

  // Rastreamento da limpeza: eventos → backups → syncs → usuários de teste.
  const createdSyncIds: string[] = [];
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
        "referencia_backups",
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

    it("restaura o conjunto global ao backup (reativa/cria/arquiva; pessoais preservadas; sem sync nova) — transação real com rollback", async () => {
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
        expect(r.pendencias_canceladas).toBe(0); // ENH-0009: tabela removida

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

      const { error } = await adminAutorizadoClient.rpc("restaurar_referencias_de_backup", {
        p_backup_id: backupId,
      });
      expect(error).toBeTruthy();
      expect(error!.message).toMatch(/Conflito na restauração/);

      // Transação abortada: nada foi reativado, sem evento
      expect((await linhaDa(g1.id)).is_ativa).toBe(false);
      expect((await linhaDa(refM.id)).is_ativa).toBe(false);
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
