import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listarNotificacoes,
  contarNaoLidas,
  marcarComoLida,
  marcarTodasComoLidas,
  inserirNotificacao,
} from "./notificacoes.service";
import { AppError } from "@/react-app/lib/errors";

/* =========================
   MOCK DO SUPABASE
========================= */
vi.mock("@/react-app/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}));

import { supabase } from "@/react-app/lib/supabase";

const fromMock = supabase.from as unknown as ReturnType<typeof vi.fn>;
const rpcMock = supabase.rpc as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

/* =========================
   TESTES
========================= */

describe("notificacoes.service", () => {
  const userId = "user-abc";

  describe("listarNotificacoes", () => {
    it("retorna lista de notificações não expiradas", async () => {
      const mockData = [
        {
          id: "1",
          user_id: userId,
          type: "admin_message",
          title: "Teste",
          body: "Corpo",
          read_at: null,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          target: "user",
        },
      ];

      fromMock.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          or: vi.fn().mockReturnValueOnce({
            gt: vi.fn().mockReturnValueOnce({
              order: vi.fn().mockResolvedValueOnce({
                data: mockData,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await listarNotificacoes(userId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("1");
      expect(result[0].type).toBe("admin_message");
    });

    it("retorna lista vazia quando não há notificações", async () => {
      fromMock.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          or: vi.fn().mockReturnValueOnce({
            gt: vi.fn().mockReturnValueOnce({
              order: vi.fn().mockResolvedValueOnce({
                data: null,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await listarNotificacoes(userId);

      expect(result).toEqual([]);
    });

    it("lança AppError quando a query falha", async () => {
      fromMock.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          or: vi.fn().mockReturnValueOnce({
            gt: vi.fn().mockReturnValueOnce({
              order: vi.fn().mockResolvedValueOnce({
                data: null,
                error: { message: "connection error" },
              }),
            }),
          }),
        }),
      });

      await expect(listarNotificacoes(userId)).rejects.toBeInstanceOf(AppError);
    });
  });

  describe("contarNaoLidas", () => {
    it("retorna contagem de não lidas", async () => {
      fromMock.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          or: vi.fn().mockReturnValueOnce({
            is: vi.fn().mockReturnValueOnce({
              gt: vi.fn().mockResolvedValueOnce({
                count: 3,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await contarNaoLidas(userId);

      expect(result).toBe(3);
    });

    it("retorna 0 quando count é null", async () => {
      fromMock.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          or: vi.fn().mockReturnValueOnce({
            is: vi.fn().mockReturnValueOnce({
              gt: vi.fn().mockResolvedValueOnce({
                count: null,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await contarNaoLidas(userId);

      expect(result).toBe(0);
    });

    it("lança AppError quando falha", async () => {
      fromMock.mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          or: vi.fn().mockReturnValueOnce({
            is: vi.fn().mockReturnValueOnce({
              gt: vi.fn().mockResolvedValueOnce({
                count: null,
                error: { message: "query error" },
              }),
            }),
          }),
        }),
      });

      await expect(contarNaoLidas(userId)).rejects.toBeInstanceOf(AppError);
    });
  });

  describe("marcarComoLida", () => {
    it("chama RPC marcar_notificacao_lida com o id correto", async () => {
      rpcMock.mockResolvedValueOnce({ error: null });

      await expect(marcarComoLida("notif-1")).resolves.toBeUndefined();

      expect(rpcMock).toHaveBeenCalledWith("marcar_notificacao_lida", {
        notificacao_id: "notif-1",
      });
    });

    it("lança AppError quando RPC falha", async () => {
      rpcMock.mockResolvedValueOnce({
        error: { message: "permissão negada" },
      });

      await expect(marcarComoLida("notif-1")).rejects.toBeInstanceOf(AppError);
    });
  });

  describe("marcarTodasComoLidas", () => {
    it("chama RPC marcar_todas_notificacoes_lidas", async () => {
      rpcMock.mockResolvedValueOnce({ error: null });

      await expect(marcarTodasComoLidas()).resolves.toBeUndefined();

      expect(rpcMock).toHaveBeenCalledWith("marcar_todas_notificacoes_lidas");
    });

    it("lança AppError quando RPC falha", async () => {
      rpcMock.mockResolvedValueOnce({
        error: { message: "erro interno" },
      });

      await expect(marcarTodasComoLidas()).rejects.toBeInstanceOf(AppError);
    });
  });

  describe("inserirNotificacao", () => {
    it("insere notificação com sucesso (admin)", async () => {
      fromMock.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValueOnce({
          error: null,
        }),
      });

      await expect(
        inserirNotificacao({
          user_id: "admin-id",
          type: "admin_message",
          title: "Atualização importante",
          body: "Nova funcionalidade disponível.",
          target: "broadcast",
        })
      ).resolves.toBeUndefined();
    });

    it("lança AppError com mensagem do banco quando falha", async () => {
      fromMock.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValueOnce({
          error: { message: "new row violates row-level security policy" },
        }),
      });

      await expect(
        inserirNotificacao({
          user_id: "user-common",
          type: "admin_message",
          title: "Tentativa não autorizada",
          body: "Isso deve falhar.",
          target: "user",
        })
      ).rejects.toMatchObject({
        code: "NOTIFICACOES_INSERT_ERROR",
        message: "new row violates row-level security policy",
      });
    });
  });
});
