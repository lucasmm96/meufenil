import { renderHook, act, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { AppError } from "@/react-app/lib/errors";

/**
 * Mocks ANTES do hook
 */
vi.mock("@/react-app/services/registros.service", () => ({
  createRegistro: vi.fn(),
}));

vi.mock("@/react-app/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { useCreateRegistro } from "./useCreateRegistro";
import * as registrosService from "@/react-app/services/registros.service";

describe("useCreateRegistro hook", () => {
  const params = {
    usuarioId: "user-1",
    referenciaId: "ref-1",
    data: "2026-01-17",
    peso_g: 100,
    fenil_mg: 250,
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deve criar o registro com sucesso", async () => {
    const createRegistroMock =
      registrosService.createRegistro as unknown as ReturnType<typeof vi.fn>;

    createRegistroMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useCreateRegistro());

    await act(async () => {
      await result.current.create(params);
    });

    expect(createRegistroMock).toHaveBeenCalledWith(params);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("deve setar erro quando createRegistro lançar AppError", async () => {
    const error = new AppError("CREATE_ERROR", "Erro ao criar registro");

    const createRegistroMock =
      registrosService.createRegistro as unknown as ReturnType<typeof vi.fn>;

    createRegistroMock.mockRejectedValue(error);

    const { result } = renderHook(() => useCreateRegistro());

    // ⬇️ captura manual (NÃO use rejects aqui)
    await act(async () => {
      try {
        await result.current.create(params);
      } catch (_) {}
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toEqual(error);
    });
  });

  it("deve transformar erro desconhecido em AppError", async () => {
    const createRegistroMock =
      registrosService.createRegistro as unknown as ReturnType<typeof vi.fn>;

    createRegistroMock.mockRejectedValue(new Error("Erro qualquer"));

    const { result } = renderHook(() => useCreateRegistro());

    await act(async () => {
      try {
        await result.current.create(params);
      } catch (_) {}
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeInstanceOf(AppError);
      expect(result.current.error?.code).toBe("UNKNOWN_ERROR");
    });
  });
});
