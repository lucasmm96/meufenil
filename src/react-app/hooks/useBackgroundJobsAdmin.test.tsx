import { renderHook, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/react-app/lib/errors";
import { useBackgroundJobsAdmin } from "./useBackgroundJobsAdmin";
import * as backgroundJobsService from "@/react-app/services/background-jobs.service";

vi.mock("@/react-app/services/background-jobs.service", () => ({
  getBackgroundJobExecutions: vi.fn(),
  getBackgroundJobOverview: vi.fn(),
  getDefaultBackgroundJobsOverviewLimit: vi.fn(() => 240),
  getDefaultBackgroundJobsPageSize: vi.fn(() => 3),
  getDefaultBackgroundJobsPeriodDays: vi.fn(() => 30),
}));

vi.mock("@/react-app/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("useBackgroundJobsAdmin", () => {
  const overview = [
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
      last_details: {},
      last_run_id: "run-1",
      last_created_at: "2026-08-10T12:00:01.500Z",
    },
  ] as const;

  const executions = [
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
      details: {},
      created_at: "2026-08-10T12:00:01.500Z",
    },
  ] as const;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não carrega nada quando a visualização está desabilitada", async () => {
    const { result } = renderHook(() => useBackgroundJobsAdmin("user-1", false));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(backgroundJobsService.getBackgroundJobOverview).not.toHaveBeenCalled();
    expect(backgroundJobsService.getBackgroundJobExecutions).not.toHaveBeenCalled();
    expect(result.current.overview).toEqual([]);
    expect(result.current.executions).toEqual([]);
  });

  it("carrega dados, expõe paginação e refaz consulta ao trocar filtros", async () => {
    (backgroundJobsService.getBackgroundJobOverview as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(overview);
    (backgroundJobsService.getBackgroundJobExecutions as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: executions,
      total: 40,
      page: 1,
      pageSize: 3,
    });

    const { result } = renderHook(() => useBackgroundJobsAdmin("user-1", true));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.overview).toEqual(overview);
    expect(result.current.executions).toEqual(executions);
    expect(result.current.total).toBe(40);
    expect(result.current.totalPages).toBe(14);

    await act(async () => {
      result.current.setPage(2);
    });

    await waitFor(() => expect(result.current.page).toBe(2));

    await act(async () => {
      result.current.setFilters({ status: "failure" });
    });

    await waitFor(() => expect(result.current.page).toBe(1));
    expect(backgroundJobsService.getBackgroundJobOverview).toHaveBeenCalled();
    expect(backgroundJobsService.getBackgroundJobExecutions).toHaveBeenCalled();
  });

  it("troca o tamanho de página, reseta para a página 1 e refaz a consulta com o novo range", async () => {
    (backgroundJobsService.getBackgroundJobOverview as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(overview);
    (backgroundJobsService.getBackgroundJobExecutions as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      items: executions,
      total: 40,
      page: 1,
      pageSize: 3,
    });

    const { result } = renderHook(() => useBackgroundJobsAdmin("user-1", true));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      result.current.setPage(2);
    });
    await waitFor(() => expect(result.current.page).toBe(2));

    await act(async () => {
      result.current.setPageSize(10);
    });

    await waitFor(() => expect(result.current.pageSize).toBe(10));
    expect(result.current.page).toBe(1);
    expect(backgroundJobsService.getBackgroundJobExecutions).toHaveBeenLastCalledWith(
      expect.objectContaining({ jobKey: "keepalive" }),
      1,
      10,
    );
  });

  it("normaliza falhas inesperadas em AppError", async () => {
    (backgroundJobsService.getBackgroundJobOverview as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("boom"),
    );
    (backgroundJobsService.getBackgroundJobExecutions as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("boom"),
    );

    const { result } = renderHook(() => useBackgroundJobsAdmin("user-1", true));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeInstanceOf(AppError);
    expect(result.current.overview).toEqual([]);
    expect(result.current.executions).toEqual([]);
  });
});
