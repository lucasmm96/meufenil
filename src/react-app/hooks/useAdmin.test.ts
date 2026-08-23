import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAdmin } from "./useAdmin";
import { AppError } from "@/react-app/lib/errors";
import * as adminService from "@/react-app/services/admin.service";
import type {
  UsuarioAdminDTO,
  EstatisticasAdminDTO,
} from "@/react-app/services/dtos/admin.dto";

/**
 * Mocks
 */
vi.mock("@/react-app/services/admin.service", () => ({
  getPerfilAdmin: vi.fn(),
  getUsuariosAdmin: vi.fn(),
  getEstatisticasAdmin: vi.fn(),
  toggleRoleUsuario: vi.fn(),
}));

vi.mock("@/react-app/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("useAdmin", () => {
  const usuarioId = "admin-1";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não carrega dados se usuarioId não for informado", async () => {
    const { result } = renderHook(() => useAdmin());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.perfilUsuario).toBeNull();
    expect(result.current.usuarios).toEqual([]);
    expect(result.current.estatisticasDB).toBeNull();
  });

  it("carrega dados completos quando usuário é admin", async () => {
    const perfilAdmin: UsuarioAdminDTO = {
      id: usuarioId,
      role: "admin",
      email: "admin@test.com",
      nome: "Admin Test",
      limite_diario_mg: 0,
      created_at: "2026-01-01T00:00:00Z",
    };
    const usuarios: UsuarioAdminDTO[] = [
      {
        id: "1",
        role: "user",
        email: "u1@test.com",
        nome: "User 1",
        limite_diario_mg: 0,
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "2",
        role: "admin",
        email: "u2@test.com",
        nome: "User 2",
        limite_diario_mg: 0,
        created_at: "2026-01-01T00:00:00Z",
      },
    ];
    const estatisticas: EstatisticasAdminDTO = {
      usuarios: 2,
      registros: 0,
      referencias: { total: 0, globais: 0, personalizadas: 0 },
      armazenamento: {
        estimado_mb: 0,
        limite_gratuito_mb: 500,
        percentual_usado: 0,
      },
    };

    vi.mocked(adminService.getPerfilAdmin).mockResolvedValue(perfilAdmin);
    vi.mocked(adminService.getUsuariosAdmin).mockResolvedValue(usuarios);
    vi.mocked(adminService.getEstatisticasAdmin).mockResolvedValue(estatisticas);

    const { result } = renderHook(() => useAdmin(usuarioId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.perfilUsuario).toEqual(perfilAdmin);
    expect(result.current.usuarios).toEqual(usuarios);
    expect(result.current.estatisticasDB).toEqual(estatisticas);
    expect(result.current.error).toBeNull();
  });

  it("bloqueia dados administrativos quando usuário não é admin", async () => {
    const perfilUser: UsuarioAdminDTO = {
      id: usuarioId,
      role: "user",
      email: "user@test.com",
      nome: "User Test",
      limite_diario_mg: 0,
      created_at: "2026-01-01T00:00:00Z",
    };

    vi.mocked(adminService.getPerfilAdmin).mockResolvedValue(perfilUser);

    const { result } = renderHook(() => useAdmin(usuarioId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.perfilUsuario).toEqual(perfilUser);
    expect(result.current.usuarios).toEqual([]);
    expect(result.current.estatisticasDB).toBeNull();
  });

  it("define erro quando ocorre falha inesperada", async () => {
    const error = new Error("Falha crítica");

    vi.mocked(adminService.getPerfilAdmin).mockRejectedValue(error);

    const { result } = renderHook(() => useAdmin(usuarioId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(AppError);
    expect(result.current.error?.code).toBe("ADMIN_UNKNOWN_ERROR");
  });

  it("toggleRole altera role e recarrega dados", async () => {
    const perfilAdmin: UsuarioAdminDTO = {
      id: usuarioId,
      role: "admin",
      email: "admin@test.com",
      nome: "Admin Test",
      limite_diario_mg: 0,
      created_at: "2026-01-01T00:00:00Z",
    };
    const estatisticas: EstatisticasAdminDTO = {
      usuarios: 0,
      registros: 0,
      referencias: { total: 0, globais: 0, personalizadas: 0 },
      armazenamento: {
        estimado_mb: 0,
        limite_gratuito_mb: 500,
        percentual_usado: 0,
      },
    };

    vi.mocked(adminService.getPerfilAdmin).mockResolvedValue(perfilAdmin);
    vi.mocked(adminService.getUsuariosAdmin).mockResolvedValue([]);
    vi.mocked(adminService.getEstatisticasAdmin).mockResolvedValue(estatisticas);
    vi.mocked(adminService.toggleRoleUsuario).mockResolvedValue(undefined);

    const { result } = renderHook(() => useAdmin(usuarioId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggleRole("1", "user");
    });

    expect(adminService.toggleRoleUsuario).toHaveBeenCalledWith("1", "admin");
  });
});
