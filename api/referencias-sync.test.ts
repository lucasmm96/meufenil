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
 * injeção via mock do módulo de extração (design §17). A validação e o motor
 * de sincronização (M3) são os REAIS (puros) — os estágios 6–8 (M4) são
 * exercitados de verdade contra o estado do catálogo devolvido pelo mock do
 * Supabase (ativas/arquivadas/pendências/decisões/histórico + RPC
 * `aplicar_sync_referencias`), com o plano produzido pelo motor verificado no
 * argumento da chamada RPC.
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
  error?: { code?: string; message?: string } | Error | null;
};

type Registro = { tabela: string; operacao: string; argumentos: unknown[] };

type FilasRpc = Record<string, ResultadoMock[]>;

const EXTRACAO_VALIDA = [
  { "Nome do Produto": "Arroz", "Marca do Produto": "Marca A", NU_MAX_AMINOACIDO: 8 },
  { "Nome do Produto": "Feijão", "Marca do Produto": "Marca B", NU_MAX_AMINOACIDO: 12 },
];

const EXTRACAO_INVALIDA = [
  { "Nome do Produto": null, "Marca do Produto": "Marca A", NU_MAX_AMINOACIDO: 8 },
];

/**
 * Resumo que a RPC devolveria para o plano bootstrap da `EXTRACAO_VALIDA`
 * sobre catálogo vazio: nada criado/arquivado, 2 pendências new_item.
 */
const RESUMO_DIVERGENCIAS_2 = {
  equivalentes: 0,
  criadas: 0,
  arquivadas: 0,
  divergencias: 2,
};

