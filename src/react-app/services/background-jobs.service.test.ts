import { describe, expect, it, vi, beforeEach } from "vitest";
import { AppError } from "@/react-app/lib/errors";

vi.mock("@/react-app/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("@/react-app/lib/app-environment", () => ({
  CURRENT_APP_ENVIRONMENT: "dev",
}));

import { supabase } from "@/react-app/lib/supabase";
import {
  getBackgroundJobExecutions,
  getBackgroundJobOverview,
  getDefaultBackgroundJobsOverviewLimit,
  getDefaultBackgroundJobsPageSize,
  getDefaultBackgroundJobsPeriodDays,
} from "./background-jobs.service";

type MockQueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
  count?: number;
};

type QueryChain = {
  eq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
};

function createQueryChain(result: MockQueryResult) {
  const chain = {} as QueryChain;

  chain.eq = vi.fn(() => chain);
  chain.gte = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(async () => result);
  chain.range = vi.fn(async () => result);

  return chain;
}

describe("background-jobs.service", () => {
  const fromMock = supabase.from as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getBackgroundJobOverview agrupa por job e ambiente e converte details", async () => {
    const rows = [
      {
        id: "1",
        run_id: "run-1",
        job_key: "keepalive",
        environment: "dev",
        status: "success",
        started_at: "2026-08-10T10:00:00.000Z",
        finished_at: "2026-08-10T10:00:01.000Z",
        duration_ms: 1000,
        message: "primeira",
        details: ["a", "b"],
        created_at: "2026-08-10T10:00:01.500Z",
      },
      {
        id: "2",
        run_id: "run-2",
        job_key: "keepalive",
        environment: "dev",
        status: "failure",
        started_at: "2026-08-10T11:00:00.000Z",
        finished_at: "2026-08-10T11:00:02.000Z",
        duration_ms: 2000,
        message: "segunda",
        details: { retry: 1 },
        created_at: "2026-08-10T11:00:02.500Z",
      },
    ];

    const query = createQueryChain({ data: rows, error: null });
    fromMock.mockReturnValueOnce({
      select: vi.fn(() => query),
    });

    const result = await getBackgroundJobOverview({ jobKey: "keepalive", periodDays: 7 }, 50);

    expect(fromMock).toHaveBeenCalledWith("background_job_executions");
    expect(query.eq).toHaveBeenCalledWith("environment", "dev");
    expect(query.eq).toHaveBeenCalledWith("job_key", "keepalive");
    expect(query.gte).toHaveBeenCalledWith(
      "started_at",
      expect.stringMatching(/^2026-08-/),
    );
    expect(query.order).toHaveBeenCalledWith("started_at", { ascending: false });
    expect(query.limit).toHaveBeenCalledWith(50);
    expect(result).toEqual([
      expect.objectContaining({
        job_key: "keepalive",
        environment: "dev",
        total_count: 2,
        success_count: 1,
        failure_count: 1,
        partial_count: 0,
        last_status: "failure",
        last_details: { retry: 1 },
        last_run_id: "run-2",
      }),
    ]);
  });

  it("getBackgroundJobExecutions mapeia detalhes string e pagina corretamente", async () => {
    const rows = [
      {
        id: "10",
        run_id: "run-10",
        job_key: "keepalive",
        environment: "dev",
        status: "partial",
        started_at: "2026-08-10T12:00:00.000Z",
        finished_at: "2026-08-10T12:00:04.000Z",
        duration_ms: 4000,
        message: "parcial",
        details: "sem detalhes estruturados",
        created_at: "2026-08-10T12:00:04.500Z",
      },
    ];

    const query = createQueryChain({ data: rows, error: null, count: 1 });
    fromMock.mockReturnValueOnce({
      select: vi.fn(() => query),
    });

    const result = await getBackgroundJobExecutions(
      { jobKey: "keepalive", status: "partial" },
      2,
      10,
    );

    expect(query.eq).toHaveBeenCalledWith("environment", "dev");
    expect(query.eq).toHaveBeenCalledWith("job_key", "keepalive");
    expect(query.eq).toHaveBeenCalledWith("status", "partial");
    expect(query.order).toHaveBeenCalledWith("started_at", { ascending: false });
    expect(query.range).toHaveBeenCalledWith(10, 19);
    expect(result).toEqual({
      items: [
        expect.objectContaining({
          id: "10",
          details: { value: "sem detalhes estruturados" },
        }),
      ],
      total: 1,
      page: 2,
      pageSize: 10,
    });
  });

  it("lança AppError quando a consulta falha", async () => {
    const query = createQueryChain({ data: null, error: { message: "erro" } });
    fromMock.mockReturnValueOnce({
      select: vi.fn(() => query),
    });

    await expect(getBackgroundJobOverview()).rejects.toBeInstanceOf(AppError);
  });

  it("expõe valores padrão úteis para paginação e período", () => {
    expect(getDefaultBackgroundJobsPageSize()).toBe(3);
    expect(getDefaultBackgroundJobsOverviewLimit()).toBe(240);
    expect(getDefaultBackgroundJobsPeriodDays()).toBe(30);
  });
});
