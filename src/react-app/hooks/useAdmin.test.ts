import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAdmin } from "./useAdmin";
import { AppError } from "@/react-app/lib/errors";
import * as adminService from "@/react-app/services/admin.service";

/**
 * Mocks
 */
vi.mock("@/react-app/services/admin.service", () => ({
  getPerfilAdmin: vi.fn(),
  getUsuariosAdmin: vi.fn(),
  getEstatisticasAdmin: vi.fn(),
  toggleRoleUsuario: vi.fn(),
  importarReferenciasCSV: vi.fn(),
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
    const perfilAdmin = { id: usuarioId, role: "admin", email: "admin@test.com" };
    const usuarios = [
      { id: "1", role: "user" },
      { id: "2", role: "admin" },
    ];
    const estatisticas = { totalUsuarios: 2, admins: 1 };

    (adminService.getPerfilAdmin as any).mockResolvedValue(perfilAdmin);
    (adminService.getUsuariosAdmin as any).mockResolvedValue(usuarios);
    (adminService.getEstatisticasAdmin as any).mockResolvedValue(estatisticas);

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
    const perfilUser = { id: usuarioId, role: "user", email: "user@test.com" };

    (adminService.getPerfilAdmin as any).mockResolvedValue(perfilUser);

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

    (adminService.getPerfilAdmin as any).mockRejectedValue(error);

    const { result } = renderHook(() => useAdmin(usuarioId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(AppError);
    expect(result.current.error?.code).toBe("ADMIN_UNKNOWN_ERROR");
  });

  it("toggleRole altera role e recarrega dados", async () => {
    const perfilAdmin = { id: usuarioId, role: "admin" };

    (adminService.getPerfilAdmin as any).mockResolvedValue(perfilAdmin);
    (adminService.getUsuariosAdmin as any).mockResolvedValue([]);
    (adminService.getEstatisticasAdmin as any).mockResolvedValue(null);
    (adminService.toggleRoleUsuario as any).mockResolvedValue(undefined);

    const { result } = renderHook(() => useAdmin(usuarioId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.toggleRole("1", "user");
    });

    expect(adminService.toggleRoleUsuario).toHaveBeenCalledWith("1", "admin");
  });

  it("importarReferencias apenas delega ao service", async () => {
    const resultado = { sucesso: 10, erros: 0 };

    (adminService.importarReferenciasCSV as any).mockResolvedValue(resultado);

    const { result } = renderHook(() => useAdmin(usuarioId));

    const response = await act(async () => {
      return result.current.importarReferencias("csv-content");
    });

    expect(adminService.importarReferenciasCSV).toHaveBeenCalledWith("csv-content");
    expect(response).toEqual(resultado);
  });
});
