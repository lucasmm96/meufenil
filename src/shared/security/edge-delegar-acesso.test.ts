/**
 * Testes de integração real para a edge function delegar-acesso.
 *
 * GAP-005: cobertura das ações listar, conceder, assumir, sair e revogar via
 * supabase.functions.invoke() contra o projeto Supabase de desenvolvimento.
 *
 * PRÉ-REQUISITO: SUPABASE_SERVICE_ROLE_KEY definida no ambiente (via
 * .env.development). Sem a key, todos os testes são ignorados.
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createTestUser,
  signInAsTestUser,
  trackForCleanup,
  cleanupAllTestUsers,
  type TestUser,
} from "./test-helpers";

const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const describeOrSkip = hasServiceRole ? describe : describe.skip;

// ---------------------------------------------------------------------------
// Helper: lê o corpo JSON de um erro de edge function (FunctionsHttpError).
// FunctionsHttpError.context é o Response HTTP cru — body ainda não consumido.
// ---------------------------------------------------------------------------
async function getErrorBody(
  error: unknown
): Promise<Record<string, unknown>> {
  const ctx = (error as { context?: Response }).context;
  if (ctx) {
    try {
      return (await ctx.json()) as Record<string, unknown>;
    } catch {
      /* fall through */
    }
  }
  return { error: (error as { message?: string }).message };
}

