import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPerfilAdmin,
  getUsuariosAdmin,
  toggleRoleUsuario,
  getEstatisticasAdmin,
} from "./admin.service";
import { AppError } from "@/react-app/lib/errors";

/* =========================
   MOCK DO SUPABASE (CORRETO)
========================= */
vi.mock("@/react-app/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

import { supabase } from "@/react-app/lib/supabase";

const fromMock = supabase.from as unknown as ReturnType<typeof vi.fn>;
const rpcMock = supabase.rpc as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

/* =========================
   TESTES
========================= */

describe("admin.service", () => {
  it("getPerfilAdmin retorna usuário", async () => {
    fromMock.mockReturnValueOnce({
      select: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({
          single: vi.fn().mockResolvedValueOnce({
            data: { id: "1", role: "admin" },
            error: null,
          }),
        }),
      }),
    });

    const result = await getPerfilAdmin("1");

    expect(result).toEqual({ id: "1", role: "admin" });
  });

  it("getPerfilAdmin lança erro se falhar", async () => {
    fromMock.mockReturnValueOnce({
      select: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({
          single: vi.fn().mockResolvedValueOnce({
            data: null,
            error: { message: "erro" },
          }),
        }),
      }),
    });

    await expect(getPerfilAdmin("1")).rejects.toBeInstanceOf(AppError);
  });

  it("getUsuariosAdmin retorna lista", async () => {
    fromMock.mockReturnValueOnce({
      select: vi.fn().mockReturnValueOnce({
        order: vi.fn().mockResolvedValueOnce({
          data: [{ id: "1" }, { id: "2" }],
          error: null,
        }),
      }),
    });

    const result = await getUsuariosAdmin();

    expect(result).toHaveLength(2);
  });

  it("toggleRoleUsuario chama RPC toggle_role_usuario com sucesso", async () => {
    rpcMock.mockResolvedValueOnce({ error: null });

    await expect(toggleRoleUsuario("abc", "admin")).resolves.toBeUndefined();
    expect(rpcMock).toHaveBeenCalledWith("toggle_role_usuario", {
      alvo_id: "abc",
      novo_role: "admin",
    });
  });

  it("toggleRoleUsuario lança AppError com mensagem do banco se RPC falhar", async () => {
    rpcMock.mockResolvedValueOnce({
      error: { message: "Permissão negada: apenas administradores podem alterar papéis" },
    });

    await expect(toggleRoleUsuario("abc", "admin")).rejects.toMatchObject({
      message: "Permissão negada: apenas administradores podem alterar papéis",
    });
  });

  it("getEstatisticasAdmin calcula percentual corretamente", async () => {
    rpcMock.mockReturnValueOnce({
      single: vi.fn().mockResolvedValueOnce({
        data: {
          tamanho_db_mb: 250,
          registros_totais: 1000,
          referencias_total: 200,
          referencias_globais: 150,
          referencias_personalizadas: 50,
        },
        error: null,
      }),
    });

    const result = await getEstatisticasAdmin(10);

    expect(result.armazenamento.percentual_usado).toBe(50);
    expect(result.armazenamento.limite_gratuito_mb).toBe(500);
  });
});
