import { describe, expect, it, vi, beforeEach } from "vitest";
import { recordBackgroundJobExecution } from "./background-jobs";

describe("recordBackgroundJobExecution", () => {
  const insertMock = vi.fn();
  const fromMock = vi.fn();
  const client = {
    from: fromMock,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockReturnValue({ insert: insertMock });
  });

  it("persiste a execução com os campos normalizados", async () => {
    insertMock.mockResolvedValueOnce({ error: null });

    await recordBackgroundJobExecution(client as never, {
      runId: "run-1",
      jobKey: "keepalive",
      environment: "dev",
      status: "success",
      startedAt: "2026-08-10T10:00:00.000Z",
      finishedAt: "2026-08-10T10:00:01.500Z",
      durationMs: 1500,
      message: "ok",
      details: { target: "meufenil-dev" },
    });

    expect(fromMock).toHaveBeenCalledWith("background_job_executions");
    expect(insertMock).toHaveBeenCalledWith({
      run_id: "run-1",
      job_key: "keepalive",
      environment: "dev",
      status: "success",
      started_at: "2026-08-10T10:00:00.000Z",
      finished_at: "2026-08-10T10:00:01.500Z",
      duration_ms: 1500,
      message: "ok",
      details: { target: "meufenil-dev" },
    });
  });

  it("usa metadata vazia quando detalhes não são informados", async () => {
    insertMock.mockResolvedValueOnce({ error: null });

    await recordBackgroundJobExecution(client as never, {
      runId: "run-2",
      jobKey: "keepalive",
      environment: "prod",
      status: "failure",
      startedAt: "2026-08-10T10:00:00.000Z",
      finishedAt: "2026-08-10T10:00:02.000Z",
      durationMs: 2000,
      message: "falhou",
    });

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        details: {},
        environment: "prod",
        status: "failure",
      }),
    );
  });

  it("lança erro quando a persistência falha", async () => {
    insertMock.mockResolvedValueOnce({
      error: { message: "não foi possível inserir" },
    });

    await expect(
      recordBackgroundJobExecution(client as never, {
        runId: "run-3",
        jobKey: "keepalive",
        environment: "dev",
        status: "partial",
        startedAt: "2026-08-10T10:00:00.000Z",
        finishedAt: "2026-08-10T10:00:03.000Z",
        durationMs: 3000,
        message: "parcial",
      }),
    ).rejects.toThrow("não foi possível inserir");
  });
});
