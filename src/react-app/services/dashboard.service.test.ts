import { describe, it, expect, vi, beforeEach } from "vitest";
import * as dashboardService from "./dashboard.service";
import { supabase } from "@/react-app/lib/supabase";
import { AppError } from "@/react-app/lib/errors";

// Mock do supabase
vi.mock("@/react-app/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe("dashboard.service", () => {
  const userId = "123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve retornar dados corretamente em getDashboardData", async () => {
    const mockUsuario = {
      id: userId,
      limite_diario_mg: 500,
      consentimento_lgpd_em: null,
      timezone: "America/Sao_Paulo",
    };

    const mockRegistrosHoje = [{ fenil_mg: 100 }, { fenil_mg: 50 }];
    const mockRegistrosGrafico = [
      { data: "2026-01-16", fenil_mg: 100 },
      { data: "2026-01-17", fenil_mg: 50 },
    ];

    const fromMock = vi
      .fn()
      // usuários
      .mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({ data: mockUsuario, error: null }),
          }),
        }),
      })
      // registros hoje
      .mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () =>
              Promise.resolve({
                data: mockRegistrosHoje,
                error: null,
              }),
          }),
        }),
      })
      // gráfico
      .mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            gte: () =>
              Promise.resolve({
                data: mockRegistrosGrafico,
                error: null,
              }),
          }),
        }),
      });

    vi.mocked(supabase.from).mockImplementation(fromMock);

    const result = await dashboardService.getDashboardData(userId);

    expect(result.hoje.total).toBe(150);
    expect(result.grafico).toEqual([
      { data: "2026-01-16", total: 100 },
      { data: "2026-01-17", total: 50 },
    ]);
  });

  it("deve lançar AppError se usuário não existir", async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({ data: null, error: {} }),
        }),
      }),
    } as any);

    await expect(
      dashboardService.getDashboardData(userId)
    ).rejects.toBeInstanceOf(AppError);
  });

  it("updateConsentimentoLGPD deve funcionar", async () => {
    const updateMock = vi.fn().mockResolvedValue({ error: null });

    vi.mocked(supabase.from).mockReturnValue({
      update: () => ({
        eq: updateMock,
      }),
    } as any);

    await dashboardService.updateConsentimentoLGPD(userId);

    expect(updateMock).toHaveBeenCalledWith("id", userId);
  });

  it("updateConsentimentoLGPD deve lançar erro se falhar", async () => {
    const updateMock = vi.fn().mockResolvedValue({ error: {} });

    vi.mocked(supabase.from).mockReturnValue({
      update: () => ({
        eq: updateMock,
      }),
    } as any);

    await expect(
      dashboardService.updateConsentimentoLGPD(userId)
    ).rejects.toBeInstanceOf(AppError);
  });
});
