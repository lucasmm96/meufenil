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

      const orderMock = vi.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const ilikeMock = vi.fn().mockReturnValue({
        order: orderMock,
      });

      const orMock = vi.fn().mockReturnValue({
        ilike: ilikeMock,
      });

      const selectMock = vi.fn().mockReturnValue({
        or: orMock,
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: selectMock,
      });

      const result = await getReferencias({
        usuarioId: "123",
        search: "Ar",
      });

      expect(result).toEqual(mockData);
      expect(selectMock).toHaveBeenCalledWith(
        "id, nome, fenil_mg_por_100g"
      );
      expect(orMock).toHaveBeenCalledWith(
        "is_global.eq.true,criado_por.eq.123"
      );
      expect(ilikeMock).toHaveBeenCalledWith("nome", "%Ar%");
      expect(orderMock).toHaveBeenCalledWith("nome");
    });

    it("deve lançar AppError se ocorrer erro", async () => {
      const orderMock = vi.fn().mockResolvedValue({
        data: null,
        error: new Error("DB error"),
      });

      const ilikeMock = vi.fn().mockReturnValue({ order: orderMock });
      const orMock = vi.fn().mockReturnValue({ ilike: ilikeMock });
      const selectMock = vi.fn().mockReturnValue({ or: orMock });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: selectMock,
      });

      await expect(
        getReferencias({ usuarioId: "123" })
      ).rejects.toBeInstanceOf(AppError);
    });
  });

  describe("createReferencia", () => {
    it("deve criar referência corretamente", async () => {
      const mockData: ReferenciaDTO = {
        id: "1",
        nome: "Banana",
        fenil_mg_por_100g: 30,
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

      expect(result).toEqual(mockData);
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
