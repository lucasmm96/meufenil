import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

vi.mock("@/react-app/hooks/useReferenciasSyncAdmin", () => ({
  useReferenciasSyncAdmin: vi.fn(),
}));

vi.mock("@/react-app/lib/app-environment", () => ({
  CURRENT_APP_ENVIRONMENT: "dev",
}));

import { useAuth } from "@/react-app/context/AuthContext";
import { useAdmin } from "@/react-app/hooks/useAdmin";
import { useBackgroundJobsAdmin } from "@/react-app/hooks/useBackgroundJobsAdmin";
import { useReferenciasSyncAdmin } from "@/react-app/hooks/useReferenciasSyncAdmin";

const useAuthMock = useAuth as unknown as ReturnType<typeof vi.fn>;
const useAdminMock = useAdmin as unknown as ReturnType<typeof vi.fn>;
const useBackgroundJobsAdminMock = useBackgroundJobsAdmin as unknown as ReturnType<typeof vi.fn>;
const useReferenciasSyncAdminMock = useReferenciasSyncAdmin as unknown as ReturnType<typeof vi.fn>;

/** Shape do useReferenciasSyncAdmin para os mocks de página. */
function dominioMock(overrides: Record<string, unknown> = {}) {
  return {
    items: [],
    total: 0,
    page: 1,
    pageSize: 3,
    totalPages: 1,
    loading: false,
    error: null,
    ...overrides,
  };
}

function syncAdminMock(overrides: Record<string, unknown> = {}) {
  return {
    matchingValidado: null,
    podeRecuperar: false,
    syncRunning: null,
    recuperacaoLoading: false,
    executandoSync: false,
    reload: vi.fn(),
    resetaTrilhas: vi.fn(),
    syncs: dominioMock(),
    syncsStatus: "all",
    setSyncsStatus: vi.fn(),
    setSyncsPage: vi.fn(),
    setSyncsPageSize: vi.fn(),
    pendencias: dominioMock(),
    pendenciasStatus: "open",
    pendenciasSyncId: null,
    setPendenciasStatus: vi.fn(),
    setPendenciasSyncId: vi.fn(),
    setPendenciasPage: vi.fn(),
    setPendenciasPageSize: vi.fn(),
    eventos: dominioMock(),
    eventosTipo: "all",
    eventosSyncId: null,
    eventosTermo: "",
    setEventosTipo: vi.fn(),
    setEventosSyncId: vi.fn(),
    setEventosTermo: vi.fn(),
    setEventosPage: vi.fn(),
    setEventosPageSize: vi.fn(),
    backups: { items: [], loading: false, error: null },
    syncsRevertiveis: { items: [], loading: false, error: null },
    historicoPendencia: vi.fn(),
    decidirPendencia: vi.fn(),
    reverterSync: vi.fn(),
    restaurarBackup: vi.fn(),
    executarSync: vi.fn(),
    ...overrides,
  };
}

function jobsAdminMock(overrides: Record<string, unknown> = {}) {
  return {
    loading: false,
    error: null,
    overview: [],
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
    pageSize: 3,
    totalPages: 1,
    filters: {
      jobKey: "keepalive",
      status: "all",
      periodDays: 30,
    },
    setFilters: vi.fn(),
    setPage: vi.fn(),
    setPageSize: vi.fn(),
    reload: vi.fn(),
    ...overrides,
  };
}

/** Monta os mocks da página como admin e devolve o mock do hook de sync. */
function renderAdminComoAdmin(overrides: Record<string, unknown> = {}) {
  useAuthMock.mockReturnValue({ authUser: { id: "admin-1" } });
  useAdminMock.mockReturnValue({
    perfilUsuario: { id: "admin-1", role: "admin" },
    usuarios: [],
    estatisticasDB: null,
    loading: false,
  });
  useBackgroundJobsAdminMock.mockReturnValue(jobsAdminMock());
  const syncMock = syncAdminMock(overrides);
  useReferenciasSyncAdminMock.mockReturnValue(syncMock);
  return syncMock as {
    decidirPendencia: ReturnType<typeof vi.fn>;
    reverterSync: ReturnType<typeof vi.fn>;
    restaurarBackup: ReturnType<typeof vi.fn>;
    setPendenciasSyncId: ReturnType<typeof vi.fn>;
    [chave: string]: unknown;
  };
}

