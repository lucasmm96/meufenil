import { describe, it, expect, vi, afterEach } from "vitest";
import { AppError } from "@/react-app/lib/errors";

// 👉 mock do supabase ANTES do import do service
vi.mock("@/react-app/lib/supabase", () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

import { supabase } from "@/react-app/lib/supabase";
import { getPerfilLayout, PerfilLayoutDTO } from "./layout.service";

describe("perfilLayout.service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getPerfilLayout", () => {
    it("deve retornar o perfil de layout corretamente", async () => {
      const mockData: PerfilLayoutDTO = {
        role: "admin",
        nome: "Lucas",
      };

      const singleMock = vi.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const eqMock = vi.fn().mockReturnValue({
        single: singleMock,
      });

      const selectMock = vi.fn().mockReturnValue({
        eq: eqMock,
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: selectMock,
      });

      const result = await getPerfilLayout("user-1");

      expect(result).toEqual(mockData);
      expect(selectMock).toHaveBeenCalledWith("role, nome");
      expect(eqMock).toHaveBeenCalledWith("id", "user-1");
      expect(singleMock).toHaveBeenCalled();
    });

    it("deve lançar AppError se ocorrer erro ao buscar perfil de layout", async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: null,
        error: new Error("Query error"),
      });

      const eqMock = vi.fn().mockReturnValue({
        single: singleMock,
      });

      const selectMock = vi.fn().mockReturnValue({
        eq: eqMock,
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: selectMock,
      });

      await expect(getPerfilLayout("user-1")).rejects.toBeInstanceOf(
        AppError
      );
    });
  });
});
