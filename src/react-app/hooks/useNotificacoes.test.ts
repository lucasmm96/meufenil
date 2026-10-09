import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useNotificacoes } from "./useNotificacoes";
import * as notificacoesService from "@/react-app/services/notificacoes.service";
import type { NotificacaoDTO } from "@/react-app/services/dtos/notificacoes.dto";

/* =========================
   MOCKS
========================= */
vi.mock("@/react-app/context/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    usuarioAtivoId: "user-123",
    authUser: { id: "user-123" },
    loadingAuth: false,
    ready: true,
    isDelegado: false,
    owner: null,
  })),
}));

vi.mock("@/react-app/services/notificacoes.service", () => ({
  listarNotificacoes: vi.fn(),
  marcarComoLida: vi.fn(),
  marcarTodasComoLidas: vi.fn(),
  subscribirNotificacoes: vi.fn(() => vi.fn()), // retorna função de cleanup
}));

vi.mock("@/react-app/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

const mockNotificacoes: NotificacaoDTO[] = [
  {
    id: "notif-1",
    user_id: "user-123",
    type: "admin_message",
    title: "Mensagem de teste",
    body: "Corpo da mensagem",
    read_at: null,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    target: "user",
  },
  {
    id: "notif-2",
    user_id: "user-123",
    type: "system_event",
    title: "Evento do sistema",
    body: "Sincronização concluída",
    read_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    target: "user",
  },
];

/* =========================
   TESTES
========================= */

describe("useNotificacoes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(notificacoesService.listarNotificacoes).mockResolvedValue(mockNotificacoes);
    vi.mocked(notificacoesService.subscribirNotificacoes).mockReturnValue(vi.fn());
  });

  it("estado inicial: loading=true, notificacoes vazio", () => {
    // Nunca resolve (loading permanente para checar estado inicial)
    vi.mocked(notificacoesService.listarNotificacoes).mockReturnValue(
      new Promise(() => {})
    );

    const { result } = renderHook(() => useNotificacoes());

    expect(result.current.loading).toBe(true);
    expect(result.current.notificacoes).toEqual([]);
    expect(result.current.naoLidas).toBe(0);
  });

  it("carrega notificações ao montar", async () => {
    const { result } = renderHook(() => useNotificacoes());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.notificacoes).toHaveLength(2);
    expect(notificacoesService.listarNotificacoes).toHaveBeenCalledWith("user-123");
  });

  it("calcula naoLidas corretamente (apenas notif-1 está não lida)", async () => {
    const { result } = renderHook(() => useNotificacoes());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // notif-1 tem read_at=null (não lida); notif-2 tem read_at preenchido
    expect(result.current.naoLidas).toBe(1);
  });

  it("marcarComoLida: chama service e atualiza estado otimisticamente", async () => {
    vi.mocked(notificacoesService.marcarComoLida).mockResolvedValue(undefined);

    const { result } = renderHook(() => useNotificacoes());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.naoLidas).toBe(1);

    await act(async () => {
      await result.current.marcarComoLida("notif-1");
    });

    expect(notificacoesService.marcarComoLida).toHaveBeenCalledWith("notif-1");
    // Atualização otimista: read_at deve ser preenchido
    expect(result.current.notificacoes.find((n) => n.id === "notif-1")?.read_at).not.toBeNull();
    expect(result.current.naoLidas).toBe(0);
  });

  it("marcarTodasComoLidas: chama service e marca todas como lidas", async () => {
    vi.mocked(notificacoesService.marcarTodasComoLidas).mockResolvedValue(undefined);

    const { result } = renderHook(() => useNotificacoes());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.marcarTodasComoLidas();
    });

    expect(notificacoesService.marcarTodasComoLidas).toHaveBeenCalled();
    expect(result.current.naoLidas).toBe(0);
  });

  it("define erro quando listarNotificacoes falha", async () => {
    const { AppError } = await import("@/react-app/lib/errors");
    const appError = new AppError("NOTIFICACOES_LIST_ERROR", "Erro de rede");

    vi.mocked(notificacoesService.listarNotificacoes).mockRejectedValue(appError);

    const { result } = renderHook(() => useNotificacoes());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeInstanceOf(AppError);
    expect(result.current.notificacoes).toEqual([]);
  });

  it("subscreve ao Realtime ao montar e cancela ao desmontar", async () => {
    const unsubscribeMock = vi.fn();
    vi.mocked(notificacoesService.subscribirNotificacoes).mockReturnValue(unsubscribeMock);

    const { result, unmount } = renderHook(() => useNotificacoes());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(notificacoesService.subscribirNotificacoes).toHaveBeenCalledWith(
      "user-123",
      expect.any(Function)
    );

    unmount();

    expect(unsubscribeMock).toHaveBeenCalled();
  });
});
