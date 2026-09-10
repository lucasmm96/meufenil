import { describe, expect, it } from "vitest";
import { decodeDsr, ErroEstruturalDsr } from "./decode";
import type { LinhaOrigem, RespostaPowerBi } from "./types";

/**
 * Port de `test/decode.test.js` do `powerbi-export` (repo irmão) + casos
 * novos dos guardas do design §4.2: o teste original exercitava o fluxo
 * exportReport inteiro com 1 coluna; aqui o decode é testado isolado com a
 * matriz completa (resolução de nomes, máscaras, dicts, guardas).
 */

type LinhaBruta = { C?: unknown[]; R?: number; "Ø"?: number };

type OpcoesResposta = {
  colunas?: Array<{ N: string; DN?: string | null }>;
  linhas?: LinhaBruta[];
  dicts?: Record<string, unknown>;
  descriptor?: Array<{ Value?: string; Name?: string }>;
  payload?: unknown;
};

const COLUNAS_PADRAO = [
  { N: "G0" },
  { N: "G1" },
  { N: "G2" },
];

/** Descriptor espelhando o relatório real: Name = nome bruto da fonte. */
const DESCRIPTOR_PADRAO = [
  { Value: "G0", Name: "Consulta1 (2).DS_NOME" },
  { Value: "G1", Name: "Consulta1 (2).DS_MARCA_INDUSTRIALIZADO" },
  { Value: "G2", Name: "Sum(Consulta1 (2).NU_MAX_AMINOACIDO)" },
];

/** Payload com os 3 selects nomeados como no relatório real. */
const PAYLOAD_PADRAO = {
  queries: [
    {
      Query: {
        Commands: [
          {
            SemanticQueryDataShapeCommand: {
              Query: {
                Select: [
                  { Name: "Consulta1 (2).DS_NOME", NativeReferenceName: "Nome do Produto" },
                  {
                    Name: "Consulta1 (2).DS_MARCA_INDUSTRIALIZADO",
                    NativeReferenceName: "Marca do Produto",
                  },
                  {
                    Name: "Sum(Consulta1 (2).NU_MAX_AMINOACIDO)",
                    NativeReferenceName: "NU_MAX_AMINOACIDO",
                  },
                ],
              },
            },
          },
        ],
      },
    },
  ],
};

function resposta(opcoes: OpcoesResposta = {}): RespostaPowerBi {
  const colunas = opcoes.colunas ?? COLUNAS_PADRAO;
  const linhas = opcoes.linhas ?? [];

  return {
    results: [
      {
        result: {
          data: {
            dsr: {
              DS: [
                {
                  ValueDicts: opcoes.dicts ?? {},
                  PH: [
                    {
                      DM0: [{ S: colunas }, ...linhas],
                    },
                  ],
                },
              ],
            },
          },
          descriptor: { Select: opcoes.descriptor ?? DESCRIPTOR_PADRAO },
        },
      },
    ],
  };
}

