import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AppError } from "@/react-app/lib/errors";

// 👉 mock do supabase ANTES do import do service (padrão referencias.service.test)
vi.mock("@/react-app/lib/supabase", () => {
  return {
    supabase: {
      from: vi.fn(),
      rpc: vi.fn(),
      auth: { getSession: vi.fn() },
    },
  };
});

vi.mock("@/react-app/lib/app-environment", () => ({
  CURRENT_APP_ENVIRONMENT: "dev",
}));

import { supabase } from "@/react-app/lib/supabase";
import {
  getBackupsReferencia,
  executarSyncManual,
  getEventosReferencia,
  getPermissaoRecuperacao,
  getSyncRunningAmbiente,
  getSyncsReferencias,
  getSyncValidadaAmbiente,
  restaurarBackupReferencias,
} from "./referencias-sync.service";

type Fn = ReturnType<typeof vi.fn>;

interface Builder {
  select: Fn;
  in: Fn;
  eq: Fn;
  ilike: Fn;
  order: Fn;
  limit: Fn;
  range: Fn;
  maybeSingle: Fn;
  single: Fn;
}

/** Builder encadeável EXPLÍCITO (mesmo contrato do referencias.service.test). */
function criarBuilder(): Builder {
  const b = {} as Builder;

  b.select = vi.fn(() => b);
  b.in = vi.fn(() => b);
  b.eq = vi.fn(() => b);
  b.ilike = vi.fn(() => b);
  b.order = vi.fn(() => b);

  b.limit = vi.fn().mockResolvedValue({ data: [], error: null });
  b.range = vi.fn().mockResolvedValue({ data: [], error: null, count: 0 });
  b.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  b.single = vi.fn().mockResolvedValue({ data: null, error: null });

  return b;
}

const from = supabase.from as unknown as Fn;
const rpc = supabase.rpc as unknown as Fn;
const getSession = supabase.auth.getSession as unknown as Fn;

const linhaSync = {
  id: "sync-1",
  environment: "dev",
  trigger_source: "manual",
  requested_by: null,
  status: "success",
  started_at: "2026-09-06T12:00:00.000Z",
  finished_at: "2026-09-06T12:01:00.000Z",
  total_origem: 3200,
  equivalentes: 3195,
  criadas: 3,
  arquivadas: 2,
  deletadas: null,
  message: "Sincronização concluída",
  details: { estagios: [{ nome: "extracao", ms: 900 }] },
  alteracoes: [
    {
      op: "create",
      referencia_id: "ref-1",
      antes: null,
      depois: { nome: "Arroz", marca: "", fenil_mg_por_100g: 50 },
    },
  ],
  created_at: "2026-09-06T12:01:00.000Z",
};