describe("Admin page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useReferenciasSyncAdminMock.mockReturnValue(syncAdminMock());
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
      pageSize: 3,
      totalPages: 1,
      filters: {
        jobKey: "keepalive",
        status: "all",
        periodDays: 30,
      },
      setFilters: vi.fn(),
      setPage: vi.fn(),
      setPageSize: vi.fn(),
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

    expect(screen.getByText("1 execução encontrada.")).toBeTruthy();
    expect(screen.getByText("Página 1 de 1")).toBeTruthy();
    expect(screen.getByText("Ver mensagem")).toBeTruthy();
  });

  it("pluraliza o contador de execuções para quantidades maiores que 1", () => {
    useAuthMock.mockReturnValue({ authUser: { id: "admin-1" } });
    useAdminMock.mockReturnValue({
      perfilUsuario: { id: "admin-1", role: "admin" },
      usuarios: [],
      estatisticasDB: null,
      loading: false,
    });
    useBackgroundJobsAdminMock.mockReturnValue(
      jobsAdminMock({
        total: 11,
        totalPages: 4,
      }),
    );

    render(<Admin />);

    expect(screen.getByText("11 execuções encontradas.")).toBeTruthy();
    expect(screen.getByText("Página 1 de 4")).toBeTruthy();
  });

  it("troca o tamanho de página pelo seletor", () => {
    useAuthMock.mockReturnValue({ authUser: { id: "admin-1" } });
    useAdminMock.mockReturnValue({
      perfilUsuario: { id: "admin-1", role: "admin" },
      usuarios: [],
      estatisticasDB: null,
      loading: false,
    });
    const setPageSizeMock = vi.fn();
    useBackgroundJobsAdminMock.mockReturnValue(jobsAdminMock({ setPageSize: setPageSizeMock }));

    render(<Admin />);

    fireEvent.change(screen.getByLabelText("Item por página"), { target: { value: "10" } });

    expect(setPageSizeMock).toHaveBeenCalledWith(10);
  });

  it("abre e fecha o modal de mensagem da execução", () => {
    useAuthMock.mockReturnValue({ authUser: { id: "admin-1" } });
    useAdminMock.mockReturnValue({
      perfilUsuario: { id: "admin-1", role: "admin" },
      usuarios: [],
      estatisticasDB: null,
      loading: false,
    });
    useBackgroundJobsAdminMock.mockReturnValue(jobsAdminMock());

    render(<Admin />);

    expect(screen.queryByText("Mensagem da execução")).toBeNull();

    fireEvent.click(screen.getByText("Ver mensagem"));

    expect(screen.getByText("Mensagem da execução")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Fechar"));

    expect(screen.queryByText("Mensagem da execução")).toBeNull();
  });

  // ---------------------------------------------------------------
  // Seção "Sincronização de Referências" (FEAT-0017 M6)
  // ---------------------------------------------------------------

  const syncFixture = {
    id: "sync-1",
    environment: "dev",
    trigger_source: "cron",
    requested_by: null,
    bootstrap: true,
    status: "pending_review",
    started_at: "2026-09-01T10:00:00.000Z",
    finished_at: "2026-09-01T10:00:30.000Z",
    total_origem: 10,
    equivalentes: 8,
    criadas: 1,
    arquivadas: 0,
    divergencias: 1,
    message: "1 divergência aguardando curadoria.",
    details: { validacao: { ok: true } },
    alteracoes: [
      {
        op: "create",
        referencia_id: "ref-1",
        antes: null,
        depois: { nome: "Novo", marca: "", fenil_mg_por_100g: 40 },
      },
    ],
    created_at: "2026-09-01T10:00:00.000Z",
  };

  const pendenciaFixture = {
    id: "pend-1",
    sync_id: "sync-1",
    tipo: "substitution",
    referencia_id: "ref-1",
    proposta: { nome: "Novo", marca: "", fenil_mg_por_100g: 40 },
    diff: [{ campo: "fenil_mg_por_100g", antes: 55, depois: 40 }],
    status: "open",
    motivo: null,
    created_at: "2026-09-01T10:00:00.000Z",
    decided_at: null,
    decided_by: null,
    sync: { started_at: "2026-09-01T10:00:00.000Z", status: "pending_review" },
    referencia: { nome: "Atual", marca: "", fenil_mg_por_100g: 55 },
  };

  it("renderiza a seção de sincronização com matching validado e botão manual em dev", () => {
    renderAdminComoAdmin({ matchingValidado: true });

    render(<Admin />);

    expect(screen.getByText("Sincronização de Referências")).toBeTruthy();
    expect(screen.getByText("Matching validado")).toBeTruthy();
    expect(screen.getByText("Histórico")).toBeTruthy();
    expect(screen.getByText("Pendências de curadoria")).toBeTruthy();
    expect(screen.getByText("Auditoria")).toBeTruthy();
    // Revisão R4-1 (decisão 2026-09-08): botão manual disponível em dev E prod
    expect(screen.getByText("Executar sync agora")).toBeTruthy();
  });

  it("aguarda bootstrap quando ainda não há sync validada", () => {
    renderAdminComoAdmin({ matchingValidado: false });

    render(<Admin />);

    expect(screen.getByText("Aguardando bootstrap")).toBeTruthy();
  });

  it("só mostra a aba de recuperação para quem tem permissão", () => {
    renderAdminComoAdmin({ podeRecuperar: false });
    const { unmount } = render(<Admin />);
    expect(screen.queryByText("Recuperação")).toBeNull();
    unmount();

    renderAdminComoAdmin({ podeRecuperar: true });
    render(<Admin />);
    expect(screen.getByText("Recuperação")).toBeTruthy();
  });

  it("lista syncs no histórico e mostra os detalhes da linha selecionada", () => {
    renderAdminComoAdmin({
      syncs: dominioMock({ items: [syncFixture], total: 1 }),
    });

    render(<Admin />);

    expect(screen.getByText("Detalhes da sincronização")).toBeTruthy();
    // Badges existem na tabela desktop e nos cards mobile (md:hidden fica no DOM)
    expect(screen.getAllByText("1ª sync").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Em revisão").length).toBeGreaterThan(0);
    // Linha "Alterações aplicadas" com a operação registrada
    expect(screen.getByText(/1 operação/)).toBeTruthy();
  });

  it("link de divergências do histórico abre a trilha na aba de pendências", () => {
    const syncMock = renderAdminComoAdmin({
      syncs: dominioMock({ items: [syncFixture], total: 1 }),
    });

    render(<Admin />);

    fireEvent.click(screen.getByText("1 divergência"));

    expect(syncMock.setPendenciasSyncId).toHaveBeenCalledWith("sync-1");
    expect(screen.getByText("Nenhuma pendência encontrada")).toBeTruthy();
  });

  it("abre o modal de rejeição e exige motivo antes de confirmar", async () => {
    const syncMock = renderAdminComoAdmin({
      pendencias: dominioMock({ items: [pendenciaFixture], total: 1 }),
    });
    syncMock.decidirPendencia.mockResolvedValue({
      pendencia_id: "pend-1",
      status: "rejected",
      sync_id: "sync-1",
      sync_status: "pending_review",
    });

    render(<Admin />);

    fireEvent.click(screen.getByText("Pendências de curadoria"));
    expect(screen.getByText("Substituição")).toBeTruthy();
    // 55.00 aparece na referência atual e na linha removida do diff
    expect(screen.getAllByText(/55\.00 mg\/100g/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("Rejeitar"));

    expect(screen.getByText("Rejeitar mudança")).toBeTruthy();
    const confirmar = screen.getByText("Confirmar rejeição") as HTMLButtonElement;
    expect(confirmar.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Motivo da rejeição"), {
      target: { value: "Proposta desatualizada." },
    });
    expect(confirmar.disabled).toBe(false);

    fireEvent.click(confirmar);

    await waitFor(() => {
      expect(syncMock.decidirPendencia).toHaveBeenCalledWith("pend-1", false, "Proposta desatualizada.");
    });
    await waitFor(() => {
      expect(screen.queryByText("Rejeitar mudança")).toBeNull();
    });
  });

  it("aprovação chama a decisão sem motivo", async () => {
    const syncMock = renderAdminComoAdmin({
      pendencias: dominioMock({ items: [pendenciaFixture], total: 1 }),
    });
    syncMock.decidirPendencia.mockResolvedValue({
      pendencia_id: "pend-1",
      status: "approved",
      sync_id: "sync-1",
      sync_status: "success",
    });

    render(<Admin />);

    fireEvent.click(screen.getByText("Pendências de curadoria"));
    fireEvent.click(screen.getByText("Aprovar"));
    fireEvent.click(screen.getByText("Confirmar aprovação"));

    await waitFor(() => {
      expect(syncMock.decidirPendencia).toHaveBeenCalledWith("pend-1", true, undefined);
    });
  });

  it("recuperação exige confirmação forte (REVERTER) antes de chamar a RPC", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue(null);
    const syncMock = renderAdminComoAdmin({
      podeRecuperar: true,
      syncsRevertiveis: { items: [syncFixture], loading: false, error: null },
      backups: { items: [], loading: false, error: null },
    });

    render(<Admin />);

    fireEvent.click(screen.getByText("Recuperação"));
    expect(screen.getByText(/Rollback seletivo/)).toBeTruthy();

    fireEvent.click(screen.getByText("Reverter sync"));
    expect(confirmSpy).toHaveBeenCalled();

    // Prompt cancelado: nenhuma chamada à RPC
    expect(syncMock.reverterSync).not.toHaveBeenCalled();

    // Confirmação digitada: a RPC roda e o resultado aparece inline
    promptSpy.mockReturnValue("REVERTER");
    syncMock.reverterSync.mockResolvedValue({
      sync_id: "sync-1",
      status: "reverted",
      revertida: true,
      revertidas: 2,
      preservadas: 1,
      pendencias_canceladas: 0,
    });

    fireEvent.click(screen.getByText("Reverter sync"));

    await waitFor(() => {
      expect(syncMock.reverterSync).toHaveBeenCalledWith("sync-1");
    });
    await waitFor(() => {
      expect(screen.getByText(/Sincronização revertida: 2 operações desfeitas/)).toBeTruthy();
    });
  });

  it("restauração por backup exige RESTAURAR e mostra o resultado inline", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("RESTAURAR");
    const syncMock = renderAdminComoAdmin({
      podeRecuperar: true,
      syncsRevertiveis: { items: [], loading: false, error: null },
      backups: {
        items: [
          {
            id: "backup-1",
            sync_id: "sync-1",
            payload_sha256: "abcdef0123456789",
            contagem: 3000,
            created_at: "2026-09-01T10:00:00.000Z",
            sync: { started_at: "2026-09-01T10:00:00.000Z" },
          },
        ],
        loading: false,
        error: null,
      },
    });
    // Definido ANTES do clique: o handler chama a RPC no momento do click
    syncMock.restaurarBackup.mockResolvedValue({
      backup_id: "backup-1",
      reativadas: 1,
      criadas: 0,
      arquivadas: 2,
      pendencias_canceladas: 0,
    });

    render(<Admin />);

    fireEvent.click(screen.getByText("Recuperação"));
    expect(screen.getByText(/3000 linhas/)).toBeTruthy();

    fireEvent.click(screen.getByText("Restaurar backup"));
    expect(promptSpy).toHaveBeenCalledWith(expect.stringContaining("RESTAURAR"));

    await waitFor(() => {
      expect(syncMock.restaurarBackup).toHaveBeenCalledWith("backup-1");
    });
    await waitFor(() => {
      expect(screen.getByText(/Backup restaurado: 1 reativadas/)).toBeTruthy();
    });
  });
});