describe("decodeDsr", () => {
  it("decodifica com NativeReferenceName do payload (essência do teste original)", () => {
    const rows = decodeDsr(
      resposta({
        linhas: [
          { C: ["Alpha", "Marca A", 8], R: 0, "Ø": 0 },
          { C: ["Beta", "Marca B", 12], R: 0, "Ø": 0 },
        ],
      }),
      PAYLOAD_PADRAO
    );

    expect(rows).toEqual([
      { "Nome do Produto": "Alpha", "Marca do Produto": "Marca A", NU_MAX_AMINOACIDO: 8 },
      { "Nome do Produto": "Beta", "Marca do Produto": "Marca B", NU_MAX_AMINOACIDO: 12 },
    ]);
  });

  it("cai para DisplayName quando NativeReferenceName ausente", () => {
    const payload = {
      queries: [
        {
          Query: {
            Commands: [
              {
                SemanticQueryDataShapeCommand: {
                  Query: {
                    Select: [
                      { Name: "Consulta1 (2).DS_NOME", DisplayName: "Nome do Produto" },
                      { Name: "Consulta1 (2).DS_MARCA_INDUSTRIALIZADO", DisplayName: "Marca do Produto" },
                      { Name: "Sum(Consulta1 (2).NU_MAX_AMINOACIDO)", DisplayName: "NU_MAX_AMINOACIDO" },
                    ],
                  },
                },
              },
            ],
          },
        },
      ],
    };

    const rows = decodeDsr(
      resposta({ linhas: [{ C: ["Gama", "", 4], R: 0, "Ø": 0 }] }),
      payload
    );

    expect(Object.keys(rows[0])).toEqual([
      "Nome do Produto",
      "Marca do Produto",
      "NU_MAX_AMINOACIDO",
    ]);
  });

  it("usa o Name do descriptor quando o payload não traz o select", () => {
    const rows = decodeDsr(
      resposta({ linhas: [{ C: ["Delta", "Marca", 2], R: 0, "Ø": 0 }] }),
      null
    );

    expect(rows[0]).toEqual({
      "Consulta1 (2).DS_NOME": "Delta",
      "Consulta1 (2).DS_MARCA_INDUSTRIALIZADO": "Marca",
      "Sum(Consulta1 (2).NU_MAX_AMINOACIDO)": 2,
    });
  });

  it("descriptor em result.data.descriptor (caminho primário da API real) é lido corretamente", () => {
    const respostaPathPrimario: RespostaPowerBi = {
      results: [
        {
          result: {
            data: {
              dsr: {
                DS: [
                  {
                    ValueDicts: {},
                    PH: [{ DM0: [{ S: COLUNAS_PADRAO }, { C: ["Alfa", "Marca A", 10], R: 0, "Ø": 0 }] }],
                  },
                ],
              },
              descriptor: { Select: DESCRIPTOR_PADRAO },
            },
            // sem result.descriptor — só data.descriptor existe
          },
        },
      ],
    };

    const rows = decodeDsr(respostaPathPrimario, PAYLOAD_PADRAO);

    expect(rows).toEqual([
      { "Nome do Produto": "Alfa", "Marca do Produto": "Marca A", NU_MAX_AMINOACIDO: 10 },
    ]);
  });

  it("sem nome resolvido (payload nem descriptor) → erro estrutural, sem fallback ao N", () => {
    const semNome = [
      { N: "G0", DN: null },
      { N: "G1" },
      { N: "G2" },
    ];

    expect(() =>
      decodeDsr(
        resposta({
          colunas: semNome,
          descriptor: [{ Value: "G0" }, { Value: "G1" }, { Value: "G2" }],
          linhas: [{ C: ["Epsilon", "", 1], R: 0, "Ø": 0 }],
        })
      )
    ).toThrow(ErroEstruturalDsr);
  });

  it("null-mask (Ø) produz valor null na coluna", () => {
    const rows = decodeDsr(
      resposta({
        linhas: [
          // Ø bit 1: Marca null — C carrega só os valores não mascarados
          { C: ["Zeta", 8], R: 0, "Ø": 2 },
          // Ø bit 2: fenil null
          { C: ["Eta", "M2"], R: 0, "Ø": 4 },
        ],
      }),
      PAYLOAD_PADRAO
    );

    expect(rows[0]).toEqual({
      "Nome do Produto": "Zeta",
      "Marca do Produto": null,
      NU_MAX_AMINOACIDO: 8,
    });
    expect(rows[1]).toEqual({
      "Nome do Produto": "Eta",
      "Marca do Produto": "M2",
      NU_MAX_AMINOACIDO: null,
    });
  });

  it("repeat-mask (R) carrega o valor da linha anterior por coluna", () => {
    const rows = decodeDsr(
      resposta({
        linhas: [
          { C: ["Theta", "Marca X", 5], R: 0, "Ø": 0 },
          // bit 0 repetido: nome vem da linha anterior; Marca/fenil novos
          { C: ["Marca Y", 9], R: 1, "Ø": 0 },
        ],
      }),
      PAYLOAD_PADRAO
    );

    expect(rows[1]).toEqual({
      "Nome do Produto": "Theta",
      "Marca do Produto": "Marca Y",
      NU_MAX_AMINOACIDO: 9,
    });
  });

  it("null e repeat combinados não consomem valores (cursor coerente)", () => {
    const rows = decodeDsr(
      resposta({
        linhas: [{ C: ["Iota"], R: 2, "Ø": 4 }], // Marca repetida; fenil null
      }),
      PAYLOAD_PADRAO
    );

    expect(rows[0]).toEqual({
      "Nome do Produto": "Iota",
      "Marca do Produto": null,
      NU_MAX_AMINOACIDO: null,
    });
  });

  it("ValueDicts resolve índice inteiro válido", () => {
    const rows = decodeDsr(
      resposta({
        colunas: [{ N: "G0", DN: "D1" }],
        dicts: { D1: ["Maçã", "Arroz", "Feijão"] },
        descriptor: [{ Value: "G0", Name: "Consulta1 (2).DS_NOME" }],
        payload: null,
        linhas: [{ C: [1], R: 0, "Ø": 0 }],
      })
    );

    expect(rows[0]).toEqual({ "Consulta1 (2).DS_NOME": "Arroz" });
  });

  it("ValueDicts: dict ausente, índice fora do intervalo e índice negativo passam o valor bruto", () => {
    const colunas = [
      { N: "G0", DN: "SEM_DICT" },
      { N: "G1", DN: "D1" },
      { N: "G2", DN: "D1" },
    ];
    const descriptor = [
      { Value: "G0", Name: "A" },
      { Value: "G1", Name: "B" },
      { Value: "G2", Name: "C" },
    ];

    const rows = decodeDsr(
      resposta({
        colunas,
        dicts: { D1: ["zero", "um"] },
        descriptor,
        payload: null,
        linhas: [{ C: ["bruto", 5, -1], R: 0, "Ø": 0 }],
      })
    );

    expect(rows[0]).toEqual({ A: "bruto", B: 5, C: -1 });
  });

  it("trim apenas nas bordas de strings; espaços duplos internos preservados; casing preservado", () => {
    const rows = decodeDsr(
      resposta({
        linhas: [{ C: ["  Arroz  Integral  ", "  Marca  ", 8], R: 0, "Ø": 0 }],
      }),
      PAYLOAD_PADRAO
    );

    expect(rows[0]).toEqual({
      "Nome do Produto": "Arroz  Integral",
      "Marca do Produto": "Marca",
      NU_MAX_AMINOACIDO: 8,
    });
  });

  it("resposta sem results[0].result.data → erro estrutural", () => {
    expect(() => decodeDsr({ results: [] })).toThrow(ErroEstruturalDsr);
  });

  it("DSR sem DS → erro estrutural", () => {
    const semDs = {
      results: [{ result: { data: { dsr: {} } } }],
    };

    expect(() => decodeDsr(semDs)).toThrow(ErroEstruturalDsr);
  });

  it("DS sem PH/DM0 → erro estrutural", () => {
    const semDm0 = {
      results: [{ result: { data: { dsr: { DS: [{}] } } } }],
    };

    expect(() => decodeDsr(semDm0)).toThrow(ErroEstruturalDsr);
  });

  it("DM0 vazio → erro estrutural", () => {
    const dm0Vazio = {
      results: [
        { result: { data: { dsr: { DS: [{ PH: [{ DM0: [] }] }] } } } },
      ],
    };

    expect(() => decodeDsr(dm0Vazio)).toThrow(ErroEstruturalDsr);
  });

  it("DM0[0] sem S (schema) → erro estrutural", () => {
    const semSchema = {
      results: [
        { result: { data: { dsr: { DS: [{ PH: [{ DM0: [{}] }] }] } } } },
      ],
    };

    expect(() => decodeDsr(semSchema)).toThrow(ErroEstruturalDsr);
  });

  it("33 colunas → erro estrutural (bitmask 32-bit)", () => {
    const colunas = Array.from({ length: 33 }, (_, i) => ({ N: `G${i}` }));
    const linhas = [{ C: Array.from({ length: 33 }, () => 1), R: 0, "Ø": 0 }];

    expect(() => decodeDsr(resposta({ colunas, linhas }))).toThrow(ErroEstruturalDsr);
  });

  it("32 colunas é aceito (limite do bitmask)", () => {
    const colunas = Array.from({ length: 32 }, (_, i) => ({ N: `G${i}` }));
    const descriptor = Array.from({ length: 32 }, (_, i) => ({
      Value: `G${i}`,
      Name: `N${i}`,
    }));
    const linhas = [{ C: Array.from({ length: 32 }, () => 1), R: 0, "Ø": 0 }];
    const rows = decodeDsr(resposta({ colunas, linhas, descriptor, payload: null }));

    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0])).toEqual(
      Array.from({ length: 32 }, (_, i) => `N${i}`)
    );
  });

  it("valores sobrando (C maior que o consumido pelas máscaras) → erro de desalinhamento", () => {
    expect(() =>
      decodeDsr(
        resposta({
          linhas: [{ C: ["Kappa", "Marca", 3, "extra"], R: 0, "Ø": 0 }],
        })
      )
    ).toThrow(/desalinhamento/);
  });

  it("valores faltando (C menor que o consumido) → erro de desalinhamento", () => {
    expect(() =>
      decodeDsr(
        resposta({
          linhas: [{ C: ["Lambda"], R: 0, "Ø": 0 }],
        })
      )
    ).toThrow(/desalinhamento/);
  });

  it("decode é determinístico: mesma resposta produz linhas idênticas", () => {
    const opcoes = {
      linhas: [{ C: ["Mu", "Marca", 6], R: 0, "Ø": 0 }],
    };
    const primeira = decodeDsr(resposta(opcoes), PAYLOAD_PADRAO) as LinhaOrigem[];
    const segunda = decodeDsr(resposta(opcoes), PAYLOAD_PADRAO) as LinhaOrigem[];

    expect(segunda).toEqual(primeira);
  });
});
