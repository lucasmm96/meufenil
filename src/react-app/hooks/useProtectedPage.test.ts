import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useProtectedPage } from "./useProtectedPage";
import { useAuth } from "@/react-app/context/AuthContext";
import { useNavigate } from "react-router-dom";

/**
 * Mocks
 */
vi.mock("@/react-app/context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );

  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

const mockedUseAuth = useAuth as unknown as ReturnType<typeof vi.fn>;
const mockedUseNavigate = useNavigate as unknown as ReturnType<typeof vi.fn>;

describe("useProtectedPage", () => {
  const navigateMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseNavigate.mockReturnValue(navigateMock);
  });

  it("retorna isReady=false enquanto loadingAuth=true", () => {
    mockedUseAuth.mockReturnValue({
      authUser: null,
      loadingAuth: true,
    });

    const { result } = renderHook(() => useProtectedPage());

    expect(result.current.isReady).toBe(false);
    expect(result.current.authUser).toBeNull();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("redireciona para '/' quando não está autenticado", () => {
    mockedUseAuth.mockReturnValue({
      authUser: null,
      loadingAuth: false,
    });

    const { result } = renderHook(() => useProtectedPage());

    expect(result.current.isReady).toBe(false);
    expect(result.current.authUser).toBeNull();
    expect(navigateMock).toHaveBeenCalledWith("/", { replace: true });
  });

  it("permite acesso quando o usuário está autenticado", () => {
    const fakeUser = {
      id: "user-1",
      email: "teste@email.com",
    };

    mockedUseAuth.mockReturnValue({
      authUser: fakeUser,
      loadingAuth: false,
    });

    const { result } = renderHook(() => useProtectedPage());

    expect(result.current.isReady).toBe(true);
    expect(result.current.authUser).toEqual(fakeUser);
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
