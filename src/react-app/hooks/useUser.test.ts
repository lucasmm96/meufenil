import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useUser } from "./useUser";
import { supabase } from "@/react-app/lib/supabase";

/**
 * Mock do Supabase
 */
vi.mock("@/react-app/lib/supabase", () => {
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  return {
    supabase: {
      from,
      auth: {
        signInWithOAuth: vi.fn(),
      },
    },
  };
});

describe("useUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não carrega usuário se userId não for informado", async () => {
    const { result } = renderHook(() => useUser());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("carrega usuário com sucesso", async () => {
    const fakeUser = {
      id: "user-1",
      role: "user",
      email: "teste@email.com",
    };

    const maybeSingleMock =
      supabase.from("usuarios").select("id, role, email").eq("id", "user-1")
        .maybeSingle as unknown as ReturnType<typeof vi.fn>;

    maybeSingleMock.mockResolvedValue({
      data: fakeUser,
      error: null,
    });

    const { result } = renderHook(() => useUser("user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual(fakeUser);
  });

  it("define user como null quando ocorre erro", async () => {
    const maybeSingleMock =
      supabase.from("usuarios").select("id, role, email").eq("id", "user-1")
        .maybeSingle as unknown as ReturnType<typeof vi.fn>;

    maybeSingleMock.mockResolvedValue({
      data: null,
      error: new Error("Erro Supabase"),
    });

    const { result } = renderHook(() => useUser("user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
  });

  it("signInWithGoogle chama o supabase corretamente", async () => {
    const signInMock =
      supabase.auth.signInWithOAuth as unknown as ReturnType<typeof vi.fn>;

    signInMock.mockResolvedValue({});

    const { result } = renderHook(() => useUser());

    await act(async () => {
      await result.current.signInWithGoogle();
    });

    expect(signInMock).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
  });
});
