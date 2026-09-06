import { describe, expect, it, vi } from "vitest";
import {
  aplicarPatchJanela,
  COUNT_PATCH_APLICADO,
  ErroExtracaoPowerBi,
  extractPowerBiReport,
  QUERY_DATA_URL,
} from "./extract";
import { QUERY_PAYLOAD } from "./query-payload";
import type { LinhaOrigem, RespostaPowerBi } from "./types";

/**
 * Extração isolada: `fetchImpl`/`decodeImpl` injetados (design §17 —
 * testes colocalizados sem rede). Matriz dos guardas D-1/§4.2:
 * resource key obrigatória, fail-high do patch de volume, erro HTTP explícito,
 * decode real no caminho feliz e payload original preservado.
 */

function respostaDsrValida(): RespostaPowerBi {
  return {
    results: [
      {
        result: {
          data: {
            dsr: {
              DS: [
                {
                  ValueDicts: {},
                  PH: [
                    {
                      DM0: [
                        { S: [{ N: "G0" }, { N: "G1" }, { N: "G2" }] },
                        { C: ["Alfa", "Marca A", 3], R: 0, "Ø": 0 },
                        { C: ["Beta", "Marca B", 9], R: 0, "Ø": 0 },
                      ],
                    },
                  ],
                },
              ],
            },
          },
          descriptor: {
            Select: [
              { Value: "G0", Name: "Consulta1 (2).DS_NOME" },
              { Value: "G1", Name: "Consulta1 (2).DS_MARCA_INDUSTRIALIZADO" },
              { Value: "G2", Name: "Sum(Consulta1 (2).NU_MAX_AMINOACIDO)" },
            ],
          },
        },
      },
    ],
  };
}

function fetchOk(corpo: unknown) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => corpo,
  }));
}

describe("aplicarPatchJanela", () => {
  it("aplica o Count no clone e preserva o payload original", () => {
    const { payloadPatch, patchAplicado } = aplicarPatchJanela(QUERY_PAYLOAD, COUNT_PATCH_APLICADO);

    expect(patchAplicado).toBe(true);
    expect(
      (
        payloadPatch.queries[0].Query.Commands[0]
          .SemanticQueryDataShapeCommand.Binding.DataReduction.Primary.Window as {
          Count: number;
        }
      ).Count
    ).toBe(COUNT_PATCH_APLICADO);
    expect(
      QUERY_PAYLOAD.queries[0].Query.Commands[0].SemanticQueryDataShapeCommand
        .Binding.DataReduction.Primary.Window.Count
    ).toBe(500);
  });

  it("sem janela no payload → patchAplicado false (fail-high na chamada)", () => {
    const semJanela = { queries: [] } as unknown as typeof QUERY_PAYLOAD;
    const { patchAplicado } = aplicarPatchJanela(semJanela, COUNT_PATCH_APLICADO);

    expect(patchAplicado).toBe(false);
  });
});

describe("extractPowerBiReport", () => {
  it("caminho feliz: POST com patch 30000, decode real, resultado com contagem", async () => {
    const corpo = respostaDsrValida();
    const fetchImpl = fetchOk(corpo);

    const resultado = await extractPowerBiReport({
      resourceKey: "chave-teste",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, {
      method: string;
      headers: Record<string, string>;
      body: string;
    }];

    expect(url).toBe(QUERY_DATA_URL);
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json;charset=UTF-8");
    expect(init.headers.Accept).toBe("application/json");
    expect(init.headers["X-PowerBI-ResourceKey"]).toBe("chave-teste");

    const corpoEnviado = JSON.parse(init.body) as typeof QUERY_PAYLOAD;
    expect(
      corpoEnviado.queries[0].Query.Commands[0].SemanticQueryDataShapeCommand
        .Binding.DataReduction.Primary.Window.Count
    ).toBe(COUNT_PATCH_APLICADO);

    expect(resultado).toEqual({
      rows: [
        { "Nome do Produto": "Alfa", "Marca do Produto": "Marca A", NU_MAX_AMINOACIDO: 3 },
        { "Nome do Produto": "Beta", "Marca do Produto": "Marca B", NU_MAX_AMINOACIDO: 9 },
      ],
      patchAplicado: true,
      contagem: 2,
    });
  });

  it("resource key ausente → erro de configuração antes de qualquer fetch", async () => {
    const fetchImpl = fetchOk(respostaDsrValida());

    await expect(
      extractPowerBiReport({ resourceKey: "", fetchImpl })
    ).rejects.toThrow(ErroExtracaoPowerBi);
    await expect(
      extractPowerBiReport({ resourceKey: "", fetchImpl })
    ).rejects.toThrow(/Resource key/);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("payload sem janela de volume → fail-high antes do fetch", async () => {
    const fetchImpl = fetchOk(respostaDsrValida());

    await expect(
      extractPowerBiReport({
        resourceKey: "chave-teste",
        payload: { queries: [] },
        fetchImpl,
      })
    ).rejects.toThrow(/fail-high/);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("resposta HTTP não-ok → erro explícito com status", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({}),
    }));

    await expect(
      extractPowerBiReport({ resourceKey: "chave-teste", fetchImpl })
    ).rejects.toThrow(ErroExtracaoPowerBi);
    await expect(
      extractPowerBiReport({ resourceKey: "chave-teste", fetchImpl })
    ).rejects.toThrow(/HTTP 500 Internal Server Error/);
  });

  it("decodeImpl recebe o payload ORIGINAL (não o clone patchado)", async () => {
    const corpo = respostaDsrValida();
    const fetchImpl = fetchOk(corpo);
    const decodeImpl = vi.fn((): LinhaOrigem[] => [{ qualquer: "linha" }]);

    const resultado = await extractPowerBiReport({
      resourceKey: "chave-teste",
      fetchImpl,
      decodeImpl,
    });

    expect(decodeImpl).toHaveBeenCalledTimes(1);
    // O payload passado ao decode é o ORIGINAL (Count 500) — nunca o clone
    // patchado (Count 30000) que vai no corpo do fetch (igualdade profunda).
    expect(decodeImpl).toHaveBeenCalledWith(expect.anything(), QUERY_PAYLOAD);
    expect(resultado.contagem).toBe(1);
    expect(resultado.rows).toEqual([{ qualquer: "linha" }]);
  });

  it("json() com corpo inválido propaga o erro (não vira 500 mascarado)", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => {
        throw new Error("JSON inesperado");
      },
    }));

    await expect(
      extractPowerBiReport({ resourceKey: "chave-teste", fetchImpl })
    ).rejects.toThrow("JSON inesperado");
  });
});
