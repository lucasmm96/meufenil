import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Admin from "./Admin";

vi.mock("@/react-app/components/Layout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@skeletons", () => ({
  LayoutSkeleton: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AdminSkeleton: () => <div data-testid="admin-skeleton" />,
}));

vi.mock("@/react-app/context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/react-app/hooks/useAdmin", () => ({
  useAdmin: vi.fn(),
}));

vi.mock("@/react-app/hooks/useBackgroundJobsAdmin", () => ({
  useBackgroundJobsAdmin: vi.fn(),
}));

vi.mock("@/react-app/lib/app-environment", () => ({
  CURRENT_APP_ENVIRONMENT: "dev",
}));

import { useAuth } from "@/react-app/context/AuthContext";
import { useAdmin } from "@/react-app/hooks/useAdmin";
import { useBackgroundJobsAdmin } from "@/react-app/hooks/useBackgroundJobsAdmin";

describe("Admin page", () => {
  const useAuthMock = useAuth as unknown as ReturnType<typeof vi.fn>;
  const useAdminMock = useAdmin as unknown as ReturnType<typeof vi.fn>;
  const useBackgroundJobsAdminMock = useBackgroundJobsAdmin as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mostra loading enquanto os dados carregam", () => {
    useAuthMock.mockReturnValue({ authUser: { id: "user-1" } });
    useAdminMock.mockReturnValue({
      perfilUsuario: null,
      usuarios: [],
      estatisticasDB: null,
      loading: true,
    });
    useBackgroundJobsAdminMock.mockReturnValue({ loading: true, overview: [], executions: [] });

    render(<Admin />);

    expect(screen.getByTestId("admin-skeleton")).toBeTruthy();
  });

  it("bloqueia acesso para usuário não admin", () => {
    useAuthMock.mockReturnValue({ authUser: { id: "user-1" } });
    useAdminMock.mockReturnValue({
      perfilUsuario: { id: "user-1", role: "user" },
      usuarios: [],
      estatisticasDB: null,
      loading: false,
    });
    useBackgroundJobsAdminMock.mockReturnValue({ loading: false, overview: [], executions: [] });

    render(<Admin />);

    expect(screen.getByText("Acesso Negado")).toBeTruthy();
    expect(screen.getByText(/você não tem permissão/i)).toBeTruthy();
  });

  it("renderiza o monitoramento do ambiente atual com dados", async () => {
    useAuthMock.mockReturnValue({ authUser: { id: "admin-1" } });
    useAdminMock.mockReturnValue({
      perfilUsuario: { id: "admin-1", role: "admin" },
      usuarios: [
        { id: "1", role: "admin" },
        { id: "2", role: "user" },
      ],
      estatisticasDB: null,
      loading: false,
    });
    useBackgroundJobsAdminMock.mockReturnValue({
      loading: false,
      error: null,
      overview: [
        {
          job_key: "keepalive",
          environment: "dev",
          total_count: 1,
          success_count: 1,
          failure_count: 0,
          partial_count: 0,
          last_status: "success",
          last_started_at: "2026-08-10T12:00:00.000Z",
          last_finished_at: "2026-08-10T12:00:01.000Z",
          last_duration_ms: 1000,
          last_message: "ok",
          last_details: { target: "meufenil-dev" },
          last_run_id: "run-1",
          last_created_at: "2026-08-10T12:00:01.500Z",
        },
      ],
      executions: [
        {
          id: "1",
          run_id: "run-1",
          job_key: "keepalive",
          environment: "dev",
          status: "success",
          started_at: "2026-08-10T12:00:00.000Z",
          finished_at: "2026-08-10T12:00:01.000Z",
          duration_ms: 1000,
          message: "ok",
          details: { target: "meufenil-dev" },
          created_at: "2026-08-10T12:00:01.500Z",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      filters: {
        jobKey: "keepalive",
        status: "all",
        periodDays: 30,
      },
      setFilters: vi.fn(),
      setPage: vi.fn(),
      reload: vi.fn(),
    });

    render(<Admin />);

    expect(screen.getByText("Painel Administrativo")).toBeTruthy();
    expect(screen.getByText("Ambiente atual: DEV")).toBeTruthy();
    expect(screen.getByText("Monitoramento de Jobs")).toBeTruthy();
    expect(screen.getAllByText("keepalive").length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(screen.getByText("Detalhes da execução")).toBeTruthy();
    });
  });
});
