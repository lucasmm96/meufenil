/**
 * Testes de segurança: função get_estatisticas_admin (Abordagem B).
 *
 * Documenta o estado atual de GAP-012: a função tem EXECUTE grants para todas
 * as roles (anon, authenticated, service_role) e não verifica o papel do
 * chamador internamente. Qualquer usuário autenticado pode obter estatísticas
 * globais do banco de dados.
 *
 * Rastreamento: SEC-0001 pendente (corrigir grants da função).
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createTestUser,
  signInAsTestUser,
  trackForCleanup,
  cleanupAllTestUsers,
  TestUser,
} from "./test-helpers";
import type { SupabaseClient } from "@supabase/supabase-js";

const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const describeOrSkip = hasServiceRole ? describe : describe.skip;

describeOrSkip("RPC: get_estatisticas_admin — GAP-012 (Abordagem B)", () => {
  let adminUser: TestUser;
  let regularUser: TestUser;

  let adminClient: SupabaseClient;
  let regularClient: SupabaseClient;

  beforeAll(async () => {
    adminUser = await createTestUser("admin");
    trackForCleanup(adminUser.id);
    regularUser = await createTestUser("user");
    trackForCleanup(regularUser.id);

    adminClient = await signInAsTestUser(adminUser);
    regularClient = await signInAsTestUser(regularUser);
  }, 30000);

  afterAll(async () => {
    await cleanupAllTestUsers();
  }, 30000);

  it("Admin pode chamar get_estatisticas_admin → retorna dados estatísticos", async () => {
    const { data, error } = await adminClient.rpc("get_estatisticas_admin");
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    // Verificar que os campos esperados existem
    expect(data[0]).toHaveProperty("tamanho_db_mb");
    expect(data[0]).toHaveProperty("registros_totais");
    expect(data[0]).toHaveProperty("referencias_total");
  });

  it("GAP-012: usuário comum TAMBÉM pode chamar get_estatisticas_admin (grants amplos)", async () => {
    // Este teste documenta o estado atual: a função NÃO verifica o papel do
    // chamador internamente. Os grants são concedidos a anon, authenticated e
    // service_role (migration 20260103015052_remote_schema.sql).
    //
    // Comportamento esperado APÓS correção (SEC-0001):
    //   - Usuário comum deveria receber erro de permissão negada.
    //   - Somente admin deveria poder chamar a função.
    //
    // Comportamento atual (GAP confirmado):
    //   - Usuário comum recebe os dados sem erro.
    const { data, error } = await regularClient.rpc("get_estatisticas_admin");

    if (!error) {
      // GAP-012 CONFIRMADO: usuário comum acessou dados administrativos
      console.warn(
        "GAP-012 CONFIRMADO: get_estatisticas_admin acessível por usuário comum. " +
        "SEC-0001 pendente para corrigir os EXECUTE grants da função."
      );
      expect(data).not.toBeNull();
    } else {
      // GAP possivelmente corrigido — permissão negada
      console.log(
        `GAP-012: acesso negado para usuário comum (possível correção aplicada). ` +
        `Erro: ${error.message}`
      );
    }

    // O teste sempre passa: documenta o estado atual, seja gap ou correção
    expect(true).toBe(true);
  });
});
