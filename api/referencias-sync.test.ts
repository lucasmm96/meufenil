import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import handler from "./referencias-sync";
import { createClient } from "@supabase/supabase-js";
import { extractPowerBiReport } from "../src/shared/powerbi/extract.js";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

vi.mock("../src/shared/powerbi/extract.js", () => ({
  extractPowerBiReport: vi.fn(),
}));

/**
 * Rota no espelho de `api/keepalive.test.ts`: mock do `createClient` +
 * injeção via mock do módulo de extração (design §17). A validação é a REAL
 * (`validarExtracao`, pura) — origem inválida exercita o check de verdade.
 */

type MockResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
};

type ResultadoMock = {
  data?: unknown;
  error?: { code?: string; message: string } | null;
};

type Registro = { tabela: string; operacao: string; argumentos: unknown[] };

const EXTRACAO_VALIDA = [
  { "Nome do Produto": "Arroz", "Marca do Produto": "Marca A", NU_MAX_AMINOACIDO: 8 },
  { "Nome do Produto": "Feijão", "Marca do Produto": "Marca B", NU_MAX_AMINOACIDO: 12 },
];

const EXTRACAO_INVALIDA = [
  { "Nome do Produto": null, "Marca do Produto": "Marca A", NU_MAX_AMINOACIDO: 8 },
];

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

function criarSupabaseMock(filasPorTabela: Record<string, ResultadoMock[]>) {
  const chamadas: Registro[] = [];

  const fromMock = vi.fn((tabela: string) => {
    const fila = filasPorTabela[tabela] ?? [];

    const consumir = () => {
      const proximo = fila.shift();

      if (proximo === undefined) {
        throw new Error(`Mock Supabase sem resultado programado para: ${tabela}`);
      }

      return Promise.resolve(proximo);
    };

    const builder = {
      insert(valores: unknown) {
        chamadas.push({ tabela, operacao: "insert", argumentos: [valores] });
        return builder;
      },
      update(valores: unknown) {
        chamadas.push({ tabela, operacao: "update", argumentos: [valores] });
        return builder;
      },
      select(colunas: unknown) {
        chamadas.push({ tabela, operacao: "select", argumentos: [colunas] });
        return builder;
      },
      eq(coluna: unknown, valor: unknown) {
        chamadas.push({ tabela, operacao: "eq", argumentos: [coluna, valor] });
        return builder;
      },
      lt(coluna: unknown, valor: unknown) {
        chamadas.push({ tabela, operacao: "lt", argumentos: [coluna, valor] });
        return builder;
      },
      single() {
        chamadas.push({ tabela, operacao: "single", argumentos: [] });
        return consumir();
      },
      maybeSingle() {
        chamadas.push({ tabela, operacao: "maybeSingle", argumentos: [] });
        return consumir();
      },
      then(resolve: (valor: ResultadoMock) => void) {
        resolve(consumir());
      },
    };

    return builder;
  });

  const getUserMock = vi.fn();

  return {
    supabase: { from: fromMock, auth: { getUser: getUserMock } },
    fromMock,
    getUserMock,
    chamadas,
  };
}

function filasParaSucesso(): Record<string, ResultadoMock[]> {
  return {
    referencia_syncs: [
      { data: null, error: null }, // stale recovery
      { data: { id: "sync-1" }, error: null }, // claim INSERT ... single
      { data: null, error: null }, // UPDATE final success
    ],
    referencia_eventos: [
      { data: null, error: null }, // sync_started
      { data: null, error: null }, // extraction
      { data: null, error: null }, // validation
      { data: null, error: null }, // snapshot_created
      { data: null, error: null }, // backup_created
    ],
    referencia_snapshots: [{ data: null, error: null }],
    referencia_backups: [{ data: null, error: null }],
    referencias: [{ data: [{ id: "referencia-1", nome: "Arroz" }], error: null }],
  };
}

