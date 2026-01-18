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
  getExamesPKU,
  createExamePKU,
  deleteExamePKU,
} from "./exames.service";
import { ExameDTO } from "@/react-app/services/dtos/exames.dto";

describe("examesPKU.service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getExamesPKU", () => {
    it("deve retornar exames PKU corretamente", async () => {
      const mockRows = [
        {
          id: "1",
          usuario_id: "user-1",
          data_exame: "2024-01-10",
          resultado_mg_dl: 5,
          created_at: "2024-01-10T10:00:00Z",
        },
      ];

      const expected: ExameDTO[] = [
        {
          id: "1",
          usuario_id: "user-1",
          data_exame: "2024-01-10",
          resultado_mg_dl: 5,
          created_at: "2024-01-10T10:00:00Z",
        },
      ];

      const orderMock = vi.fn().mockResolvedValue({
        data: mockRows,
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

      const result = await getExamesPKU("user-1");

      expect(result).toEqual(expected);
      expect(selectMock).toHaveBeenCalledWith("*");
      expect(eqMock).toHaveBeenCalledWith("usuario_id", "user-1");
      expect(orderMock).toHaveBeenCalledWith("data_exame", {
        ascending: false,
      });
    });

    it("deve lançar AppError se ocorrer erro ao buscar exames PKU", async () => {
      const orderMock = vi.fn().mockResolvedValue({
        data: null,
        error: new Error("DB error"),
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

      await expect(getExamesPKU("user-1")).rejects.toBeInstanceOf(
        AppError
      );
    });
  });

  describe("createExamePKU", () => {
    it("deve criar exame PKU corretamente", async () => {
      const insertMock = vi.fn().mockResolvedValue({
        error: null,
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        insert: insertMock,
      });

      await createExamePKU({
        usuarioId: "user-1",
        dataExameISO: "2024-01-10",
        resultadoMgDl: 8,
      });

      expect(insertMock).toHaveBeenCalledWith({
        usuario_id: "user-1",
        data_exame: "2024-01-10",
        resultado_mg_dl: 8,
      });
    });

    it("deve lançar AppError se falhar ao criar exame PKU", async () => {
      const insertMock = vi.fn().mockResolvedValue({
        error: new Error("Insert error"),
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        insert: insertMock,
      });

      await expect(
        createExamePKU({
          usuarioId: "user-1",
          dataExameISO: "2024-01-10",
          resultadoMgDl: 8,
        })
      ).rejects.toBeInstanceOf(AppError);
    });
  });

  describe("deleteExamePKU", () => {
    it("deve excluir exame PKU corretamente", async () => {
      const eqUsuarioMock = vi.fn().mockResolvedValue({
        error: null,
      });

      const eqIdMock = vi.fn().mockReturnValue({
        eq: eqUsuarioMock,
      });

      const deleteMock = vi.fn().mockReturnValue({
        eq: eqIdMock,
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        delete: deleteMock,
      });

      await deleteExamePKU({
        exameId: "exame-1",
        usuarioId: "user-1",
      });

      expect(deleteMock).toHaveBeenCalled();
      expect(eqIdMock).toHaveBeenCalledWith("id", "exame-1");
      expect(eqUsuarioMock).toHaveBeenCalledWith("usuario_id", "user-1");
    });

    it("deve lançar AppError se falhar ao excluir exame PKU", async () => {
      const eqUsuarioMock = vi.fn().mockResolvedValue({
        error: new Error("Delete error"),
      });

      const eqIdMock = vi.fn().mockReturnValue({
        eq: eqUsuarioMock,
      });

      const deleteMock = vi.fn().mockReturnValue({
        eq: eqIdMock,
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        delete: deleteMock,
      });

      await expect(
        deleteExamePKU({
          exameId: "exame-1",
          usuarioId: "user-1",
        })
      ).rejects.toBeInstanceOf(AppError);
    });
  });
});