/** Globais ativas espelhando a `EXTRACAO_VALIDA` (identidade canônica). */
const ATIVAS_MATCHED = [
  { id: "ref-1", nome: "Arroz", marca: "Marca A", fenil_mg_por_100g: 8 },
  { id: "ref-2", nome: "Feijão", marca: "Marca B", fenil_mg_por_100g: 12 },
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

/**
 * Mock do Supabase por fila: cada consulta/escrita consome o próximo
 * resultado programado da tabela (na ordem de execução da rota) e `rpc` tem
 * fila própria por função (M4 — estágio 7). Métodos de filtro registram a
 * chamada para asserção, sem afetar o consumo.
 */
function criarSupabaseMock(
  filasPorTabela: Record<string, ResultadoMock[]>,
  filasRpc: FilasRpc = {}
) {
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
      neq(coluna: unknown, valor: unknown) {
        chamadas.push({ tabela, operacao: "neq", argumentos: [coluna, valor] });
        return builder;
      },
      in(coluna: unknown, valores: unknown) {
        chamadas.push({ tabela, operacao: "in", argumentos: [coluna, valores] });
        return builder;
      },
      order(coluna: unknown, opcoes: unknown) {
        chamadas.push({ tabela, operacao: "order", argumentos: [coluna, opcoes] });
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

  const rpcMock = vi.fn((nome: string, argumentos: unknown) => {
    const fila = filasRpc[nome] ?? [];

    chamadas.push({ tabela: `rpc:${nome}`, operacao: "rpc", argumentos: [argumentos] });

    const proximo = fila.shift();

    if (proximo === undefined) {
      throw new Error(`Mock Supabase sem resultado programado para: rpc(${nome})`);
    }

    return Promise.resolve(proximo);
  });

  const getUserMock = vi.fn();

  return {
    supabase: { from: fromMock, rpc: rpcMock, auth: { getUser: getUserMock } },
    fromMock,
    rpcMock,
    getUserMock,
    chamadas,
  };
}

/**
 * Filas do caminho feliz com origem válida e catálogo vazio. Histórico sem
 * sync confiável → modo bootstrap: o motor não sugere nenhuma operação e o
 * plano sai só com pendências new_item (2) — a RPC responde 2 divergências.
 * Ordem de consumo por tabela (estágios 1–8): syncs = stale, claim, histórico
 * (estágio 6), UPDATE final; referencias = backup (estágio 5), ativas,
 * arquivadas; pendencias = abertas, decisões; eventos/snapshots/backups
 * = inserts únicos.
 */
function filasBootstrap(): Record<string, ResultadoMock[]> {
  return {
    referencia_syncs: [
      { data: null, error: null }, // stale recovery
      { data: { id: "sync-1" }, error: null }, // claim INSERT ... single
      { data: [], error: null }, // estágio 6 — histórico (nenhuma → bootstrap)
      { data: null, error: null }, // UPDATE final
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
    referencias: [
      { data: [{ id: "referencia-1", nome: "Arroz", marca: "", fenil_mg_por_100g: 0 }], error: null }, // backup
      { data: [], error: null }, // estágio 6 — ativas
      { data: [], error: null }, // estágio 6 — arquivadas
    ],
    referencia_sync_pendencias: [
      { data: [], error: null }, // estágio 6 — open
      { data: [], error: null }, // estágio 6 — decisões
    ],
  };
}

function filasRpcAplicar(data: unknown): FilasRpc {
  return { aplicar_sync_referencias: [{ data, error: null }] };
}

function filasRpcAplicarErro(erro: Error): FilasRpc {
  return { aplicar_sync_referencias: [{ data: null, error: erro }] };
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
    delete process.env.VERCEL_ENV;
  });

  function setAmbiente() {
    process.env.CRON_SECRET = "segredo-cron";
    process.env.POWERBI_RESOURCE_KEY = "resource-key-teste";
    process.env.REFERENCIAS_SYNC_SUPABASE_URL = "https://sync.example.supabase.co";
    process.env.REFERENCIAS_SYNC_SUPABASE_SERVICE_ROLE_KEY = "service-key-teste";
    // Os cenários simulam o deployment de produção (cron e manual rodam no
    // ambiente prod) → `ambienteAlvo()` resolve `prod` (revisão R4-1,
    // 2026-09-08 — ambiente derivado de VERCEL_ENV).
    process.env.VERCEL_ENV = "production";
  }

  function prepararHandler(
    filas: Record<string, ResultadoMock[]>,
    filasRpc?: FilasRpc
  ) {
    const mock = criarSupabaseMock(filas, filasRpc);
    createClientMock.mockReturnValue(mock.supabase);

    return mock;
  }

  /** Chamada da RPC de aplicação (estágio 7) com p_sync_id + p_plano. */
  function chamadaRpc(mock: ReturnType<typeof criarSupabaseMock>) {
    return mock.chamadas.find((c) => c.tabela === "rpc:aplicar_sync_referencias")
      ?.argumentos[0] as { p_sync_id: string; p_plano: Record<string, unknown> } | undefined;
  }

  /** Updates em referencia_syncs, na ordem em que ocorreram. */
  function updatesSync(mock: ReturnType<typeof criarSupabaseMock>) {
    return mock.chamadas.filter(
      (c) => c.tabela === "referencia_syncs" && c.operacao === "update"
    );
  }

  it("cron feliz: bootstrap (sem histórico) → plano só com pendências → pending_review", async () => {
    setAmbiente();
    extractMock.mockResolvedValue({
      rows: EXTRACAO_VALIDA,
      patchAplicado: true,
      contagem: 2,
    });

    const mock = prepararHandler(filasBootstrap(), filasRpcAplicar(RESUMO_DIVERGENCIAS_2));
    const res = createResponse();

    await handler(
      { method: "GET", headers: { authorization: "Bearer segredo-cron" } },
      res
    );

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ sync_id: "sync-1", status: "pending_review" });

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
      status: "pending_review",
      total_origem: 2,
      bootstrap: true,
      message: expect.stringContaining("2 divergência(s) pendente(s) de curadoria"),
    });

    // Estágios 6–8 registrados em details (comparison/apply não têm evento).
    const estagios = (
      (final?.argumentos[0] as { details: { estagios: { estagio: string; status: string }[] } })
        .details.estagios
    );
    expect(estagios.map((e) => `${e.estagio}:${e.status}`)).toEqual([
      "extraction:ok",
      "validation:ok",
      "snapshot:ok",
      "backup:ok",
      "comparison:ok",
      "apply:ok",
    ]);

    // Apenas os 5 eventos do catálogo §11.1 — comparação/aplicação não geram.
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

    // Plano do motor entregue à RPC: bootstrap, só pendências new_item.
    const chamadaRpcAplicar = chamadaRpc(mock);
    expect(chamadaRpcAplicar?.p_sync_id).toBe("sync-1");
    expect(chamadaRpcAplicar?.p_plano).toMatchObject({
      versao: 1,
      modo: "bootstrap",
      criacoes: [],
      arquivamentos: [],
      pendencias: [
        {
          tipo: "new_item",
          referencia_id: null,
          proposta: { nome: "Arroz", marca: "Marca A", fenil_mg_por_100g: 8 },
          diff: null,
        },
        {
          tipo: "new_item",
          referencia_id: null,
          proposta: { nome: "Feijão", marca: "Marca B", fenil_mg_por_100g: 12 },
          diff: null,
        },
      ],
    });
    expect(mock.chamadas.filter((c) => c.tabela === "rpc:aplicar_sync_referencias")).toHaveLength(1);
  });

  it("pos_bootstrap (histórico com success) → aplicação automática → success", async () => {
    setAmbiente();
    extractMock.mockResolvedValue({
      rows: EXTRACAO_VALIDA,
      patchAplicado: true,
      contagem: 2,
    });

    const filas = {
      ...filasBootstrap(),
      referencia_syncs: [
        { data: null, error: null }, // stale recovery
        { data: { id: "sync-2" }, error: null }, // claim
        { data: [{ status: "success" }], error: null }, // histórico confiável
        { data: null, error: null }, // UPDATE final success
      ],
    };

    const mock = prepararHandler(
      filas,
      filasRpcAplicar({ equivalentes: 0, criadas: 2, arquivadas: 0, divergencias: 0 })
    );
    const res = createResponse();

    await handler(
      { method: "GET", headers: { authorization: "Bearer segredo-cron" } },
      res
    );

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ sync_id: "sync-2", status: "success" });

    // Modo pos_bootstrap: o motor sugere as 2 criações (auto-apply).
    const chamadaRpcAplicar = chamadaRpc(mock);
    expect(chamadaRpcAplicar?.p_plano).toMatchObject({
      versao: 1,
      modo: "pos_bootstrap",
      pendencias: [],
    });
    const plano = chamadaRpcAplicar?.p_plano as {
      criacoes: { op: string; identidade: unknown }[];
      arquivamentos: unknown[];
    };
    expect(plano.criacoes).toEqual([
      { op: "create", identidade: { nome: "Arroz", marca: "Marca A", fenil_mg_por_100g: 8 } },
      { op: "create", identidade: { nome: "Feijão", marca: "Marca B", fenil_mg_por_100g: 12 } },
    ]);
    expect(plano.arquivamentos).toEqual([]);

    const final = updatesSync(mock)[1];
    expect(final.argumentos[0]).toMatchObject({
      status: "success",
      total_origem: 2,
      bootstrap: false,
      message: expect.stringContaining("2 criadas, 0 arquivadas, sem divergências pendentes"),
    });
  });

  it("catálogo já equivalente (tudo matched) → success sem operações nem pendências", async () => {
    setAmbiente();
    extractMock.mockResolvedValue({
      rows: EXTRACAO_VALIDA,
      patchAplicado: true,
      contagem: 2,
    });

    const filas = {
      ...filasBootstrap(),
      referencias: [
        { data: [], error: null }, // backup
        { data: ATIVAS_MATCHED, error: null }, // estágio 6 — ativas
        { data: [], error: null }, // estágio 6 — arquivadas
      ],
    };

    const mock = prepararHandler(
      filas,
      filasRpcAplicar({ equivalentes: 2, criadas: 0, arquivadas: 0, divergencias: 0 })
    );
    const res = createResponse();

    await handler(
      { method: "GET", headers: { authorization: "Bearer segredo-cron" } },
      res
    );

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ sync_id: "sync-1", status: "success" });

    const chamadaRpcAplicar = chamadaRpc(mock);
    expect(chamadaRpcAplicar?.p_plano).toMatchObject({
      criacoes: [],
      arquivamentos: [],
      pendencias: [],
      resumo: { totalOrigem: 2, equivalentes: 2 },
    });

    const final = updatesSync(mock)[1];
    expect(final.argumentos[0]).toMatchObject({
      status: "success",
      message: expect.stringContaining("2 equivalentes"),
    });
  });

  it("RPC de aplicação falha → nada aplicado → 500 failure com a mensagem da RPC", async () => {
    setAmbiente();
    extractMock.mockResolvedValue({
      rows: EXTRACAO_VALIDA,
      patchAplicado: true,
      contagem: 2,
    });

    const mensagemRpc =
      "Ator Sistema não provisionado (sistema@meufenil.local) — " +
      "execute scripts/provisionar-ator-sistema.js";

    const filas = {
      ...filasBootstrap(),
      referencia_syncs: [
        { data: null, error: null }, // stale recovery
        { data: { id: "sync-3" }, error: null }, // claim
        { data: [], error: null }, // histórico
        { data: null, error: null }, // UPDATE final failure (catch)
      ],
    };

    const mock = prepararHandler(filas, filasRpcAplicarErro(new Error(mensagemRpc)));
    const res = createResponse();

    await handler(
      { method: "GET", headers: { authorization: "Bearer segredo-cron" } },
      res
    );

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body)).toEqual({
      sync_id: "sync-3",
      status: "failure",
      error: mensagemRpc,
    });

    // Sem a RPC ok, nada foi aplicado: failure com a mensagem pura (sem o
    // prefixo "Alterações aplicadas") e o estágio apply registrado como erro.
    const final = updatesSync(mock)[1];
    expect(final.argumentos[0]).toMatchObject({
      status: "failure",
      total_origem: null,
      message: mensagemRpc,
    });
    const estagios = (
      (final.argumentos[0] as { details: { estagios: { estagio: string; status: string; erro: string }[] } })
        .details.estagios
    );
    expect(estagios[5]).toEqual({
      estagio: "apply",
      status: "erro",
      erro: mensagemRpc,
    });
  });

  it("RPC ok mas UPDATE final falha → 500 failure com mensagem honesta de alterações aplicadas", async () => {
    setAmbiente();
    extractMock.mockResolvedValue({
      rows: EXTRACAO_VALIDA,
      patchAplicado: true,
      contagem: 2,
    });

    const erroFinal = "Falha ao gravar a conclusão da sync (rede)";

    const filas = {
      ...filasBootstrap(),
      referencia_syncs: [
        { data: null, error: null }, // stale recovery
        { data: { id: "sync-4" }, error: null }, // claim
        { data: [], error: null }, // histórico
        { data: null, error: new Error(erroFinal) }, // UPDATE final (estágio 8) — falha
        { data: null, error: null }, // UPDATE final failure (catch)
      ],
    };

    const mock = prepararHandler(filas, filasRpcAplicar(RESUMO_DIVERGENCIAS_2));
    const res = createResponse();

    await handler(
      { method: "GET", headers: { authorization: "Bearer segredo-cron" } },
      res
    );

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body)).toEqual({
      sync_id: "sync-4",
      status: "failure",
      error: erroFinal,
    });

    const updates = updatesSync(mock);
    expect(updates).toHaveLength(3); // stale + tentativa do estágio 8 + failure
    expect(updates[1].argumentos[0]).toMatchObject({
      status: "pending_review",
      total_origem: 2,
      bootstrap: true,
    });

    // Decisão 5 do M4: a RPC já retornou ok → as alterações são fato; a
    // mensagem de failure registra a verdade (rollback do M5 poderá reverter).
    expect(updates[2].argumentos[0]).toMatchObject({
      status: "failure",
      message: `Alterações aplicadas; falha ao finalizar a sync: ${erroFinal}`,
    });
    const estagios = (
      (updates[2].argumentos[0] as { details: { estagios: { status: string }[] } }).details
        .estagios
    );
    expect(estagios.filter((e) => e.status === "ok")).toHaveLength(6);
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

  it("manual: admin autenticado → sync com trigger manual, requested_by e pending_review", async () => {
    setAmbiente();
    extractMock.mockResolvedValue({
      rows: EXTRACAO_VALIDA,
      patchAplicado: true,
      contagem: 2,
    });

    const mock = criarSupabaseMock(filasBootstrap(), filasRpcAplicar(RESUMO_DIVERGENCIAS_2));
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
    expect(JSON.parse(res.body)).toEqual({ sync_id: "sync-1", status: "pending_review" });

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
