import { renderHook, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/react-app/lib/errors";
import { useReferenciasSyncAdmin } from "./useReferenciasSyncAdmin";
import * as syncService from "@/react-app/services/referencias-sync.service";
import type { PendenciaSyncDTO, ReferenciaSyncDTO, EventoSyncDTO } from "@/react-app/services/dtos/referencias-sync.dto";

vi.mock("@/react-app/services/referencias-sync.service", () => ({
  getDefaultReferenciasSyncPageSize: vi.fn(() => 3),
  getSyncsReferencias: vi.fn(),
  getSyncValidadaAmbiente: vi.fn(),
  getSyncRunningAmbiente: vi.fn(),
  getPermissaoRecuperacao: vi.fn(),
  getPendenciasReferencia: vi.fn(),
  getEventosReferencia: vi.fn(),
  getBackupsReferencia: vi.fn(),
  getSyncsRevertiveis: vi.fn(),
  getHistoricoPendencia: vi.fn(),
  decidirPendenciaReferencia: vi.fn(),
  reverterSyncReferencias: vi.fn(),
  restaurarBackupReferencias: vi.fn(),
  executarSyncManual: vi.fn(),
}));

vi.mock("@/react-app/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

/** Callbacks tipados sem repetir o `as unknown as ReturnType<typeof vi.fn>`. */
function mockDe<T extends (...args: never[]) => unknown>(fn: T): ReturnType<typeof vi.fn> {
  return fn as unknown as ReturnType<typeof vi.fn>;
}

const syncFixture: ReferenciaSyncDTO = {
  id: "sync-1",
  environment: "dev",
  trigger_source: "manual",
  requested_by: "user-1",
  bootstrap: false,
  status: "pending_review",
  started_at: "2026-09-01T10:00:00.000Z",
  finished_at: null,
  total_origem: 10,
  equivalentes: 8,
  criadas: 1,
  arquivadas: 0,
  divergencias: 1,
  message: "1 divergência",
  details: {},
  alteracoes: [],
  created_at: "2026-09-01T10:00:00.000Z",
};

const pendenciaFixture: PendenciaSyncDTO = {
  id: "pend-1",
  sync_id: "sync-1",
  tipo: "substitution",
  referencia_id: "ref-1",
  proposta: null,
  diff: [
    { campo: "nome", antes: "Antigo", depois: "Novo" },
  ],
  status: "open",
  motivo: null,
  created_at: "2026-09-01T10:00:00.000Z",
  decided_at: null,
  decided_by: null,
  sync: { started_at: "2026-09-01T10:00:00.000Z", status: "pending_review" },
  referencia: { nome: "Antigo", marca: "", fenil_mg_por_100g: 40 },
};

const eventoFixture: EventoSyncDTO = {
  id: "ev-1",
  sync_id: "sync-1",
  pendencia_id: "pend-1",
  referencia_id: "ref-1",
  tipo: "mudanca_aprovada",
  actor_id: "user-1",
  detalhes: {},
  created_at: "2026-09-01T10:00:00.000Z",
  sync: { started_at: "2026-09-01T10:00:00.000Z", status: "success" },
  referencia: { nome: "Novo", marca: "" },
};

function pagina(items: unknown[], total: number) {
  return { items, total, page: 1, pageSize: 3 };
}

describe("useReferenciasSyncAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDe(syncService.getSyncsReferencias).mockResolvedValue(pagina([syncFixture], 1));
    mockDe(syncService.getPendenciasReferencia).mockResolvedValue(pagina([pendenciaFixture], 1));
    mockDe(syncService.getEventosReferencia).mockResolvedValue(pagina([eventoFixture], 1));
    mockDe(syncService.getSyncValidadaAmbiente).mockResolvedValue(true);
    mockDe(syncService.getSyncRunningAmbiente).mockResolvedValue(false);
    mockDe(syncService.getPermissaoRecuperacao).mockResolvedValue(false);
    mockDe(syncService.getBackupsReferencia).mockResolvedValue([]);
    mockDe(syncService.getSyncsRevertiveis).mockResolvedValue([]);
  });

  it("não carrega nada quando desabilitado", async () => {
    const { result } = renderHook(() => useReferenciasSyncAdmin("user-1", false));

    expect(syncService.getSyncsReferencias).not.toHaveBeenCalled();
    expect(syncService.getPendenciasReferencia).not.toHaveBeenCalled();
    expect(syncService.getEventosReferencia).not.toHaveBeenCalled();
    expect(syncService.getSyncValidadaAmbiente).not.toHaveBeenCalled();
    expect(result.current.matchingValidado).toBeNull();
    expect(result.current.syncs.items).toEqual([]);
    expect(result.current.pendencias.items).toEqual([]);
    expect(result.current.eventos.items).toEqual([]);
  });

  it("carrega domínios e estado do ambiente ao habilitar", async () => {
    const { result } = renderHook(() => useReferenciasSyncAdmin("user-1", true));

    await waitFor(() => expect(result.current.syncs.loading).toBe(false));
    await waitFor(() => expect(result.current.pendencias.loading).toBe(false));
    await waitFor(() => expect(result.current.eventos.loading).toBe(false));
    await waitFor(() => expect(result.current.recuperacaoLoading).toBe(false));

    expect(result.current.syncs.items).toEqual([syncFixture]);
    expect(result.current.pendencias.items).toEqual([pendenciaFixture]);
    expect(result.current.eventos.items).toEqual([eventoFixture]);
    expect(result.current.matchingValidado).toBe(true);
    expect(result.current.syncRunning).toBe(false);
    expect(result.current.podeRecuperar).toBe(false);
    expect(syncService.getSyncValidadaAmbiente).toHaveBeenCalledWith();
    expect(syncService.getPermissaoRecuperacao).toHaveBeenCalledWith("user-1");
  });

  it("filtro de status de pendências limpa a trilha de sync e volta à página 1", async () => {
    // Total alto o suficiente para a página 2 existir (senão o clamp devolve
    // para a página 1 antes da troca de filtro)
    mockDe(syncService.getPendenciasReferencia).mockResolvedValue(pagina([pendenciaFixture], 10));

    const { result } = renderHook(() => useReferenciasSyncAdmin("user-1", true));

    await waitFor(() => expect(result.current.pendencias.loading).toBe(false));

    await act(async () => {
      result.current.setPendenciasSyncId("sync-1");
    });
    await waitFor(() => expect(result.current.pendenciasSyncId).toBe("sync-1"));

    await act(async () => {
      result.current.setPendenciasPage(2);
    });
    await waitFor(() => expect(result.current.pendencias.page).toBe(2));

    await act(async () => {
      result.current.setPendenciasStatus("rejected");
    });

    expect(result.current.pendenciasStatus).toBe("rejected");
    expect(result.current.pendenciasSyncId).toBeNull();
    expect(result.current.pendencias.page).toBe(1);
    // Refaz a consulta com o novo status e sem sync_id
    await waitFor(() =>
      expect(syncService.getPendenciasReferencia).toHaveBeenLastCalledWith({
        status: "rejected",
        syncId: undefined,
        page: 1,
        pageSize: 3,
      }),
    );
  });

  it("trocar filtro de eventos reseta termo de busca e página", async () => {
    const { result } = renderHook(() => useReferenciasSyncAdmin("user-1", true));

    await waitFor(() => expect(result.current.eventos.loading).toBe(false));

    await act(async () => {
      result.current.setEventosTermo("Leite");
    });
    await waitFor(() => expect(result.current.eventosTermo).toBe("Leite"));

    await act(async () => {
      result.current.setEventosSyncId("sync-1");
    });

    expect(result.current.eventosSyncId).toBe("sync-1");
    expect(result.current.eventosTermo).toBe("");
    expect(result.current.eventos.page).toBe(1);
  });

  it("falha inesperada em um domínio vira AppError sem derrubar os demais", async () => {
    mockDe(syncService.getPendenciasReferencia).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useReferenciasSyncAdmin("user-1", true));

    await waitFor(() => expect(result.current.pendencias.error).toBeInstanceOf(AppError));

    expect(result.current.pendencias.items).toEqual([]);
    expect(result.current.pendencias.total).toBe(0);
    // Domínio irmão segue íntegro
    expect(result.current.syncs.items).toEqual([syncFixture]);
  });

  it("decidir pendência chama a RPC e recarrega os domínios", async () => {
    mockDe(syncService.decidirPendenciaReferencia).mockResolvedValue({
      pendencia_id: "pend-1",
      status: "approved",
      sync_id: "sync-1",
      sync_status: "success",
    });

    const { result } = renderHook(() => useReferenciasSyncAdmin("user-1", true));
    await waitFor(() => expect(result.current.syncs.loading).toBe(false));
    const chamadasAntes = mockDe(syncService.getSyncsReferencias).mock.calls.length;

    await act(async () => {
      await result.current.decidirPendencia("pend-1", true);
    });

    expect(syncService.decidirPendenciaReferencia).toHaveBeenCalledWith("pend-1", true, undefined);
    // reload pós-mutação: nova consulta em cada domínio
    await waitFor(() =>
      expect(mockDe(syncService.getSyncsReferencias).mock.calls.length).toBeGreaterThan(chamadasAntes),
    );
    expect(syncService.getEventosReferencia).toHaveBeenCalled();
  });

  it("executar sync manual chama a rota e liga o indicador durante a execução", async () => {
    let resolveRota!: (v: { sync_id: string; status: string }) => void;
    mockDe(syncService.executarSyncManual).mockReturnValue(
      new Promise((resolve) => {
        resolveRota = resolve;
      }),
    );

    const { result } = renderHook(() => useReferenciasSyncAdmin("user-1", true));
    await waitFor(() => expect(result.current.syncs.loading).toBe(false));

    let promessa!: Promise<{ sync_id: string; status: string }>;
    act(() => {
      promessa = result.current.executarSync();
    });

    await waitFor(() => expect(result.current.executandoSync).toBe(true));

    await act(async () => {
      resolveRota({ sync_id: "sync-2", status: "running" });
      await promessa;
    });

    expect(syncService.executarSyncManual).toHaveBeenCalled();
    expect(result.current.executandoSync).toBe(false);
  });

  it("reverter sync e restaurar backup chamam as RPCs do M5 e recarregam", async () => {
    mockDe(syncService.reverterSyncReferencias).mockResolvedValue({
      sync_id: "sync-1",
      status: "reverted",
      revertidas: 1,
      preservadas: 0,
      pendencias_canceladas: 0,
    });
    mockDe(syncService.restaurarBackupReferencias).mockResolvedValue({
      backup_id: "b-1",
      reativadas: 1,
      criadas: 0,
      arquivadas: 0,
      pendencias_canceladas: 0,
    });

    const { result } = renderHook(() => useReferenciasSyncAdmin("user-1", true));
    await waitFor(() => expect(result.current.syncs.loading).toBe(false));

    await act(async () => {
      await result.current.reverterSync("sync-1");
    });
    expect(syncService.reverterSyncReferencias).toHaveBeenCalledWith("sync-1");

    await act(async () => {
      await result.current.restaurarBackup("b-1");
    });
    expect(syncService.restaurarBackupReferencias).toHaveBeenCalledWith("b-1");

    // reload pós-mutação no fim da cadeia
    await waitFor(() =>
      expect(mockDe(syncService.getBackupsReferencia).mock.calls.length).toBeGreaterThan(0),
    );
  });

  it("histórico da pendência devolve erro tipado para a página exibir", async () => {
    mockDe(syncService.getHistoricoPendencia).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useReferenciasSyncAdmin("user-1", true));

    await expect(result.current.historicoPendencia(pendenciaFixture)).rejects.toBeInstanceOf(AppError);
    expect(syncService.getHistoricoPendencia).toHaveBeenCalledWith(pendenciaFixture);
  });
});
