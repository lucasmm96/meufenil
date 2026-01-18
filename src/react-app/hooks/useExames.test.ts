import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useExames } from "./useExames";
import { AppError } from "@/react-app/lib/errors";
import { ExameDTO } from "@/react-app/services/dtos/exames.dto";
import {
  getExamesPKU,
  createExamePKU,
  deleteExamePKU,
} from "@/react-app/services/exames.service";
import { logger } from "@/react-app/lib/logger";

// 🔹 mocks
vi.mock("@/react-app/services/exames.service", () => ({
  getExamesPKU: vi.fn(),
  createExamePKU: vi.fn(),
  deleteExamePKU: vi.fn(),
}));

vi.mock("@/react-app/hooks/usePerfil", () => ({
  usePerfil: () => ({
    perfil: {
      timezone: "America/Sao_Paulo",
    },
  }),
}));

vi.mock("@/react-app/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("useExames", () => {
  const usuarioId = "user-123";

  const examesMock: ExameDTO[] = [
    {
      id: "1",
      usuario_id: usuarioId,
      data_exame: "2026-01-10",
      resultado_mg_dl: 4.2,
      created_at: "2026-01-10T10:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("carrega exames corretamente", async () => {
    vi.mocked(getExamesPKU).mockResolvedValueOnce(examesMock);

    const { result } = renderHook(() => useExames(usuarioId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(getExamesPKU).toHaveBeenCalledWith(usuarioId);
    expect(result.current.exames).toEqual(examesMock);
    expect(result.current.error).toBeNull();
    expect(result.current.timezone).toBe("America/Sao_Paulo");
  });

  it("não carrega exames se usuarioId não for informado", async () => {
    const { result } = renderHook(() => useExames());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(getExamesPKU).not.toHaveBeenCalled();
    expect(result.current.exames).toEqual([]);
  });

  it("trata erro corretamente ao carregar exames", async () => {
    const error = new AppError(
      "EXAMES_FETCH_ERROR",
      "Erro ao carregar exames",
    );

    vi.mocked(getExamesPKU).mockRejectedValueOnce(error);

    const { result } = renderHook(() => useExames(usuarioId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(logger.error).toHaveBeenCalledWith("Erro em useExames", error);
    expect(result.current.error).toBe(error);
    expect(result.current.exames).toEqual([]);
  });

  it("cria exame e recarrega lista", async () => {
    vi.mocked(getExamesPKU)
      .mockResolvedValueOnce(examesMock)
      .mockResolvedValueOnce(examesMock);

    const { result } = renderHook(() => useExames(usuarioId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.criar({
        dataISO: "2026-01-12",
        resultado: 3.8,
      });
    });

    expect(createExamePKU).toHaveBeenCalledWith({
      usuarioId,
      dataExameISO: "2026-01-12",
      resultadoMgDl: 3.8,
    });

    expect(getExamesPKU).toHaveBeenCalledTimes(2);
  });

  it("remove exame e recarrega lista", async () => {
    vi.mocked(getExamesPKU)
      .mockResolvedValueOnce(examesMock)
      .mockResolvedValueOnce([]);

    const { result } = renderHook(() => useExames(usuarioId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.remover("1");
    });

    expect(deleteExamePKU).toHaveBeenCalledWith({
      exameId: "1",
      usuarioId,
    });

    expect(getExamesPKU).toHaveBeenCalledTimes(2);
  });
});
