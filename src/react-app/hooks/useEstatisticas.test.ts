import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useEstatisticas } from "./useEstatisticas";
import { getEstatisticas } from "@/react-app/services/estatisticas.service";
import { logger } from "@/react-app/lib/logger";
import { EstatisticasDTO } from "@/react-app/services/dtos/estatisticas.dto";

vi.mock("@/react-app/services/estatisticas.service", () => ({
  getEstatisticas: vi.fn(),
}));

vi.mock("@/react-app/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("useEstatisticas", () => {
  const usuarioId = "user-123";
  const periodo = "semana";

  const estatisticasMock: EstatisticasDTO = {
    registros: [
      { data: "2026-01-10", total: 120 },
      { data: "2026-01-11", total: 80 },
    ],
    totalConsumo: 200,
    mediaConsumo: 100,
    maiorConsumo: 120,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("carrega estatísticas com sucesso", async () => {
    vi.mocked(getEstatisticas).mockResolvedValueOnce(estatisticasMock);

    const { result } = renderHook(() =>
      useEstatisticas({ usuarioId, periodo })
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(getEstatisticas).toHaveBeenCalledWith(usuarioId, periodo);
    expect(result.current.data).toEqual(estatisticasMock);
  });

  it("não chama o service se usuarioId não for informado", async () => {
    const { result } = renderHook(() => useEstatisticas());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(getEstatisticas).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });

  it("trata erro corretamente", async () => {
    const error = new Error("Erro de teste");

    vi.mocked(getEstatisticas).mockRejectedValueOnce(error);

    const { result } = renderHook(() =>
      useEstatisticas({ usuarioId, periodo })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(logger.error).toHaveBeenCalledWith(
      "Erro ao carregar estatísticas",
      error
    );
    expect(result.current.data).toBeNull();
  });

  it("recarrega os dados ao chamar reload", async () => {
    vi.mocked(getEstatisticas).mockResolvedValue(estatisticasMock);

    const { result } = renderHook(() =>
      useEstatisticas({ usuarioId, periodo })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(getEstatisticas).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.reload();
    });

    expect(getEstatisticas).toHaveBeenCalledTimes(2);
  });
});
