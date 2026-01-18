import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useLogout } from "./useLogout";
import { logout } from "@/react-app/services/auth.service";
import { AppError } from "@/react-app/lib/errors";
import { logger } from "@/react-app/lib/logger";

// 🔹 mock do navigate
const navigateMock = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

// 🔹 mock do service
vi.mock("@/react-app/services/auth.service", () => ({
  logout: vi.fn(),
}));

// 🔹 mock do logger
vi.mock("@/react-app/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("useLogout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve realizar logout e navegar para /", async () => {
    vi.mocked(logout).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useLogout());

    await act(async () => {
      await result.current.handleLogout();
    });

    expect(logout).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith("/", { replace: true });
  });

  it("deve navegar mesmo se logout lançar AppError", async () => {
    const error = new AppError(
      "AUTH_LOGOUT_ERROR",
      "Erro ao sair",
    );

    vi.mocked(logout).mockRejectedValueOnce(error);

    const { result } = renderHook(() => useLogout());

    await act(async () => {
      await result.current.handleLogout();
    });

    expect(logger.error).toHaveBeenCalledWith("Erro no logout", error);
    expect(navigateMock).toHaveBeenCalledWith("/", { replace: true });
  });

  it("deve transformar erro desconhecido em AppError e navegar", async () => {
    const unknownError = new Error("Falha inesperada");

    vi.mocked(logout).mockRejectedValueOnce(unknownError);

    const { result } = renderHook(() => useLogout());

    await act(async () => {
      await result.current.handleLogout();
    });

    expect(logger.error).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith("/", { replace: true });
  });
});