beforeEach(() => {
  from.mockReset();
  rpc.mockReset();
  getSession.mockReset();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("referencias-sync.service", () => {
  describe("getSyncsReferencias", () => {
    it("consulta o ambiente atual com contagem exata e devolve DTO mapeado", async () => {
      const b = criarBuilder();
      b.range.mockResolvedValue({ data: [linhaSync], error: null, count: 1 });
      from.mockReturnValue(b);

      const page = await getSyncsReferencias({ page: 1, pageSize: 3 });

      expect(from).toHaveBeenCalledWith("referencia_syncs");
      expect(b.select).toHaveBeenCalledWith(expect.any(String), { count: "exact" });
      expect(b.eq).toHaveBeenCalledWith("environment", "dev");
      expect(b.order).toHaveBeenCalledWith("started_at", { ascending: false });
      expect(b.range).toHaveBeenCalledWith(0, 2);

      expect(page).toMatchObject({
        total: 1,
        page: 1,
        pageSize: 3,
      });
      expect(page.items[0]).toMatchObject({
        id: "sync-1",
        status: "success",
        details: { estagios: expect.any(Array) },
      });
      expect(page.items[0].alteracoes).toEqual([
        {
          op: "create",
          referencia_id: "ref-1",
          antes: null,
          depois: { nome: "Arroz", marca: "", fenil_mg_por_100g: 50 },
        },
      ]);
    });

    it("aplica filtro de status e pagina a partir do offset correto", async () => {
      const b = criarBuilder();
      b.range.mockResolvedValue({ data: [], error: null, count: 10 });
      from.mockReturnValue(b);

      await getSyncsReferencias({ status: "pending_review", page: 2, pageSize: 10 });

      expect(b.eq).toHaveBeenCalledWith("environment", "dev");
      expect(b.eq).toHaveBeenCalledWith("status", "pending_review");
      expect(b.range).toHaveBeenCalledWith(10, 19);
    });

    it("lança AppError quando a consulta falha", async () => {
      const b = criarBuilder();
      b.range.mockResolvedValue({ data: null, error: new Error("boom"), count: null });
      from.mockReturnValue(b);

      await expect(getSyncsReferencias({ page: 1, pageSize: 3 })).rejects.toBeInstanceOf(AppError);
    });
  });

  describe("getSyncValidadaAmbiente / getSyncRunningAmbiente", () => {
    it("matching validado quando existe sync success no ambiente", async () => {
      const b = criarBuilder();
      b.select.mockReturnValue(b);
      b.eq.mockImplementation((campo: string) =>
        campo === "status" ? Promise.resolve({ data: null, error: null, count: 3 }) : b,
      );
      from.mockReturnValue(b);

      const validada = await getSyncValidadaAmbiente();

      expect(from).toHaveBeenCalledWith("referencia_syncs");
      expect(b.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
      expect(b.eq).toHaveBeenCalledWith("environment", "dev");
      expect(b.eq).toHaveBeenCalledWith("status", "success");
      expect(validada).toBe(true);
    });

    it("sync running detectado com count > 0", async () => {
      const b = criarBuilder();
      // Cadeia: eq(environment) → builder; eq(status, "running") é o terminal
      b.eq.mockImplementation((campo: string) =>
        campo === "status" ? Promise.resolve({ data: null, error: null, count: 1 }) : b,
      );
      from.mockReturnValue(b);

      expect(await getSyncRunningAmbiente()).toBe(true);
    });
  });

  describe("getEventosReferencia", () => {
    const linhaEvento = {
      id: "e-1",
      sync_id: "sync-1",
      pendencia_id: null,
      referencia_id: "ref-1",
      tipo: "mudanca_aprovada",
      actor_id: "admin-1",
      // ENH-0009: sem embed referencias (FK removida); nome/marca ficam em detalhes
      detalhes: { nome: "Arroz Integral", marca: "Marca X", tipo: "substitution", motivo: null },
      created_at: "2026-09-06T12:00:00.000Z",
      referencia_syncs: { started_at: "2026-09-06T12:00:00.000Z", status: "success" },
    };

    it("aplica filtros de tipo, sync e termo no nome da referência", async () => {
      const b = criarBuilder();
      b.eq.mockReturnValue(b);
      b.ilike.mockReturnValue(b);
      b.range.mockResolvedValue({ data: [linhaEvento], error: null, count: 1 });
      from.mockReturnValue(b);

      const page = await getEventosReferencia({
        tipo: "mudanca_aprovada",
        syncId: "sync-1",
        termoReferencia: "Arroz",
        page: 1,
        pageSize: 3,
      });

      expect(from).toHaveBeenCalledWith("referencia_eventos");
      expect(b.eq).toHaveBeenCalledWith("tipo", "mudanca_aprovada");
      expect(b.eq).toHaveBeenCalledWith("sync_id", "sync-1");
      expect(b.ilike).toHaveBeenCalledWith("detalhes->>nome", "%Arroz%");

      expect(page.items[0]).toMatchObject({
        tipo: "mudanca_aprovada",
        referencia: { nome: "Arroz Integral", marca: "Marca X" },
        sync: { started_at: "2026-09-06T12:00:00.000Z", status: "success" },
      });
    });

    it("ignora termo em branco", async () => {
      const b = criarBuilder();
      b.range.mockResolvedValue({ data: [], error: null, count: 0 });
      from.mockReturnValue(b);

      await getEventosReferencia({ termoReferencia: "   ", page: 1, pageSize: 3 });

      expect(b.ilike).not.toHaveBeenCalled();
    });
  });

  describe("getBackupsReferencia", () => {
    it("lista backups recentes com embed da sync", async () => {
      const b = criarBuilder();
      b.order.mockReturnValue(b);
      b.limit = vi.fn().mockResolvedValue({
        data: [
          {
            id: "b-1",
            sync_id: "sync-1",
            payload_sha256: "abc123",
            contagem: 3147,
            created_at: "2026-09-06T12:00:00.000Z",
            referencia_syncs: { started_at: "2026-09-06T11:59:00.000Z" },
          },
        ],
        error: null,
      });
      from.mockReturnValue(b);

      const backups = await getBackupsReferencia();

      expect(from).toHaveBeenCalledWith("referencia_backups");
      expect(backups[0]).toMatchObject({
        id: "b-1",
        payload_sha256: "abc123",
        contagem: 3147,
        sync: { started_at: "2026-09-06T11:59:00.000Z" },
      });
    });
  });

  describe("getPermissaoRecuperacao", () => {
    it("lê a coluna da própria linha do usuário", async () => {
      const b = criarBuilder();
      b.maybeSingle.mockResolvedValue({ data: { pode_recuperacao: true }, error: null });
      from.mockReturnValue(b);

      expect(await getPermissaoRecuperacao("admin-1")).toBe(true);
      expect(b.maybeSingle).toHaveBeenCalled();
    });

    it("default false quando a linha não existe", async () => {
      const b = criarBuilder();
      from.mockReturnValue(b);

      expect(await getPermissaoRecuperacao("admin-1")).toBe(false);
    });
  });

  describe("restaurarBackupReferencias", () => {
    it("chama a RPC e retorna o resultado", async () => {
      rpc.mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { backup_id: "b-1", reativadas: 1, criadas: 0, arquivadas: 0, pendencias_canceladas: 0 },
          error: null,
        }),
      });
      const restaurar = await restaurarBackupReferencias("b-1");
      expect(rpc).toHaveBeenCalledWith("restaurar_referencias_de_backup", { p_backup_id: "b-1" });
      expect(restaurar.reativadas).toBe(1);
    });

    it("erro da RPC vira AppError", async () => {
      rpc.mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: new Error("nao") }) });
      await expect(restaurarBackupReferencias("b-1")).rejects.toBeInstanceOf(AppError);
    });
  });

  describe("executarSyncManual", () => {
    const token = "jwt-admin";

    function mockFetchOk(): ReturnType<typeof vi.fn> {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ sync_id: "sync-1", status: "success" }),
      });
      vi.stubGlobal("fetch", fetchMock);
      return fetchMock;
    }

    it("POST /api/referencias-sync com JWT da sessão", async () => {
      getSession.mockResolvedValue({ data: { session: { access_token: token } }, error: null });
      const fetchMock = mockFetchOk();

      const resultado = await executarSyncManual();

      expect(fetchMock).toHaveBeenCalledWith("/api/referencias-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      expect(resultado).toEqual({ sync_id: "sync-1", status: "success" });
    });

    it("sem sessão não chama a rota", async () => {
      getSession.mockResolvedValue({ data: { session: null }, error: null });
      const fetchMock = mockFetchOk();

      await expect(executarSyncManual()).rejects.toBeInstanceOf(AppError);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("erro da rota (ex.: 409 single-flight) vira AppError com a mensagem do corpo", async () => {
      getSession.mockResolvedValue({ data: { session: { access_token: token } }, error: null });
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: "Sync já em andamento para este ambiente." }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const erro = await executarSyncManual().catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(AppError);
      expect((erro as AppError).message).toBe("Sync já em andamento para este ambiente.");
    });

    it("resposta sem corpo legível tem mensagem padrão", async () => {
      getSession.mockResolvedValue({ data: { session: { access_token: token } }, error: null });
      const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => { throw new Error("x"); } });
      vi.stubGlobal("fetch", fetchMock);

      const erro = await executarSyncManual().catch((e: unknown) => e);

      expect((erro as AppError).message).toBe("Falha ao executar sincronização");
    });
  });
});
