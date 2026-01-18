import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { usePerfil } from "./usePerfil";
import { AppError } from "@/react-app/lib/errors";
import { UsuarioDTO } from "@/react-app/services/dtos/usuarios.dto";
import {
  getUsuarioPerfil,
  atualizarUsuarioPerfil,
} from "@/react-app/services/usuarios.service";
import { logger } from "@/react-app/lib/logger";

// 🔹 mocks dos services
vi.mock("@/react-app/services/usuarios.service", () => ({
  getUsuarioPerfil: vi.fn(),
  atualizarUsuarioPerfil: vi.fn(),
}));

// 🔹 mock do logger
vi.mock("@/react-app/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("usePerfil", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockPerfil: UsuarioDTO = {
    id: "1",
    nome: "Lucas",
    email: "lucas@email.com",
    role: "user",
    limite_diario_mg: 300,
    timezone: "America/Sao_Paulo",
    consentimento_lgpd_em: null,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  };

  it("deve carregar perfil corretamente", async () => {
    vi.mocked(getUsuarioPerfil).mockResolvedValueOnce(mockPerfil);

    const { result } = renderHook(() => usePerfil("123"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.perfil).toEqual(mockPerfil);
    expect(result.current.error).toBeNull();
  });

  it("deve setar erro quando getUsuarioPerfil falhar", async () => {
    const error = new AppError(
      "USER_PROFILE_ERROR",
      "Erro ao carregar",
    );

    vi.mocked(getUsuarioPerfil).mockRejectedValueOnce(error);

    const { result } = renderHook(() => usePerfil("123"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.perfil).toBeNull();
    expect(result.current.error).toEqual(error);
    expect(logger.error).toHaveBeenCalledWith("Erro em usePerfil", error);
  });

  it("não deve carregar se usuarioId não for informado", async () => {
    const { result } = renderHook(() => usePerfil());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.perfil).toBeNull();
    expect(getUsuarioPerfil).not.toHaveBeenCalled();
  });

  it("deve salvar perfil e recarregar os dados", async () => {
    vi.mocked(getUsuarioPerfil)
      .mockResolvedValueOnce(mockPerfil)
      .mockResolvedValueOnce({
        ...mockPerfil,
        nome: "Novo Nome",
      });

    vi.mocked(atualizarUsuarioPerfil).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => usePerfil("123"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.salvar({
        nome: "Novo Nome",
        limite_diario_mg: 400,
      });
    });

    expect(atualizarUsuarioPerfil).toHaveBeenCalledWith("123", {
      nome: "Novo Nome",
      limite_diario_mg: 400,
    });

    expect(result.current.perfil?.nome).toBe("Novo Nome");
    expect(result.current.saving).toBe(false);
  });

  it("deve controlar corretamente o estado saving", async () => {
    vi.mocked(getUsuarioPerfil).mockResolvedValueOnce(mockPerfil);
    vi.mocked(atualizarUsuarioPerfil).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => usePerfil("123"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.salvar({
        nome: "Teste",
        limite_diario_mg: 200,
      });
    });

    expect(result.current.saving).toBe(true);

    await waitFor(() => {
      expect(result.current.saving).toBe(false);
    });
  });
});
