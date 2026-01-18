import { renderHook, act, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { useDashboard } from "./useDashboard";
import { AppError } from "@/react-app/lib/errors";

vi.mock("@/react-app/services/dashboard.service", () => ({
  getDashboardData: vi.fn(),
}));

import * as dashboardService from "@/react-app/services/dashboard.service";

describe("useDashboard hook", () => {
  const userId = "123";

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deve carregar os dados corretamente", async () => {
    const mockData = {
      usuario: { id: userId, limite_diario_mg: 500, consentimento_lgpd_em: null, timezone: "America/Sao_Paulo" },
      hoje: { total: 200, limite: 500, data: "2026-01-17" },
      grafico: [{ data: "2026-01-16", total: 100 }],
    };

    const getDashboardDataMock = dashboardService.getDashboardData as unknown as ReturnType<typeof vi.fn>;
    getDashboardDataMock.mockResolvedValue(mockData);

    const { result } = renderHook(() => useDashboard(userId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual(mockData);
  });

  it("deve setar erro quando getDashboardData falhar", async () => {
    const error = new AppError("DASHBOARD_USER_ERROR", "Erro teste");

    const getDashboardDataMock = dashboardService.getDashboardData as unknown as ReturnType<typeof vi.fn>;
    getDashboardDataMock.mockRejectedValue(error);

    const { result } = renderHook(() => useDashboard(userId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toEqual(error);
  });

  it("não deve chamar getDashboardData se userId não for fornecido", async () => {
    const getDashboardDataMock = dashboardService.getDashboardData as unknown as ReturnType<typeof vi.fn>;
    getDashboardDataMock.mockClear(); // limpa chamadas anteriores

    const { result } = renderHook(() => useDashboard());

    expect(getDashboardDataMock).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it("reload deve refazer a chamada ao serviço", async () => {
    const mockData = {
      usuario: { id: userId, limite_diario_mg: 500, consentimento_lgpd_em: null, timezone: "America/Sao_Paulo" },
      hoje: { total: 200, limite: 500, data: "2026-01-17" },
      grafico: [{ data: "2026-01-16", total: 100 }],
    };

    const spy = vi.spyOn(dashboardService, "getDashboardData") as unknown as ReturnType<typeof vi.fn>;
    spy.mockResolvedValue(mockData);

    const { result } = renderHook(() => useDashboard(userId));

    await waitFor(() => expect(result.current.loading).toBe(false));

    spy.mockClear();

    await act(async () => {
      await result.current.reload();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual(mockData);
  });
});
