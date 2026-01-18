import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useLayoutPerfil } from "./useLayoutPerfil";
import { AppError } from "@/react-app/lib/errors";
import { PerfilLayoutDTO } from "@/react-app/services/layout.service";
import { getPerfilLayout } from "@/react-app/services/layout.service";
import { logger } from "@/react-app/lib/logger";

// 🔹 mocks
vi.mock("@/react-app/services/layout.service", () => ({
  getPerfilLayout: vi.fn(),
}));

vi.mock("@/react-app/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("useLayoutPerfil", () => {
  const usuarioId = "user-123";

  const perfilMock: PerfilLayoutDTO = {
    role: "user",
    nome: "Lucas",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("carrega o perfil corretamente", async () => {
    vi.mocked(getPerfilLayout).mockResolvedValueOnce(perfilMock);

    const { result } = renderHook(() => useLayoutPerfil(usuarioId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(getPerfilLayout).toHaveBeenCalledWith(usuarioId);
    expect(result.current.perfil).toEqual(perfilMock);
    expect(result.current.error).toBeNull();
  });

  it("não carrega perfil se usuarioId não for informado", async () => {
    const { result } = renderHook(() => useLayoutPerfil());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(getPerfilLayout).not.toHaveBeenCalled();
    expect(result.current.perfil).toBeNull();
  });

  it("trata erro corretamente ao carregar perfil", async () => {
    const error = new AppError(
      "LAYOUT_PROFILE_ERROR",
      "Erro ao carregar perfil",
    );

    vi.mocked(getPerfilLayout).mockRejectedValueOnce(error);

    const { result } = renderHook(() => useLayoutPerfil(usuarioId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(logger.error).toHaveBeenCalledWith(
      "Erro em useLayoutPerfil",
      error
    );
    expect(result.current.error).toBe(error);
    expect(result.current.perfil).toBeNull();
  });

  it("executa reload corretamente", async () => {
    vi.mocked(getPerfilLayout)
      .mockResolvedValueOnce(perfilMock)
      .mockResolvedValueOnce(perfilMock);

    const { result } = renderHook(() => useLayoutPerfil(usuarioId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.reload();
    });

    expect(getPerfilLayout).toHaveBeenCalledTimes(2);
  });
});