describe("referencias-sync handler", () => {
  const extractMock = extractPowerBiReport as unknown as ReturnType<typeof vi.fn>;
  const createClientMock = createClient as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;
    delete process.env.POWERBI_RESOURCE_KEY;
    delete process.env.REFERENCIAS_SYNC_SUPABASE_URL;
    delete process.env.REFERENCIAS_SYNC_SUPABASE_SERVICE_ROLE_KEY;
  });

  function setAmbiente() {
    process.env.CRON_SECRET = "segredo-cron";
    process.env.POWERBI_RESOURCE_KEY = "resource-key-teste";
    process.env.REFERENCIAS_SYNC_SUPABASE_URL = "https://sync.example.supabase.co";
    process.env.REFERENCIAS_SYNC_SUPABASE_SERVICE_ROLE_KEY = "service-key-teste";
  }

  function prepararHandler(filas: Record<string, ResultadoMock[]>) {
    const mock = criarSupabaseMock(filas);
    createClientMock.mockReturnValue(mock.supabase);

    return mock;
  }

  it("cron feliz: claim → 5 eventos na ordem → snapshot+backup → success", async () => {
    setAmbiente();
    extractMock.mockResolvedValue({
      rows: EXTRACAO_VALIDA,
      patchAplicado: true,
      contagem: 2,
    });

    const mock = prepararHandler(filasParaSucesso());
    const res = createResponse();

    await handler(
      { method: "GET", headers: { authorization: "Bearer segredo-cron" } },
      res
    );

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ sync_id: "sync-1", status: "success" });

    expect(extractMock).toHaveBeenCalledWith({ resourceKey: "resource-key-teste" });

    const chamadasSyncs = mock.chamadas.filter((c) => c.tabela === "referencia_syncs");

    expect(chamadasSyncs[0]).toMatchObject({
      operacao: "update",
      argumentos: [
        expect.objectContaining({
          status: "failure",
          message: "execução interrompida (timeout da plataforma)",
        }),
      ],
    });

    const claim = chamadasSyncs.find((c) => c.operacao === "insert");
    expect(claim?.argumentos[0]).toMatchObject({
      environment: "prod",
      trigger_source: "cron",
      requested_by: null,
      status: "running",
    });

    const final = chamadasSyncs.find((c) => c.operacao === "update" && c !== chamadasSyncs[0]);
    expect(final?.argumentos[0]).toMatchObject({
      status: "success",
      total_origem: 2,
      message: expect.stringContaining("M2"),
    });

    const eventos = mock.chamadas.filter(
      (c) => c.tabela === "referencia_eventos" && c.operacao === "insert"
    );
    expect(eventos.map((e) => (e.argumentos[0] as { tipo: string }).tipo)).toEqual([
      "sync_started",
      "extraction",
      "validation",
      "snapshot_created",
      "backup_created",
    ]);

    expect(eventos[1].argumentos[0]).toMatchObject({
      tipo: "extraction",
      detalhes: { contagem: 2, patch_aplicado: true },
    });

    const shaEsperado = createHash("sha256")
      .update(JSON.stringify(EXTRACAO_VALIDA))
      .digest("hex");

    const snapshot = mock.chamadas.find(
      (c) => c.tabela === "referencia_snapshots" && c.operacao === "insert"
    );
    expect(snapshot?.argumentos[0]).toMatchObject({
      sync_id: "sync-1",
      payload_sha256: shaEsperado,
      contagem: 2,
    });

    const backup = mock.chamadas.find(
      (c) => c.tabela === "referencia_backups" && c.operacao === "insert"
    );
    expect(backup?.argumentos[0]).toMatchObject({
      sync_id: "sync-1",
      contagem: 1,
    });
  });

  it("cron: Bearer ausente ou errado → 401; sem CRON_SECRET → 500 de configuração", async () => {
    setAmbiente();
    prepararHandler({});
    const res = createResponse();

    await handler({ method: "GET", headers: {} }, res);
    expect(res.statusCode).toBe(401);

    await handler({ method: "GET", headers: { authorization: "Bearer errado" } }, res);
    expect(res.statusCode).toBe(401);
    expect(createClientMock).not.toHaveBeenCalled();

    delete process.env.CRON_SECRET;
    await handler({ method: "GET", headers: { authorization: "Bearer errado" } }, res);
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body)).toEqual({
      error: "Missing environment variable: CRON_SECRET",
    });
  });

  it("configuração ausente do Supabase → 500 antes de criar client", async () => {
    process.env.CRON_SECRET = "segredo-cron";
    prepararHandler({});
    const res = createResponse();

    await handler(
      { method: "GET", headers: { authorization: "Bearer segredo-cron" } },
      res
    );

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body)).toEqual({
      error: "Missing environment variable: REFERENCIAS_SYNC_SUPABASE_URL",
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("single-flight: claim viola 23505 → 409 sem registrar sync nem eventos", async () => {
    setAmbiente();
    const mock = prepararHandler({
      referencia_syncs: [
        { data: null, error: null }, // stale recovery ok
        { data: null, error: { code: "23505", message: "duplicate key" } }, // claim
      ],
      referencia_eventos: [],
    });
    const res = createResponse();

    await handler(
      { method: "GET", headers: { authorization: "Bearer segredo-cron" } },
      res
    );

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body)).toEqual({
      error: "Sync já em andamento para este ambiente.",
    });
    expect(extractMock).not.toHaveBeenCalled();
    expect(
      mock.chamadas.some((c) => c.tabela === "referencia_eventos")
    ).toBe(false);
  });

  it("origem inválida → sync origin_invalid, sem snapshot/backup", async () => {
    setAmbiente();
    extractMock.mockResolvedValue({
      rows: EXTRACAO_INVALIDA,
      patchAplicado: true,
      contagem: 1,
    });

    const mock = prepararHandler({
      referencia_syncs: [
        { data: null, error: null },
        { data: { id: "sync-invalida" }, error: null },
        { data: null, error: null },
      ],
      referencia_eventos: [
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
      ],
      referencia_snapshots: [],
      referencia_backups: [],
      referencias: [],
    });
    const res = createResponse();

    await handler(
      { method: "GET", headers: { authorization: "Bearer segredo-cron" } },
      res
    );

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      sync_id: "sync-invalida",
      status: "origin_invalid",
    });

    const updatesSync = mock.chamadas.filter(
      (c) => c.tabela === "referencia_syncs" && c.operacao === "update"
    );
    expect(updatesSync[1].argumentos[0]).toMatchObject({
      status: "origin_invalid",
      total_origem: null,
      message: expect.stringContaining("nome nulo"),
    });

    expect(
      mock.chamadas.some((c) => c.tabela === "referencia_snapshots")
    ).toBe(false);
    expect(mock.chamadas.some((c) => c.tabela === "referencia_backups")).toBe(false);

    const eventos = mock.chamadas.filter(
      (c) => c.tabela === "referencia_eventos" && c.operacao === "insert"
    );
    expect(eventos.map((e) => (e.argumentos[0] as { tipo: string }).tipo)).toEqual([
      "sync_started",
      "extraction",
      "validation",
    ]);
    expect(eventos[2].argumentos[0]).toMatchObject({
      tipo: "validation",
      detalhes: { valida: false, motivo: expect.stringContaining("nome nulo") },
    });
  });

  it("falha técnica na extração → sync failure + evento com erro + 500", async () => {
    setAmbiente();
    extractMock.mockRejectedValue(new Error("Falha na extração Power BI: HTTP 500 Internal Server Error."));

    const mock = prepararHandler({
      referencia_syncs: [
        { data: null, error: null },
        { data: { id: "sync-falha" }, error: null },
        { data: null, error: null },
      ],
      referencia_eventos: [
        { data: null, error: null },
        { data: null, error: null },
      ],
      referencia_snapshots: [],
      referencia_backups: [],
      referencias: [],
    });
    const res = createResponse();

    await handler(
      { method: "GET", headers: { authorization: "Bearer segredo-cron" } },
      res
    );

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body)).toEqual({
      sync_id: "sync-falha",
      status: "failure",
      error: "Falha na extração Power BI: HTTP 500 Internal Server Error.",
    });

    const eventoExtraction = mock.chamadas.filter(
      (c) => c.tabela === "referencia_eventos" && c.operacao === "insert"
    );
    expect(eventoExtraction[1].argumentos[0]).toMatchObject({
      tipo: "extraction",
      detalhes: { erro: "Falha na extração Power BI: HTTP 500 Internal Server Error." },
    });

    const updatesSync = mock.chamadas.filter(
      (c) => c.tabela === "referencia_syncs" && c.operacao === "update"
    );
    expect(updatesSync[1].argumentos[0]).toMatchObject({
      status: "failure",
      message: "Falha na extração Power BI: HTTP 500 Internal Server Error.",
      details: {
        estagios: [
          expect.objectContaining({ estagio: "extraction", status: "erro" }),
        ],
      },
    });
  });

  it("manual: sem token → 403; token não-admin → 403", async () => {
    setAmbiente();
    prepararHandler({});
    const res = createResponse();

    await handler({ method: "POST", headers: {} }, res);
    expect(res.statusCode).toBe(403);
    expect(createClientMock).toHaveBeenCalledTimes(1);

    const comum = prepararHandler({});
    comum.getUserMock.mockResolvedValue({
      data: { user: { id: "usuario-comum" } },
      error: null,
    });
    comum.fromMock.mockImplementationOnce((tabela: string) => {
      if (tabela !== "usuarios") {
        throw new Error(`from(${tabela}) não deveria ser chamado`);
      }

      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: "usuario-comum", role: "user" },
              error: null,
            }),
          }),
        }),
      };
    });

    await handler(
      { method: "POST", headers: { authorization: "Bearer jwt-do-usuario" } },
      res
    );
    expect(res.statusCode).toBe(403);
  });

  it("manual: admin autenticado → sync com trigger manual e requested_by", async () => {
    setAmbiente();
    extractMock.mockResolvedValue({
      rows: EXTRACAO_VALIDA,
      patchAplicado: true,
      contagem: 2,
    });

    const filas = filasParaSucesso();
    const mock = criarSupabaseMock(filas);
    mock.getUserMock.mockResolvedValue({
      data: { user: { id: "usuario-admin" } },
      error: null,
    });
    mock.fromMock.mockImplementationOnce((tabela: string) => {
      if (tabela !== "usuarios") {
        throw new Error(`from(${tabela}) não deveria ser chamado`);
      }

      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: "usuario-admin", role: "admin" },
              error: null,
            }),
          }),
        }),
      };
    });
    createClientMock.mockReturnValue(mock.supabase);
    const res = createResponse();

    await handler(
      { method: "POST", headers: { authorization: "Bearer jwt-do-admin" } },
      res
    );

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ sync_id: "sync-1", status: "success" });

    const claim = mock.chamadas.find(
      (c) => c.tabela === "referencia_syncs" && c.operacao === "insert"
    );
    expect(claim?.argumentos[0]).toMatchObject({
      trigger_source: "manual",
      requested_by: "usuario-admin",
    });
  });

  it("método não permitido → 405 com Allow GET, POST", async () => {
    setAmbiente();
    const res = createResponse();

    await handler({ method: "PUT" }, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe("GET, POST");
    expect(JSON.parse(res.body)).toEqual({ error: "Method not allowed" });
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
