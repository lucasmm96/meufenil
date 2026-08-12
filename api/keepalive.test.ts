import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "./keepalive";
import { createClient } from "@supabase/supabase-js";
import { recordBackgroundJobExecution } from "../src/shared/background-jobs.js";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

vi.mock("../src/shared/background-jobs.js", () => ({
  recordBackgroundJobExecution: vi.fn(),
}));

type MockResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
};

function createResponse(): MockResponse {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    end(body?: string) {
      this.body = body ?? "";
    },
  };
}

function prepareClient(result: { error: null } | { error: { message: string } }) {
  const limitMock = vi.fn().mockResolvedValue(result);
  const selectMock = vi.fn(() => ({ limit: limitMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));

  (createClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    from: fromMock,
  });

  return {
    fromMock,
    limitMock,
  };
}

describe("keepalive handler", () => {
  const recordMock = recordBackgroundJobExecution as unknown as ReturnType<typeof vi.fn>;
  const createClientMock = createClient as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.VERCEL_ENV;
    delete process.env.KEEPALIVE_SUPABASE_URL;
    delete process.env.KEEPALIVE_SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.KEEPALIVE_DEV_SUPABASE_URL;
    delete process.env.KEEPALIVE_DEV_SUPABASE_SERVICE_ROLE_KEY;
  });

  it("usa o ambiente de produção quando VERCEL_ENV é production", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.KEEPALIVE_SUPABASE_URL = "https://prod.example.supabase.co";
    process.env.KEEPALIVE_SUPABASE_SERVICE_ROLE_KEY = "prod-key";

    const { fromMock } = prepareClient({ error: null });
    recordMock.mockResolvedValueOnce(undefined);

    const res = createResponse();
    await handler({ method: "GET" }, res);

    expect(createClientMock).toHaveBeenCalledWith(
      "https://prod.example.supabase.co",
      "prod-key",
      expect.objectContaining({
        auth: { autoRefreshToken: false, persistSession: false },
      }),
    );
    expect(fromMock).toHaveBeenCalledWith("usuarios");
    expect(recordMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        jobKey: "keepalive",
        environment: "prod",
        status: "success",
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual(
      expect.objectContaining({
        ok: true,
        projects: [expect.objectContaining({ environment: "prod", ok: true })],
      }),
    );
  });

  it("usa o ambiente de desenvolvimento quando não está em produção", async () => {
    process.env.VERCEL_ENV = "preview";
    process.env.KEEPALIVE_DEV_SUPABASE_URL = "https://dev.example.supabase.co";
    process.env.KEEPALIVE_DEV_SUPABASE_SERVICE_ROLE_KEY = "dev-key";

    const { fromMock } = prepareClient({ error: null });
    recordMock.mockResolvedValueOnce(undefined);

    const res = createResponse();
    await handler({ method: "GET" }, res);

    expect(createClientMock).toHaveBeenCalledWith(
      "https://dev.example.supabase.co",
      "dev-key",
      expect.any(Object),
    );
    expect(fromMock).toHaveBeenCalledWith("usuarios");
    expect(recordMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        environment: "dev",
        status: "success",
      }),
    );
    expect(JSON.parse(res.body)).toEqual(
      expect.objectContaining({
        ok: true,
        projects: [expect.objectContaining({ environment: "dev", ok: true })],
      }),
    );
  });

  it("não bloqueia o keepalive se a persistência do log falhar", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.KEEPALIVE_SUPABASE_URL = "https://prod.example.supabase.co";
    process.env.KEEPALIVE_SUPABASE_SERVICE_ROLE_KEY = "prod-key";

    prepareClient({ error: null });
    recordMock.mockRejectedValueOnce(new Error("persistência falhou"));

    const res = createResponse();
    await handler({ method: "GET" }, res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual(
      expect.objectContaining({
        ok: true,
        projects: [expect.objectContaining({ environment: "prod", ok: true })],
      }),
    );
  });

  it("retorna erro quando a leitura principal falha", async () => {
    process.env.VERCEL_ENV = "production";
    process.env.KEEPALIVE_SUPABASE_URL = "https://prod.example.supabase.co";
    process.env.KEEPALIVE_SUPABASE_SERVICE_ROLE_KEY = "prod-key";

    prepareClient({ error: { message: "timeout" } });
    recordMock.mockResolvedValueOnce(undefined);

    const res = createResponse();
    await handler({ method: "GET" }, res);

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body)).toEqual(
      expect.objectContaining({
        ok: false,
        projects: [expect.objectContaining({ ok: false, error: "timeout" })],
      }),
    );
  });
});
