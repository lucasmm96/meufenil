import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppError } from "@/react-app/lib/errors";

// mock do supabase ANTES do import do service
vi.mock("@/react-app/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import { supabase } from "@/react-app/lib/supabase";
import {
  listarDelegacoes,
  concederAcesso,
  revogarAcesso,
  assumirPerfil,
  sairDoPerfilAssumido,
} from "./delegacoesAcesso.service";

type Fn = ReturnType<typeof vi.fn>;

const from = supabase.from as unknown as Fn;
const getSession = supabase.auth.getSession as unknown as Fn;
const invoke = supabase.functions.invoke as unknown as Fn;

/**
 * Builder para queries de listarDelegacoes:
 * cadeia from.select.eq.is — .is() é o terminal (awaitable).
 */
function criarQueryBuilder(data: unknown = [], error: unknown = null) {
  const b = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
  };
  b.select.mockReturnValue(b);
  b.eq.mockReturnValue(b);
  b.is.mockResolvedValue({ data, error });
  return b;
}

/**
 * Configura getSession e o global fetch para simular uma chamada
 * autenticada bem-sucedida via callDelegarAcesso.
 */
function mockSessaoValida(fetchData: unknown = { success: true }) {
  getSession.mockResolvedValue({
    data: { session: { access_token: "token123" } },
    error: null,
  });
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue(fetchData),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("delegacoesAcesso.service", () => {
  beforeEach(() => {
    from.mockReset();
    getSession.mockReset();
    invoke.mockReset();
    vi.unstubAllGlobals();
  });

  describe("listarDelegacoes", () => {
    const concedidoSeed = [
      {
        id: "d1",
        created_at: "2024-01-01",
        usuario_destino: { id: "u2", nome: "Destino", email: "destino@test.com" },
      },
    ];
    const recebidoSeed = [
      {
        id: "d2",
        created_at: "2024-01-02",
        usuario_origem: { id: "u3", nome: "Origem", email: "origem@test.com" },
      },
    ];

    it("retorna listas concedidos e recebidos corretamente", async () => {
      const qConcedidos = criarQueryBuilder(concedidoSeed);
      const qRecebidos = criarQueryBuilder(recebidoSeed);
      from.mockReturnValueOnce(qConcedidos).mockReturnValueOnce(qRecebidos);

      const result = await listarDelegacoes("u1");

      expect(from).toHaveBeenCalledTimes(2);
      expect(from).toHaveBeenNthCalledWith(1, "delegacoes_acesso");
      expect(from).toHaveBeenNthCalledWith(2, "delegacoes_acesso");
      expect(qConcedidos.eq).toHaveBeenCalledWith("concedente_id", "u1");
      expect(qConcedidos.is).toHaveBeenCalledWith("revoked_at", null);
      expect(qRecebidos.eq).toHaveBeenCalledWith("delegado_id", "u1");
      expect(qRecebidos.is).toHaveBeenCalledWith("revoked_at", null);
      expect(result.concedidos).toEqual(concedidoSeed);
      expect(result.recebidos).toEqual(recebidoSeed);
    });

    it("lança AppError DELEGACOES_LIST_ERROR quando concedidos retornar erro", async () => {
      const qConcedidos = criarQueryBuilder(null, new Error("DB error"));
      const qRecebidos = criarQueryBuilder([]);
      from.mockReturnValueOnce(qConcedidos).mockReturnValueOnce(qRecebidos);

      const err = await listarDelegacoes("u1").catch((e: unknown) => e);

      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("DELEGACOES_LIST_ERROR");
    });

    it("lança AppError DELEGACOES_LIST_ERROR quando recebidos retornar erro", async () => {
      const qConcedidos = criarQueryBuilder([]);
      const qRecebidos = criarQueryBuilder(null, new Error("DB error"));
      from.mockReturnValueOnce(qConcedidos).mockReturnValueOnce(qRecebidos);

      const err = await listarDelegacoes("u1").catch((e: unknown) => e);

      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe("DELEGACOES_LIST_ERROR");
    });
  });

  describe("concederAcesso", () => {
    it("chama fetch com acao=conceder e email corretos", async () => {
      const fetchMock = mockSessaoValida();

      await concederAcesso("teste@exemplo.com");

      expect(getSession).toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/functions/v1/delegar-acesso"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer token123",
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({ acao: "conceder", email: "teste@exemplo.com" }),
        })
      );
    });

    it("lança Error quando a resposta fetch não for ok", async () => {
      getSession.mockResolvedValue({
        data: { session: { access_token: "token123" } },
        error: null,
      });
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          json: vi.fn().mockResolvedValue({ error: "Email já tem acesso" }),
        })
      );

      await expect(concederAcesso("dup@exemplo.com")).rejects.toThrow(
        "Email já tem acesso"
      );
    });

    it("lança Error 'Usuário não autenticado' quando sessionError estiver presente", async () => {
      getSession.mockResolvedValue({
        data: { session: null },
        error: new Error("auth error"),
      });

      await expect(concederAcesso("x@exemplo.com")).rejects.toThrow(
        "Usuário não autenticado"
      );
    });

    it("lança Error 'Usuário não autenticado' quando não houver access_token na sessão", async () => {
      getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      await expect(concederAcesso("x@exemplo.com")).rejects.toThrow(
        "Usuário não autenticado"
      );
    });
  });

  describe("revogarAcesso", () => {
    it("chama fetch com acao=revogar e delegacao_id corretos", async () => {
      const fetchMock = mockSessaoValida();

      await revogarAcesso("del-123");

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/functions/v1/delegar-acesso"),
        expect.objectContaining({
          body: JSON.stringify({ acao: "revogar", delegacao_id: "del-123" }),
        })
      );
    });

    it("lança Error quando resposta fetch não for ok", async () => {
      getSession.mockResolvedValue({
        data: { session: { access_token: "token123" } },
        error: null,
      });
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          json: vi.fn().mockResolvedValue({ error: "Delegação não encontrada" }),
        })
      );

      await expect(revogarAcesso("del-xyz")).rejects.toThrow(
        "Delegação não encontrada"
      );
    });
  });

  describe("assumirPerfil", () => {
    it("chama supabase.functions.invoke com payload correto e retorna data", async () => {
      const expectedData = {
        usuario_assumido_id: "u2",
        owner: { id: "u1", nome: "Dono", email: "dono@test.com" },
      };
      invoke.mockResolvedValue({ data: expectedData, error: null });

      const result = await assumirPerfil("del-456");

      expect(invoke).toHaveBeenCalledWith("delegar-acesso", {
        body: { acao: "assumir", delegacao_id: "del-456" },
      });
      expect(result).toEqual(expectedData);
    });

    it("relança error quando invoke retornar error", async () => {
      const error = new Error("Delegação inválida");
      invoke.mockResolvedValue({ data: null, error });

      await expect(assumirPerfil("del-bad")).rejects.toThrow(
        "Delegação inválida"
      );
    });
  });

  describe("sairDoPerfilAssumido", () => {
    it("chama fetch com acao=sair", async () => {
      const fetchMock = mockSessaoValida();

      await sairDoPerfilAssumido();

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/functions/v1/delegar-acesso"),
        expect.objectContaining({
          body: JSON.stringify({ acao: "sair" }),
        })
      );
    });

    it("lança Error quando resposta fetch não for ok", async () => {
      getSession.mockResolvedValue({
        data: { session: { access_token: "token123" } },
        error: null,
      });
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          json: vi.fn().mockResolvedValue({ error: "Sem perfil assumido" }),
        })
      );

      await expect(sairDoPerfilAssumido()).rejects.toThrow("Sem perfil assumido");
    });
  });
});