describeOrSkip("Edge Function: delegar-acesso (integração real)", () => {
  let concedente: TestUser;
  let delegado: TestUser;
  let clienteConcedente: SupabaseClient;
  let clienteDelegado: SupabaseClient;
  let delegacaoId: string;
  let functionAvailable = true;

  beforeAll(async () => {
    concedente = await createTestUser("user");
    trackForCleanup(concedente.id);
    delegado = await createTestUser("user");
    trackForCleanup(delegado.id);
    clienteConcedente = await signInAsTestUser(concedente);
    clienteDelegado = await signInAsTestUser(delegado);

    // Probe: verificar se a edge function está disponível no ambiente de dev.
    // FunctionsRelayError indica que a função não está deployada.
    const { error: probeError } = await clienteConcedente.functions.invoke(
      "delegar-acesso",
      { body: { acao: "listar" } }
    );
    if (
      probeError &&
      (probeError.message?.toLowerCase().includes("relay") ||
        probeError.name?.toLowerCase().includes("relay"))
    ) {
      console.warn(
        "[delegar-acesso] Edge function não disponível no ambiente — " +
          "testes serão ignorados (guard: probeError.name = " +
          probeError.name +
          ", message = " +
          probeError.message +
          ")"
      );
      functionAvailable = false;
    }
  }, 60000);

  afterAll(async () => {
    await cleanupAllTestUsers();
  }, 30000);

  // -----------------------------------------------------------------------
  // EF1.0 — listar sem delegações retorna listas vazias
  // -----------------------------------------------------------------------
  it("EF1.0: listar sem delegações retorna listas vazias (concedidos e recebidos)", async () => {
    if (!functionAvailable) return;

    const [
      { data: listaConcedente, error: errConcedente },
      { data: listaDelegado, error: errDelegado },
    ] = await Promise.all([
      clienteConcedente.functions.invoke("delegar-acesso", {
        body: { acao: "listar" },
      }),
      clienteDelegado.functions.invoke("delegar-acesso", {
        body: { acao: "listar" },
      }),
    ]);

    expect(errConcedente).toBeNull();
    expect(Array.isArray(listaConcedente?.concedidos)).toBe(true);
    expect(listaConcedente?.concedidos).toHaveLength(0);

    expect(errDelegado).toBeNull();
    expect(Array.isArray(listaDelegado?.recebidos)).toBe(true);
    expect(listaDelegado?.recebidos).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // EF1.1 — conceder acesso por email retorna sucesso; armazenar delegacaoId
  // -----------------------------------------------------------------------
  it("EF1.1: conceder acesso por email do delegado retorna { success: true }", async () => {
    if (!functionAvailable) return;

    const { data, error } = await clienteConcedente.functions.invoke(
      "delegar-acesso",
      { body: { acao: "conceder", email: delegado.email } }
    );

    expect(error).toBeNull();
    expect(data).toMatchObject({ success: true });

    // A concessão retorna apenas { success: true }.
    // Obtemos o delegacaoId via listagem.
    const { data: lista, error: errLista } =
      await clienteConcedente.functions.invoke("delegar-acesso", {
        body: { acao: "listar" },
      });
    expect(errLista).toBeNull();
    const concedidos = lista?.concedidos as Array<{ id: string }>;
    expect(concedidos.length).toBeGreaterThanOrEqual(1);
    delegacaoId = concedidos[concedidos.length - 1].id;
    expect(typeof delegacaoId).toBe("string");
  });

  // -----------------------------------------------------------------------
  // EF1.2 — listar após concessão
  // -----------------------------------------------------------------------
  it("EF1.2: após concessão, concedente vê delegação concedida e delegado vê delegação recebida", async () => {
    if (!functionAvailable) return;
    expect(delegacaoId).toBeTruthy(); // depende de EF1.1

    const [
      { data: listaConcedente, error: errC },
      { data: listaDelegado, error: errD },
    ] = await Promise.all([
      clienteConcedente.functions.invoke("delegar-acesso", {
        body: { acao: "listar" },
      }),
      clienteDelegado.functions.invoke("delegar-acesso", {
        body: { acao: "listar" },
      }),
    ]);

    expect(errC).toBeNull();
    const concedidos = listaConcedente?.concedidos as Array<{ id: string }>;
    expect(concedidos.some((d) => d.id === delegacaoId)).toBe(true);

    expect(errD).toBeNull();
    const recebidos = listaDelegado?.recebidos as Array<{ id: string }>;
    expect(recebidos.some((d) => d.id === delegacaoId)).toBe(true);
  });

  // -----------------------------------------------------------------------
  // EF1.3 — conceder para si mesmo → 400
  // -----------------------------------------------------------------------
  it('EF1.3: conceder para si mesmo retorna 400 "Acesso a si mesmo não é permitido"', async () => {
    if (!functionAvailable) return;

    const { data, error } = await clienteConcedente.functions.invoke(
      "delegar-acesso",
      { body: { acao: "conceder", email: concedente.email } }
    );

    expect(data).toBeNull();
    expect(error).toBeTruthy();
    const body = await getErrorBody(error);
    expect(body.error).toBe("Acesso a si mesmo não é permitido");
  });

  // -----------------------------------------------------------------------
  // EF1.4 — conceder para email inexistente → 404
  // -----------------------------------------------------------------------
  it('EF1.4: conceder para email inexistente retorna 404 "Usuário não encontrado"', async () => {
    if (!functionAvailable) return;

    const { data, error } = await clienteConcedente.functions.invoke(
      "delegar-acesso",
      {
        body: {
          acao: "conceder",
          email: "nao-existe@meufenil-test.local",
        },
      }
    );

    expect(data).toBeNull();
    expect(error).toBeTruthy();
    const body = await getErrorBody(error);
    expect(body.error).toBe("Usuário não encontrado");
  });

  // -----------------------------------------------------------------------
  // EF1.5 — assumir perfil do concedente
  // -----------------------------------------------------------------------
  it("EF1.5: assumir perfil do concedente retorna usuario_assumido_id correto", async () => {
    if (!functionAvailable) return;
    expect(delegacaoId).toBeTruthy();

    const { data, error } = await clienteDelegado.functions.invoke(
      "delegar-acesso",
      { body: { acao: "assumir", delegacao_id: delegacaoId } }
    );

    expect(error).toBeNull();
    expect(data?.usuario_assumido_id).toBe(concedente.id);
  });

  // -----------------------------------------------------------------------
  // EF1.6 — assumir sem delegação ativa → 403
  // -----------------------------------------------------------------------
  it('EF1.6: assumir com delegacao_id inválido retorna 403 "Acesso não autorizado"', async () => {
    if (!functionAvailable) return;

    // UUID inexistente: nenhuma delegação ativa vinculada ao delegado
    const { data, error } = await clienteDelegado.functions.invoke(
      "delegar-acesso",
      {
        body: {
          acao: "assumir",
          delegacao_id: "00000000-0000-0000-0000-000000000000",
        },
      }
    );

    expect(data).toBeNull();
    expect(error).toBeTruthy();
    const body = await getErrorBody(error);
    expect(body.error).toBe("Acesso não autorizado");
  });

  // -----------------------------------------------------------------------
  // EF1.7 — sair do perfil assumido
  // -----------------------------------------------------------------------
  it("EF1.7: sair do perfil assumido retorna { success: true }", async () => {
    if (!functionAvailable) return;

    const { data, error } = await clienteDelegado.functions.invoke(
      "delegar-acesso",
      { body: { acao: "sair" } }
    );

    expect(error).toBeNull();
    expect(data).toMatchObject({ success: true });
  });

  // -----------------------------------------------------------------------
  // EF1.8 — revogar delegação
  // -----------------------------------------------------------------------
  it("EF1.8: revogar delegação retorna sucesso e remove da listagem", async () => {
    if (!functionAvailable) return;
    expect(delegacaoId).toBeTruthy();

    const { data, error } = await clienteConcedente.functions.invoke(
      "delegar-acesso",
      { body: { acao: "revogar", delegacao_id: delegacaoId } }
    );

    expect(error).toBeNull();
    expect(data).toMatchObject({ success: true });

    // Verificar que a delegação não aparece mais na listagem ativa
    const { data: lista } = await clienteConcedente.functions.invoke(
      "delegar-acesso",
      { body: { acao: "listar" } }
    );
    const concedidos = lista?.concedidos as Array<{ id: string }>;
    expect(concedidos.some((d) => d.id === delegacaoId)).toBe(false);
  });

  // -----------------------------------------------------------------------
  // EF1.9 — sem Authorization header (não testável via supabase-js)
  // -----------------------------------------------------------------------
  it.skip(
    "EF1.9: chamar sem Authorization header — não testável diretamente via supabase-js " +
      "(o cliente sempre injeta Authorization: Bearer; teste HTTP manual fora do escopo desta suíte)",
    () => {
      // supabase-js always sends Authorization: Bearer <token> for authenticated
      // clients. Testing the raw "no-header" path would require bypassing the SDK
      // with a manual fetch(), which is out of scope for this integration suite.
      // For delete-account (EF2.1), the raw-fetch approach is tested since that
      // function has a simpler auth flow.
    }
  );
});
