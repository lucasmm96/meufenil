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
import {
  getReferencias,
  createReferencia,
  ReferenciaDTO,
} from "./referencias.service";

describe("referencias.service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getReferencias", () => {
    it("deve retornar referências corretamente", async () => {
      const mockData: ReferenciaDTO[] = [
        { id: "1", nome: "Arroz", fenil_mg_por_100g: 50 },
        { id: "2", nome: "Feijão", fenil_mg_por_100g: 120 },
      ];

      const rangeMock = vi.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });
      const orderMock = vi.fn().mockReturnValue({
        range: rangeMock,
      });
      const eqAtivaMock = vi.fn().mockReturnValue({
        order: orderMock,
      });
      const ilikeMock = vi.fn().mockReturnValue({
        eq: eqAtivaMock,
      });
      const orMock = vi.fn().mockReturnValue({
        eq: eqAtivaMock,
        ilike: ilikeMock,
      });
      const selectMock = vi.fn().mockReturnValue({
        or: orMock,
      });
      const favSelectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce({
          select: favSelectMock,
        })
        .mockReturnValueOnce({
          select: selectMock,
        });

      const result = await getReferencias({
        usuarioId: "123",
        search: "Ar",
      });

      expect(result).toEqual([
        expect.objectContaining({ ...mockData[0], is_favorita: false }),
        expect.objectContaining({ ...mockData[1], is_favorita: false }),
      ]);
      expect(selectMock).toHaveBeenCalledWith(expect.stringContaining("id"));
      expect(orMock).toHaveBeenCalledWith(expect.stringContaining("is_global.eq.true"));
      expect(ilikeMock).toHaveBeenCalledWith("nome", "%Ar%");
      expect(eqAtivaMock).toHaveBeenCalledWith("is_ativa", true);
      expect(orderMock).toHaveBeenCalledWith("nome", { ascending: true });
      expect(rangeMock).toHaveBeenCalledWith(0, 999);
    });

    it("deve lançar AppError se ocorrer erro", async () => {
      const rangeMock = vi.fn().mockResolvedValue({
        data: null,
        error: new Error("DB error"),
      });

      const orderMock = vi.fn().mockReturnValue({ range: rangeMock });
      const eqAtivaMock = vi.fn().mockReturnValue({ order: orderMock });
      const ilikeMock = vi.fn().mockReturnValue({ eq: eqAtivaMock });
      const orMock = vi.fn().mockReturnValue({ ilike: ilikeMock });
      const selectMock = vi.fn().mockReturnValue({ or: orMock });
      const favSelectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce({
          select: favSelectMock,
        })
        .mockReturnValueOnce({
          select: selectMock,
        });

      await expect(
        getReferencias({ usuarioId: "123" })
      ).rejects.toBeInstanceOf(AppError);
    });
  });

  describe("createReferencia", () => {
    it("deve criar referência corretamente", async () => {
      const mockData = {
        id: "1",
        nome: "Banana",
        fenil_mg_por_100g: 30,
        is_global: false,
      };

      const singleMock = vi.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const selectMock = vi.fn().mockReturnValue({
        single: singleMock,
      });

      const insertMock = vi.fn().mockReturnValue({
        select: selectMock,
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        insert: insertMock,
      });

      const result = await createReferencia({
        nome: "Banana",
        fenil_mg_por_100g: 30,
        usuarioId: "123",
      });

      expect(insertMock).toHaveBeenCalledWith({
        nome: "Banana",
        fenil_mg_por_100g: 30,
        criado_por: "123",
        is_global: false,
      });

      expect(result).toEqual(
        expect.objectContaining({
          ...mockData,
          criado_por: undefined,
          is_favorita: false,
          is_ativa: true,
        }),
      );
    });

    it("deve lançar AppError se falhar ao criar referência", async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: null,
        error: new Error("Insert error"),
      });

      const selectMock = vi.fn().mockReturnValue({
        single: singleMock,
      });

      const insertMock = vi.fn().mockReturnValue({
        select: selectMock,
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        insert: insertMock,
      });

      await expect(
        createReferencia({
          nome: "Erro",
          fenil_mg_por_100g: 10,
          usuarioId: "123",
        })
      ).rejects.toBeInstanceOf(AppError);
    });
  });
});
