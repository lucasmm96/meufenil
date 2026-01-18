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
import { getEstatisticas } from "./estatisticas.service";
import {
  EstatisticasDTO,
  PeriodoEstatisticas,
} from "./dtos/estatisticas.dto";

describe("estatisticas.service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deve retornar estatísticas corretamente para o período semana", async () => {
    // 1️⃣ mock usuário
    const usuarioMock = {
      id: "user-1",
      timezone: "America/Sao_Paulo",
    };

    const usuarioSingleMock = vi.fn().mockResolvedValue({
      data: usuarioMock,
      error: null,
    });

    const usuarioEqMock = vi.fn().mockReturnValue({
      single: usuarioSingleMock,
    });

    const usuarioSelectMock = vi.fn().mockReturnValue({
      eq: usuarioEqMock,
    });

    // 2️⃣ mock registros
    const registrosDB = [
      { data: "2024-01-10", fenil_mg: 100 },
      { data: "2024-01-10", fenil_mg: 50 },
      { data: "2024-01-11", fenil_mg: 30 },
    ];

    const registrosGteMock = vi.fn().mockResolvedValue({
      data: registrosDB,
      error: null,
    });

    const registrosEqMock = vi.fn().mockReturnValue({
      gte: registrosGteMock,
    });

    const registrosSelectMock = vi.fn().mockReturnValue({
      eq: registrosEqMock,
    });

    // ordem das chamadas do supabase.from
    (supabase.from as unknown as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({
        select: usuarioSelectMock,
      })
      .mockReturnValueOnce({
        select: registrosSelectMock,
      });

    const result: EstatisticasDTO = await getEstatisticas(
      "user-1",
      "semana" as PeriodoEstatisticas
    );

    expect(result.registros).toEqual([
      { data: "2024-01-10", total: 150 },
      { data: "2024-01-11", total: 30 },
    ]);

    expect(result.totalConsumo).toBe(180);
    expect(result.mediaConsumo).toBe(90);
    expect(result.maiorConsumo).toBe(150);
  });

  it("deve lançar AppError se falhar ao buscar usuário", async () => {
    const usuarioSingleMock = vi.fn().mockResolvedValue({
      data: null,
      error: new Error("User error"),
    });

    const usuarioEqMock = vi.fn().mockReturnValue({
      single: usuarioSingleMock,
    });

    const usuarioSelectMock = vi.fn().mockReturnValue({
      eq: usuarioEqMock,
    });

    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      select: usuarioSelectMock,
    });

    await expect(
      getEstatisticas("user-1", "semana" as PeriodoEstatisticas)
    ).rejects.toBeInstanceOf(AppError);
  });

  it("deve lançar AppError se falhar ao buscar registros", async () => {
    // usuário ok
    const usuarioSingleMock = vi.fn().mockResolvedValue({
      data: { id: "user-1", timezone: "America/Sao_Paulo" },
      error: null,
    });

    const usuarioEqMock = vi.fn().mockReturnValue({
      single: usuarioSingleMock,
    });

    const usuarioSelectMock = vi.fn().mockReturnValue({
      eq: usuarioEqMock,
    });

    // registros com erro
    const registrosGteMock = vi.fn().mockResolvedValue({
      data: null,
      error: new Error("Registros error"),
    });

    const registrosEqMock = vi.fn().mockReturnValue({
      gte: registrosGteMock,
    });

    const registrosSelectMock = vi.fn().mockReturnValue({
      eq: registrosEqMock,
    });

    (supabase.from as unknown as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({
        select: usuarioSelectMock,
      })
      .mockReturnValueOnce({
        select: registrosSelectMock,
      });

    await expect(
      getEstatisticas("user-1", "mes" as PeriodoEstatisticas)
    ).rejects.toBeInstanceOf(AppError);
  });
});
