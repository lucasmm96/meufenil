import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPerfilAdmin,
  getUsuariosAdmin,
  toggleRoleUsuario,
  getEstatisticasAdmin,
  importarReferenciasCSV,
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

  it("toggleRoleUsuario atualiza role", async () => {
    fromMock.mockReturnValueOnce({
      update: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockResolvedValueOnce({
          error: null,
        }),
      }),
    });

    await expect(toggleRoleUsuario("1", "admin")).resolves.toBeUndefined();
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

  it("importarReferenciasCSV importa CSV válido", async () => {
    // consulta existentes
    fromMock.mockReturnValueOnce({
      select: vi.fn().mockReturnValueOnce({
        in: vi.fn().mockResolvedValueOnce({
          data: [],
          error: null,
        }),
      }),
    });

    // upsert
    fromMock.mockReturnValueOnce({
      upsert: vi.fn().mockResolvedValueOnce({
        error: null,
      }),
    });

    const csv = `nome;fenil
Arroz;10
Feijão;20`;

    const result = await importarReferenciasCSV(csv);

    expect(result.importados).toBe(2);
    expect(result.erros).toHaveLength(0);
    expect(result.total).toBe(2);
  });
});
