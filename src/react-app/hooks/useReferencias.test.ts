import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useReferencias } from "./useReferencias";
import {
  getReferencias,
  createReferencia,
} from "@/react-app/services/referencias.service";
import { AppError } from "@/react-app/lib/errors";

/**
 * Mocks
 */
vi.mock("@/react-app/services/referencias.service", () => ({
  getReferencias: vi.fn(),
  createReferencia: vi.fn(),
}));

vi.mock("@/react-app/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

const mockedGetReferencias =
  getReferencias as unknown as ReturnType<typeof vi.fn>;

const mockedCreateReferencia =
  createReferencia as unknown as ReturnType<typeof vi.fn>;

describe("useReferencias", () => {
  const usuarioId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetReferencias.mockResolvedValue([]);
  });

  it("inicia com estado inicial correto", async () => {
    const { result } = renderHook(() => useReferencias(usuarioId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("busca referências com sucesso", async () => {
    const fakeRefs = [
      { id: "1", nome: "Arroz", fenil_mg_por_100g: 50 },
      { id: "2", nome: "Feijão", fenil_mg_por_100g: 70 },
    ];

    mockedGetReferencias.mockResolvedValue(fakeRefs);

    const { result } = renderHook(() => useReferencias(usuarioId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.search("arroz");
    });

    await waitFor(() => {
      expect(mockedGetReferencias).toHaveBeenLastCalledWith(
        expect.objectContaining({
          usuarioId,
          search: "arroz",
          orderBy: "nome",
          showInativas: false,
          onlyFavoritas: false,
          onlyCustomizadas: false,
        }),
      );
      expect(result.current.data).toEqual(fakeRefs);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("define erro quando a busca falha", async () => {
    const error = new Error("Falha inesperada");

    mockedGetReferencias.mockRejectedValue(error);

    const { result } = renderHook(() => useReferencias(usuarioId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.search("erro");
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual([]);
      expect(result.current.error).toBeInstanceOf(AppError);
    });

    expect(result.current.error?.code).toBe("UNKNOWN_ERROR");
  });

  it("cria referência com sucesso", async () => {
    const fakeRef = {
      id: "ref-1",
      nome: "Batata",
      fenil_mg_por_100g: 30,
    };

    mockedCreateReferencia.mockResolvedValue(fakeRef);
    mockedGetReferencias.mockResolvedValue([]);

    const { result } = renderHook(() => useReferencias(usuarioId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let response;
    await act(async () => {
      response = await result.current.create("Batata", 30);
    });

    expect(mockedCreateReferencia).toHaveBeenCalledWith({
      nome: "Batata",
      fenil_mg_por_100g: 30,
      usuarioId,
    });

    expect(response).toEqual(fakeRef);
    expect(result.current.error).toBeNull();
  });

  it("lança AppError quando a criação falha", async () => {
    const error = new Error("Erro ao criar");

    mockedCreateReferencia.mockRejectedValue(error);
    mockedGetReferencias.mockResolvedValue([]);

    const { result } = renderHook(() => useReferencias(usuarioId));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let thrownError: unknown;

    await act(async () => {
      try {
        await result.current.create("Erro", 999);
      } catch (err) {
        thrownError = err;
      }
    });

    expect(thrownError).toBeInstanceOf(AppError);

    expect(result.current.error).toBeInstanceOf(AppError);
    expect(result.current.error?.code).toBe("UNKNOWN_ERROR");
  });

});
