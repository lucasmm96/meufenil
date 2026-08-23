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

function prepareClient(
  results: Array<{ error: null } | { error: { message: string } }>
) {
  const limitMock = vi.fn();
  for (const result of results) {
    limitMock.mockResolvedValueOnce(result);
  }
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
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  function setProdEnv() {
    process.env.KEEPALIVE_SUPABASE_URL = "https://prod.example.supabase.co";
    process.env.KEEPALIVE_SUPABASE_SERVICE_ROLE_KEY = "prod-key";
  }

  function setDevEnv() {
    process.env.KEEPALIVE_DEV_SUPABASE_URL = "https://dev.example.supabase.co";
    process.env.KEEPALIVE_DEV_SUPABASE_SERVICE_ROLE_KEY = "dev-key";
  }

  it("pinga e persiste nos dois alvos (prod e dev) com o mesmo runId", async () => {
    setProdEnv();
    setDevEnv();

    prepareClient([{ error: null }, { error: null }]);
    recordMock.mockResolvedValue(undefined);

    const res = createResponse();
    await handler({ method: "GET" }, res);

    expect(createClientMock).toHaveBeenCalledWith(
      "https://prod.example.supabase.co",
      "prod-key",
      expect.objectContaining({
        auth: { autoRefreshToken: false, persistSession: false },
      }),
    );
    expect(createClientMock).toHaveBeenCalledWith(
      "https://dev.example.supabase.co",
      "dev-key",
      expect.objectContaining({
        auth: { autoRefreshToken: false, persistSession: false },
      }),
    );

    const calls = recordMock.mock.calls.map(([, input]) => input);
    const prodCall = calls.find((input) => input.environment === "prod");
    const devCall = calls.find((input) => input.environment === "dev");

    expect(prodCall).toMatchObject({
      jobKey: "keepalive",
      environment: "prod",
      status: "success",
    });
    expect(devCall).toMatchObject({
      jobKey: "keepalive",
      environment: "dev",
      status: "success",
    });
    expect(prodCall.runId).toBe(devCall.runId);

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(body.projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ environment: "prod", ok: true }),
        expect.objectContaining({ environment: "dev", ok: true }),
      ]),
    );
  });

  it("retorna 500 com erro explícito quando as variáveis do alvo dev estão ausentes", async () => {
    setProdEnv();

    const res = createResponse();
    await handler({ method: "GET" }, res);

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body)).toEqual(
      expect.objectContaining({
        ok: false,
        error: "Missing environment variable: KEEPALIVE_DEV_SUPABASE_URL",
      }),
    );
    expect(recordMock).not.toHaveBeenCalled();
  });

  it("falha parcial: alvo dev falha, prod persiste; resposta 500", async () => {
    setProdEnv();
    setDevEnv();

    prepareClient([{ error: null }, { error: { message: "timeout" } }]);
    recordMock.mockResolvedValue(undefined);

    const res = createResponse();
    await handler({ method: "GET" }, res);

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(false);
    expect(body.projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ environment: "prod", ok: true }),
        expect.objectContaining({ environment: "dev", ok: false, error: "timeout" }),
      ]),
    );

    const calls = recordMock.mock.calls.map(([, input]) => input);
    const prodCall = calls.find((input) => input.environment === "prod");
    const devCall = calls.find((input) => input.environment === "dev");

    expect(prodCall).toMatchObject({ status: "success" });
    expect(devCall).toMatchObject({ status: "failure" });
    expect(prodCall.runId).toBe(devCall.runId);
  });

  it("falha na persistência de um alvo não bloqueia a resposta", async () => {
    setProdEnv();
    setDevEnv();

    prepareClient([{ error: null }, { error: null }]);
    recordMock.mockRejectedValueOnce(new Error("persistência falhou"));
    recordMock.mockResolvedValueOnce(undefined);

    const res = createResponse();
    await handler({ method: "GET" }, res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual(
      expect.objectContaining({
        ok: true,
        projects: [
          expect.objectContaining({ environment: "prod", ok: true }),
          expect.objectContaining({ environment: "dev", ok: true }),
        ],
      }),
    );
  });

  it("todos os alvos falham → resposta 500 e persistência failure nos dois", async () => {
    setProdEnv();
    setDevEnv();

    prepareClient([
      { error: { message: "timeout" } },
      { error: { message: "denied" } },
    ]);
    recordMock.mockResolvedValue(undefined);

    const res = createResponse();
    await handler({ method: "GET" }, res);

    expect(res.statusCode).toBe(500);
    const calls = recordMock.mock.calls.map(([, input]) => input);
    expect(calls.find((input) => input.environment === "prod")).toMatchObject({
      status: "failure",
    });
    expect(calls.find((input) => input.environment === "dev")).toMatchObject({
      status: "failure",
    });
  });
});
