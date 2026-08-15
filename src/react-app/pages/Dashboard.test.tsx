import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "./Dashboard";

vi.mock("@/react-app/components/Layout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@skeletons", () => ({
  LayoutSkeleton: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DashboardSkeleton: () => <div data-testid="dashboard-skeleton" />,
}));

vi.mock("@/react-app/context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/react-app/hooks/useDashboard", () => ({
  useDashboard: vi.fn(),
}));

vi.mock("@/react-app/hooks/useReferencias", () => ({
  useReferencias: vi.fn(),
}));

vi.mock("@/react-app/services/dashboard.service", () => ({
  updateConsentimentoLGPD: vi.fn(),
}));

// stubs dos componentes filhos (testados nas próprias suítes)
vi.mock("@/react-app/components/ConsentimentoLGPD", () => ({
  default: ({ onAccept }: { onAccept: () => void }) => (
    <button onClick={onAccept}>Consentir LGPD</button>
  ),
}));

vi.mock("@/react-app/components/AdicionarRegistro", () => ({
  default: ({
    onClose,
    onSuccess,
  }: {
    onClose: () => void;
    onSuccess: () => void;
  }) => (
    <div>
      <button onClick={onClose}>FecharRegistro</button>
      <button onClick={onSuccess}>RegistroSalvo</button>
    </div>
  ),
}));

// recharts não renderiza em jsdom — stub preservando os props para assertions
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  LineChart: vi.fn(({ children }: { children: ReactNode }) => (
    <svg>{children}</svg>
  )),
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
}));

import { useAuth } from "@/react-app/context/AuthContext";
import { useDashboard } from "@/react-app/hooks/useDashboard";
import { useReferencias } from "@/react-app/hooks/useReferencias";
import { updateConsentimentoLGPD } from "@/react-app/services/dashboard.service";
import { LineChart } from "recharts";

const mockDashboardData = {
  usuario: {
    id: "user-1",
    limite_diario_mg: 500,
    consentimento_lgpd_em: "2026-01-01",
    timezone: "America/Sao_Paulo",
  },
  hoje: { total: 200, limite: 500, data: "2026-01-17" },
  grafico: [{ data: "2026-01-16", total: 100 }],
};

