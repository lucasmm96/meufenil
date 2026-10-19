import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { subDays, format } from "date-fns";
import { useEstatisticas } from "./useEstatisticas";
import { getEstatisticas } from "@/react-app/services/estatisticas.service";
import { read } from "@/react-app/services/offlineStorage.service";
import { logger } from "@/react-app/lib/logger";
import { EstatisticasDTO } from "@/react-app/services/dtos/estatisticas.dto";

vi.mock("@/react-app/services/estatisticas.service", () => ({
  getEstatisticas: vi.fn(),
}));

vi.mock("@/react-app/services/offlineStorage.service", () => ({
  read: vi.fn(),
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

describe("useEstatisticas — path offline (C2)", () => {
  const usuarioId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lê do IndexedDB quando isOnline=false e agrega por dia", async () => {
    const d1 = format(subDays(new Date(), 2), "yyyy-MM-dd");
    const d2 = format(subDays(new Date(), 1), "yyyy-MM-dd");
    vi.mocked(read).mockResolvedValueOnce([
      { data: d1, fenil_mg: 120 },
      { data: d1, fenil_mg: 50 },
      { data: d2, fenil_mg: 80 },
    ]);

    const { result } = renderHook(() =>
      useEstatisticas({ usuarioId, periodo: "semana", isOnline: false })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(read).toHaveBeenCalledWith("historico", usuarioId);
    expect(getEstatisticas).not.toHaveBeenCalled();
    expect(result.current.data?.totalConsumo).toBe(250);
    expect(result.current.data?.registros).toHaveLength(2);
    expect(result.current.data?.mediaConsumo).toBe(125);
    expect(result.current.data?.maiorConsumo).toBe(170);
  });

  it("retorna null quando IndexedDB está vazio offline", async () => {
    vi.mocked(read).mockResolvedValueOnce(null);

    const { result } = renderHook(() =>
      useEstatisticas({ usuarioId, periodo: "semana", isOnline: false })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
  });

  it("filtra registros mais antigos que 7 dias offline", async () => {
    const dentro = format(subDays(new Date(), 6), "yyyy-MM-dd");
    const fora = format(subDays(new Date(), 10), "yyyy-MM-dd");
    vi.mocked(read).mockResolvedValueOnce([
      { data: dentro, fenil_mg: 100 },
      { data: fora, fenil_mg: 999 },
    ]);

    const { result } = renderHook(() =>
      useEstatisticas({ usuarioId, periodo: "semana", isOnline: false })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.registros).toHaveLength(1);
    expect(result.current.data?.totalConsumo).toBe(100);
  });

  it("usa path online quando isOnline=true mesmo com mock IDB", async () => {
    vi.mocked(getEstatisticas).mockResolvedValueOnce({
      registros: [],
      totalConsumo: 0,
      mediaConsumo: 0,
      maiorConsumo: 0,
    });

    const { result } = renderHook(() =>
      useEstatisticas({ usuarioId, periodo: "semana", isOnline: true })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getEstatisticas).toHaveBeenCalledWith(usuarioId, "semana");
    expect(read).not.toHaveBeenCalled();
  });
});
