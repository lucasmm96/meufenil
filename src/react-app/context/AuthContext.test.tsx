import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { AuthProvider, useAuth } from "./AuthContext";

vi.mock("@/react-app/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

vi.mock("@/react-app/services/offlineStorage.service", () => ({
  clearUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/react-app/services/delegacoesAcesso.service", () => ({
  listarDelegacoes: vi.fn().mockResolvedValue({ concedidos: [], recebidos: [] }),
  concederAcesso: vi.fn(),
  revogarAcesso: vi.fn(),
  assumirPerfil: vi.fn(),
  sairDoPerfilAssumido: vi.fn(),
}));

import { supabase } from "@/react-app/lib/supabase";

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(AuthProvider, null, children);

describe("AuthContext — C1 (ENH-0015)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolve authUser quando getSession retorna sessão válida antes de 5s", async () => {
    const fakeUser = { id: "user-1", email: "u@test.com" };
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: fakeUser } as never },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.loadingAuth).toBe(true);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.loadingAuth).toBe(false);
    expect(result.current.authUser?.id).toBe("user-1");
  });

  it("setLoadingAuth(false) chamado e authUser=null quando getSession lança erro", async () => {
    vi.mocked(supabase.auth.getSession).mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.loadingAuth).toBe(false);
    expect(result.current.authUser).toBeNull();
  });

  it(
    "setLoadingAuth(false) e authUser=null quando getSession não resolve em 5s (timeout)",
    { timeout: 15000 },
    async () => {
      vi.mocked(supabase.auth.getSession).mockImplementation(
        () => new Promise(() => {}) // never resolves
      );

      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(result.current.loadingAuth).toBe(true);

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.loadingAuth).toBe(false);
      expect(result.current.authUser).toBeNull();
    }
  );

  it(
    "loadingTooLong fica true após 3s de loading e false quando auth resolve",
    { timeout: 15000 },
    async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let resolveSession!: (v: any) => void;
      vi.mocked(supabase.auth.getSession).mockImplementation(
        () => new Promise((resolve) => { resolveSession = resolve; })
      );

      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(result.current.loadingTooLong).toBe(false);

      // avança 3s+ para disparar o longLoadTimer
      await act(async () => {
        vi.advanceTimersByTime(3001);
      });
      expect(result.current.loadingTooLong).toBe(true);

      // resolve a sessão — initAuth finaliza, loadingTooLong volta a false
      await act(async () => {
        resolveSession({ data: { session: null }, error: null });
        // avança timers restantes para limpar o Promise.race 5s timer
        vi.advanceTimersByTime(2000);
      });
      expect(result.current.loadingTooLong).toBe(false);
      expect(result.current.loadingAuth).toBe(false);
    }
  );

  it("loadingTooLong nunca fica true quando auth resolve antes de 3s", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.loadingTooLong).toBe(false);
    expect(result.current.loadingAuth).toBe(false);
  });
});
