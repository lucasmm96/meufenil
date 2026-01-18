import { renderHook, act, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { useRegistros } from "./useRegistros";
import { logger } from "@/react-app/lib/logger";

vi.mock("@/react-app/services/registros.service", () => ({
  getRegistros: vi.fn(),
  deleteRegistro: vi.fn(),
}));

vi.mock("@/react-app/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

import * as registrosService from "@/react-app/services/registros.service";

const mockRegistros = [
  {
    id: "1",
    data: "2025-01-01",
    alimento: "Arroz",
    peso: 100,
  },
];

describe("useRegistros", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("não carrega registros se usuarioId não for informado", async () => {
    const { result } = renderHook(() => useRegistros());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(registrosService.getRegistros).not.toHaveBeenCalled();
    expect(result.current.data).toEqual([]);
  });

  it("carrega registros com sucesso", async () => {
    const spy = registrosService.getRegistros as unknown as ReturnType<typeof vi.fn>;
    spy.mockResolvedValue(mockRegistros);

    const { result } = renderHook(() =>
      useRegistros({ usuarioId: "user-1" })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(spy).toHaveBeenCalledWith("user-1", undefined, undefined);
    expect(result.current.data).toEqual(mockRegistros);
  });

  it("loga erro quando getRegistros falhar", async () => {
    const error = new Error("Erro API");

    const spy = registrosService.getRegistros as unknown as ReturnType<typeof vi.fn>;
    spy.mockRejectedValue(error);

    const { result } = renderHook(() =>
      useRegistros({ usuarioId: "user-1" })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(logger.error).toHaveBeenCalledWith(
      "Erro ao carregar registros",
      error
    );
    expect(result.current.data).toEqual([]);
  });

  it("remove registro e recarrega lista", async () => {
    const getSpy = registrosService.getRegistros as unknown as ReturnType<typeof vi.fn>;
    const deleteSpy = registrosService.deleteRegistro as unknown as ReturnType<typeof vi.fn>;

    getSpy
      .mockResolvedValueOnce(mockRegistros) // carga inicial
      .mockResolvedValueOnce([]);           // após remoção

    deleteSpy.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useRegistros({ usuarioId: "user-1" })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // 🔑 limpa histórico antes da ação que queremos testar
    getSpy.mockClear();

    await act(async () => {
      await result.current.remove("1");
    });

    expect(deleteSpy).toHaveBeenCalledWith("1");
    expect(getSpy).toHaveBeenCalled(); // não importa quantas
    expect(result.current.data).toEqual([]);
  });

});