describe("Dashboard page", () => {
  const useAuthMock = useAuth as unknown as ReturnType<typeof vi.fn>;
  const useDashboardMock = useDashboard as unknown as ReturnType<typeof vi.fn>;
  const useReferenciasMock = useReferencias as unknown as ReturnType<typeof vi.fn>;
  const updateConsentimentoMock = updateConsentimentoLGPD as unknown as ReturnType<typeof vi.fn>;

  function setupAuth(overrides: Record<string, unknown> = {}) {
    useAuthMock.mockReturnValue({
      ready: true,
      usuarioAtivoId: "user-1",
      ...overrides,
    });
  }

  function setupDashboard(overrides: Record<string, unknown> = {}) {
    const state = {
      data: mockDashboardData,
      loading: false,
      reload: vi.fn(),
      ...overrides,
    };
    useDashboardMock.mockReturnValue(state);
    return state;
  }

  function setupReferencias(overrides: Record<string, unknown> = {}) {
    const state = { create: vi.fn(), ...overrides };
    useReferenciasMock.mockReturnValue(state);
    return state;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setupAuth();
    setupDashboard();
    setupReferencias();
  });

  it("mostra skeleton enquanto o auth não está pronto", () => {
    setupAuth({ ready: false });
    render(<Dashboard />);

    expect(screen.getByTestId("dashboard-skeleton")).toBeTruthy();
  });

  it("mostra skeleton enquanto os dados carregam", () => {
    setupDashboard({ loading: true });
    render(<Dashboard />);

    expect(screen.getByTestId("dashboard-skeleton")).toBeTruthy();
  });

  it("mantém o skeleton quando não há dados (erro sem UI)", () => {
    setupDashboard({ data: null, loading: false });
    render(<Dashboard />);

    expect(screen.getByTestId("dashboard-skeleton")).toBeTruthy();
  });

  it("renderiza os cards de hoje, percentual e restante", () => {
    render(<Dashboard />);

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeTruthy();
    expect(screen.getByText("200.0 mg")).toBeTruthy();
    expect(screen.getByText("de 500 mg")).toBeTruthy();
    expect(screen.getByText("40.0%")).toBeTruthy();
    expect(screen.getByText("300.0 mg")).toBeTruthy();
    expect(screen.getByText("disponível hoje")).toBeTruthy();
    expect(screen.getByText("Últimos 7 dias")).toBeTruthy();
  });

  it("mostra alerta de limite ultrapassado e restante zerado", () => {
    setupDashboard({
      data: {
        ...mockDashboardData,
        hoje: { total: 600, limite: 500, data: "2026-01-17" },
      },
    });
    render(<Dashboard />);

    expect(screen.getByText("120.0%")).toBeTruthy();
    expect(screen.getByText("Limite ultrapassado")).toBeTruthy();
    expect(
      screen.getByText(/Você ultrapassou seu limite diário de fenilalanina em 100.0 mg/i)
    ).toBeTruthy();
    expect(screen.getByText("0.0 mg")).toBeTruthy();
  });

  it("não mostra alerta quando o consumo está dentro do limite", () => {
    render(<Dashboard />);

    expect(screen.queryByText("Limite ultrapassado")).toBeNull();
  });

  it("passa os dados do gráfico para o LineChart", () => {
    render(<Dashboard />);

    const props = vi.mocked(LineChart).mock.calls[0][0] as { data: unknown };
    expect(props.data).toEqual(mockDashboardData.grafico);
  });

  it("aceita o consentimento LGPD e recarrega os dados", async () => {
    const { reload } = setupDashboard({
      data: {
        ...mockDashboardData,
        usuario: { ...mockDashboardData.usuario, consentimento_lgpd_em: null },
      },
    });
    render(<Dashboard />);

    expect(screen.getByRole("button", { name: "Consentir LGPD" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Consentir LGPD" }));

    await waitFor(() => {
      expect(updateConsentimentoMock).toHaveBeenCalledWith("user-1");
      expect(reload).toHaveBeenCalled();
    });
  });

  it("não renderiza o consentimento quando já aceito", () => {
    render(<Dashboard />);

    expect(screen.queryByRole("button", { name: "Consentir LGPD" })).toBeNull();
  });

  it("abre o modal de registro e recarrega ao concluir", () => {
    const { reload } = setupDashboard();
    render(<Dashboard />);

    fireEvent.click(screen.getByRole("button", { name: "Adicionar Registro" }));
    expect(screen.getByRole("button", { name: "RegistroSalvo" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "RegistroSalvo" }));

    expect(reload).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "RegistroSalvo" })).toBeNull();
  });

  it("fecha o modal de registro pelo onClose", () => {
    render(<Dashboard />);

    fireEvent.click(screen.getByRole("button", { name: "Adicionar Registro" }));
    fireEvent.click(screen.getByRole("button", { name: "FecharRegistro" }));

    expect(screen.queryByRole("button", { name: "FecharRegistro" })).toBeNull();
  });

  it("cria uma referência pela modal e recarrega", async () => {
    const { create } = setupReferencias();
    const { reload } = setupDashboard();
    render(<Dashboard />);

    fireEvent.click(screen.getByRole("button", { name: "Criar Alimento" }));
    expect(screen.getByText("Nova Referência")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Ex: Maçã Fuji"), {
      target: { value: "Maçã" },
    });
    fireEvent.change(screen.getByPlaceholderText("Ex: 25.50"), {
      target: { value: "30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith("Maçã", 30);
      expect(reload).toHaveBeenCalled();
      expect(screen.queryByText("Nova Referência")).toBeNull();
    });
  });
});
