/**
 * Testes de RLS das 5 tabelas novas da FEAT-0017 (M1 — migrations
 * 20260905xxxxxx): referencia_syncs, referencia_sync_pendencias,
 * referencia_eventos, referencia_snapshots, referencia_backups.
 *
 * Padrão Abordagem B (design §5.6/§17): leitura admin-only via
 * `is_admin_user(auth.uid())`; NENHUMA policy de escrita — escrita exclusiva
 * de service_role (rota/scripts) e RPCs SECURITY DEFINER (M4+).
 *
 * PRÉ-REQUISITO: FEAT-0017 M1 aplicado (`isFeat0017M1Applied`).
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
  isFeat0017M1Applied,
  TestUser,
} from "./test-helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const describeOrSkip = hasServiceRole ? describe : describe.skip;

describeOrSkip("RLS: tabelas de sincronização de referências (Abordagem B)", () => {
  // O vitest coleta o callback mesmo em describe.skip — sem credenciais, não
  // instanciar o client na coleta (getAdminClient lança sem as vars de ambiente).
  const admin = hasServiceRole ? getAdminClient() : (null as unknown as SupabaseClient);

  // Tabelas novas (M1). Env dos syncs de teste usa sufixo único por execução
  // para não colidir com o single-flight (environment + running) em reruns.
  const runSuffix = `${Date.now()}.${Math.floor(Math.random() * 1e6)}`;
  const testTables = [
    "referencia_syncs",
    "referencia_sync_pendencias",
    "referencia_eventos",
    "referencia_snapshots",
    "referencia_backups",
  ] as const;

  let regularUser: TestUser;
  let adminUser: TestUser;
  let regularClient: SupabaseClient;
  let adminAuthClient: SupabaseClient;
  let m1Applied = false;

  // Linhas criadas por tabela (admin service_role) para os testes de leitura;
  // sync_id das linhas-filhas referenciam o sync da própria linha de teste.
  const createdRows: Record<string, string[]> = {
    referencia_syncs: [],
    referencia_sync_pendencias: [],
    referencia_eventos: [],
    referencia_snapshots: [],
    referencia_backups: [],
  };

  // Contador de chamadas: o sync de teste fica `running` até o afterAll (limpeza),
  // então o environment precisa ser único POR INSERT — o single-flight
  // (environment + running) rejeitaria o 2º insert no mesmo environment.
  let insertCounter = 0;

  /** Cria 1 linha de teste na tabela (sync próprio por tabela; filhas usam o sync). */
  async function insertTestRow(table: string): Promise<string> {
    insertCounter += 1;
    const env = `_test_rls_sync_${runSuffix}_${table}_${insertCounter}`;
    if (table === "referencia_syncs") {
      const { data, error } = await admin
        .from(table)
        .insert({ environment: env, trigger_source: "manual" })
        .select("id")
        .single();
      if (error) throw new Error(`Falha ao criar sync de teste: ${error.message}`);
      createdRows[table].push(data.id);
      return data.id;
    }

    const { data: syncData, error: syncError } = await admin
      .from("referencia_syncs")
      .insert({ environment: env, trigger_source: "manual" })
      .select("id")
      .single();
    if (syncError) throw new Error(`Falha ao criar sync de teste: ${syncError.message}`);
    createdRows.referencia_syncs.push(syncData.id);

    let linha: Record<string, unknown>;
    switch (table) {
      case "referencia_sync_pendencias":
        linha = { sync_id: syncData.id, tipo: "new_item" };
        break;
      case "referencia_eventos":
        linha = { sync_id: syncData.id, tipo: "sync_started" };
        break;
      case "referencia_snapshots":
        linha = {
          sync_id: syncData.id,
          payload: { linhas: [] },
          payload_sha256: "abc",
          contagem: 0,
        };
        break;
      case "referencia_backups":
        linha = {
          sync_id: syncData.id,
          payload: { linhas: [] },
          payload_sha256: "abc",
          contagem: 0,
        };
        break;
      default:
        throw new Error(`Tabela não mapeada: ${table}`);
    }

    const { data, error } = await admin
      .from(table)
      .insert(linha)
      .select("id")
      .single();
    if (error) throw new Error(`Falha ao criar linha de teste em ${table}: ${error.message}`);
    createdRows[table].push(data.id);
    return data.id;
  }

  beforeAll(async () => {
    m1Applied = await isFeat0017M1Applied();

    regularUser = await createTestUser("user");
    trackForCleanup(regularUser.id);
    adminUser = await createTestUser("admin");
    trackForCleanup(adminUser.id);

    regularClient = await signInAsTestUser(regularUser);
    adminAuthClient = await signInAsTestUser(adminUser);
  }, 60000);

  afterAll(async () => {
    // Limpeza na ordem das FKs (RESTRICT): filhas antes dos syncs
    for (const table of [
      "referencia_backups",
      "referencia_snapshots",
      "referencia_eventos",
      "referencia_sync_pendencias",
    ]) {
      const ids = createdRows[table];
      for (const id of ids) {
        try {
          await admin.from(table).delete().eq("id", id);
        } catch { /* ignora */ }
      }
    }
    for (const id of createdRows.referencia_syncs) {
      try {
        await admin.from("referencia_syncs").delete().eq("id", id);
      } catch { /* ignora */ }
    }
    await cleanupAllTestUsers();
  }, 30000);

  it("M1.1: usuário comum NÃO lê linhas das tabelas novas (RLS)", async () => {
    if (!m1Applied) return;
    for (const table of testTables) {
      const id = await insertTestRow(table);
      const { data, error } = await regularClient
        .from(table)
        .select("id")
        .eq("id", id);
      expect(error, `select em ${table}`).toBeNull();
      expect(data!.length, `usuário comum viu linha em ${table}`).toBe(0);
    }
  });

  it("M1.2: admin autenticado LÊ linhas das tabelas novas (policy admin)", async () => {
    if (!m1Applied) return;
    for (const table of testTables) {
      const id = await insertTestRow(table);
      const { data, error } = await adminAuthClient
        .from(table)
        .select("id")
        .eq("id", id);
      expect(error, `select em ${table}`).toBeNull();
      expect(data!.length, `admin não viu linha em ${table}`).toBe(1);
      expect(data![0].id).toBe(id);
    }
  });

  it("M1.3: usuário comum NÃO insere (nenhuma policy de escrita)", async () => {
    if (!m1Applied) return;
    const { error } = await regularClient
      .from("referencia_syncs")
      .insert({
        environment: `_test_rls_denied_${runSuffix}`,
        trigger_source: "manual",
      });
    expect(error).toBeTruthy();
    expect(error!.message).toMatch(/permission denied|permissão negada|viola/i);
  });

  it("M1.4: admin autenticado TAMBÉM não insere (escrita = service_role/RPCs)", async () => {
    if (!m1Applied) return;
    const { error } = await adminAuthClient
      .from("referencia_syncs")
      .insert({
        environment: `_test_rls_denied_admin_${runSuffix}`,
        trigger_source: "manual",
      });
    expect(error).toBeTruthy();
    expect(error!.message).toMatch(/permission denied|permissão negada|viola/i);
  });

  it("M1.5: usuário comum não altera nem remove linha alheia", async () => {
    if (!m1Applied) return;
    const id = await insertTestRow("referencia_syncs");

    // UPDATE e DELETE sem policy de escrita: RLS nega a operação (sem erro
    // visível — linha invisível). A propriedade de segurança é o estado final:
    // linha permanece intacta para o admin.
    const { error: updError } = await regularClient
      .from("referencia_syncs")
      .update({ message: "hack" })
      .eq("id", id);
    expect(updError).toBeNull();

    const { error: delError } = await regularClient
      .from("referencia_syncs")
      .delete()
      .eq("id", id);
    expect(delError).toBeNull();

    const { data: check } = await admin
      .from("referencia_syncs")
      .select("id")
      .eq("id", id)
      .single();
    expect(check).toBeTruthy();
    expect(check!.id).toBe(id);
  });
});
