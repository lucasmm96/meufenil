import { describe, it, expect, vi, beforeEach } from "vitest";
import { logout } from "@/react-app/services/auth.service";
import { AppError } from "@/react-app/lib/errors";

/**
 * Mock do Supabase
 */
vi.mock("@/react-app/lib/supabase", () => ({
  supabase: {
    auth: {
      signOut: vi.fn(),
    },
  },
}));

import { supabase } from "@/react-app/lib/supabase";

describe("logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("encerra a sessão com sucesso", async () => {
    (supabase.auth.signOut as any).mockResolvedValue({ error: null });

    await expect(logout()).resolves.toBeUndefined();

    expect(supabase.auth.signOut).toHaveBeenCalledOnce();
  });

  it("lança AppError quando o logout falhar", async () => {
    const error = new Error("Erro Supabase");

    (supabase.auth.signOut as any).mockResolvedValue({ error });

    await expect(logout()).rejects.toBeInstanceOf(AppError);

    await expect(logout()).rejects.toMatchObject({
      code: "AUTH_LOGOUT_ERROR",
    });
  });
});
