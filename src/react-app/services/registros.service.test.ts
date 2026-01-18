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
  createRegistro,
  getRegistros,
  deleteRegistro,
  RegistroDTO,
} from "./registros.service";

describe("registros.service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createRegistro", () => {
    it("deve criar registro corretamente", async () => {
      const insertMock = vi.fn().mockResolvedValue({
        error: null,
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        insert: insertMock,
      });

      await createRegistro({
        usuarioId: "user-1",
        referenciaId: "ref-1",
        data: "2024-01-01",
        peso_g: 100,
        fenil_mg: 50,
      });

      expect(insertMock).toHaveBeenCalledWith({
        usuario_id: "user-1",
        referencia_id: "ref-1",
        data: "2024-01-01",
        peso_g: 100,
        fenil_mg: 50,
      });
    });

    it("deve lançar AppError se ocorrer erro ao criar registro", async () => {
      const insertMock = vi.fn().mockResolvedValue({
        error: new Error("Insert error"),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        insert: insertMock,
      });

      await expect(
        createRegistro({
          usuarioId: "user-1",
          referenciaId: "ref-1",
          data: "2024-01-01",
          peso_g: 100,
          fenil_mg: 50,
        })
      ).rejects.toBeInstanceOf(AppError);
    });
  });

  describe("getRegistros", () => {
    it("deve retornar registros corretamente", async () => {
      const mockData = [
        {
          id: "1",
          data: "2024-01-02",
          peso_g: 100,
          fenil_mg: 50,
          created_at: "2024-01-02T10:00:00Z",
          referencias: { nome: "Arroz" },
        },
        {
          id: "2",
          data: "2024-01-01",
          peso_g: 200,
          fenil_mg: 80,
          created_at: "2024-01-01T10:00:00Z",
          referencias: [{ nome: "Feijão" }],
        },
      ];

      const orderMock = vi.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const eqMock = vi.fn().mockReturnValue({
        order: orderMock,
      });

      const selectMock = vi.fn().mockReturnValue({
        eq: eqMock,
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: selectMock,
      });

      const result = await getRegistros("user-1");

      const expected: RegistroDTO[] = [
        {
          id: "1",
          data: "2024-01-02",
          peso_g: 100,
          fenil_mg: 50,
          created_at: "2024-01-02T10:00:00Z",
          nome_alimento: "Arroz",
        },
        {
          id: "2",
          data: "2024-01-01",
          peso_g: 200,
          fenil_mg: 80,
          created_at: "2024-01-01T10:00:00Z",
          nome_alimento: "Feijão",
        },
      ];

      expect(result).toEqual(expected);
      expect(selectMock).toHaveBeenCalledWith(`
      id,
      data,
      peso_g,
      fenil_mg,
      created_at,
      referencias!inner ( nome )
    `);
      expect(eqMock).toHaveBeenCalledWith("usuario_id", "user-1");
      expect(orderMock).toHaveBeenCalledWith("data", { ascending: false });
    });

    it("deve lançar AppError se ocorrer erro ao buscar registros", async () => {
      const orderMock = vi.fn().mockResolvedValue({
        data: null,
        error: new Error("Query error"),
      });

      const eqMock = vi.fn().mockReturnValue({
        order: orderMock,
      });

      const selectMock = vi.fn().mockReturnValue({
        eq: eqMock,
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: selectMock,
      });

      await expect(getRegistros("user-1")).rejects.toBeInstanceOf(AppError);
    });
  });

  describe("deleteRegistro", () => {
    it("deve excluir registro corretamente", async () => {
      const eqMock = vi.fn().mockResolvedValue({
        error: null,
      });

      const deleteMock = vi.fn().mockReturnValue({
        eq: eqMock,
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        delete: deleteMock,
      });

      await deleteRegistro("registro-1");

      expect(eqMock).toHaveBeenCalledWith("id", "registro-1");
    });

    it("deve lançar AppError se ocorrer erro ao excluir registro", async () => {
      const eqMock = vi.fn().mockResolvedValue({
        error: new Error("Delete error"),
      });

      const deleteMock = vi.fn().mockReturnValue({
        eq: eqMock,
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        delete: deleteMock,
      });

      await expect(deleteRegistro("registro-1")).rejects.toBeInstanceOf(
        AppError
      );
    });
  });
});
