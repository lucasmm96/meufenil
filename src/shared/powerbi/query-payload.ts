/**
 * Payload de consulta do relatório Power BI/ANVISA — fixture versionada.
 *
 * Procedência: `input/payload.json` do projeto irmão `powerbi-export`
 * (commit bc43873, 2026-07-12 — fora do monorepo; FEAT-0017 B1). Conteúdo
 * copiado byte a byte (JSON → TS, sem alteração de dados), sem segredos —
 * a resource key NUNCA vive aqui (D-1: lida de `POWERBI_RESOURCE_KEY`).
 *
 * `Binding.DataReduction.Primary.Window.Count = 500` é o valor original da
 * fonte; o patch fail-high para 30000 ocorre em extract.ts (design §4.2).
 */

export type PayloadConsultaPowerBi = {
  version: string;
  queries: Array<{
    Query: {
      Commands: Array<{
        SemanticQueryDataShapeCommand: {
          Query: {
            Version: number;
            From: Array<{ Name: string; Entity: string; Type: number }>;
            Select: Array<{
              Column: { Expression: { SourceRef: { Source: string } }; Property: string };
              Name: string;
              NativeReferenceName: string;
            }>;
          };
          Binding: {
            Primary: { Groupings: Array<{ Projections: number[] }> };
            DataReduction: { DataVolume: number; Primary: { Window: { Count: number } } };
            Version: number;
          };
          ExecutionMetricsKind: number;
        };
      }>;
    };
    CacheKey: string;
    QueryId: string;
    ApplicationContext: {
      DatasetId: string;
      Sources: Array<{ ReportId: string; VisualId: string }>;
    };
  }>;
  cancelQueries: unknown[];
  modelId: number;
};

export const QUERY_PAYLOAD: PayloadConsultaPowerBi = {
  version: "1.0.0",
  queries: [
    {
      Query: {
        Commands: [
          {
            SemanticQueryDataShapeCommand: {
              Query: {
                Version: 2,
                From: [
                  {
                    Name: "c1",
                    Entity: "Consulta",
                    Type: 0,
                  },
                ],
                Select: [
                  {
                    Column: {
                      Expression: {
                        SourceRef: {
                          Source: "c1",
                        },
                      },
                      Property: "DS_NOME",
                    },
                    Name: "Consulta1 (2).DS_NOME",
                    NativeReferenceName: "Nome do Produto",
                  },
                  {
                    Column: {
                      Expression: {
                        SourceRef: {
                          Source: "c1",
                        },
                      },
                      Property: "DS_MARCA_INDUSTRIALIZADO",
                    },
                    Name: "Consulta1 (2).DS_MARCA_INDUSTRIALIZADO",
                    NativeReferenceName: "Marca do Produto",
                  },
                  {
                    Column: {
                      Expression: {
                        SourceRef: {
                          Source: "c1",
                        },
                      },
                      Property: "NU_MAX_AMINOACIDO",
                    },
                    Name: "Sum(Consulta1 (2).NU_MAX_AMINOACIDO)",
                    NativeReferenceName: "NU_MAX_AMINOACIDO",
                  },
                ],
              },
              Binding: {
                Primary: {
                  Groupings: [
                    {
                      Projections: [0, 1, 2],
                    },
                  ],
                },
                DataReduction: {
                  DataVolume: 3,
                  Primary: {
                    Window: {
                      Count: 500,
                    },
                  },
                },
                Version: 1,
              },
              ExecutionMetricsKind: 1,
            },
          },
        ],
      },
      CacheKey:
        '{"Commands":[{"SemanticQueryDataShapeCommand":{"Query":{"Version":2,"From":[{"Name":"c1","Entity":"Consulta","Type":0}],"Select":[{"Column":{"Expression":{"SourceRef":{"Source":"c1"}},"Property":"DS_NOME"},"Name":"Consulta1 (2).DS_NOME","NativeReferenceName":"Nome do Produto"},{"Column":{"Expression":{"SourceRef":{"Source":"c1"}},"Property":"DS_MARCA_INDUSTRIALIZADO"},"Name":"Consulta1 (2).DS_MARCA_INDUSTRIALIZADO","NativeReferenceName":"Marca do Produto"},{"Column":{"Expression":{"SourceRef":{"Source":"c1"}},"Property":"NU_MAX_AMINOACIDO"},"Name":"Sum(Consulta1 (2).NU_MAX_AMINOACIDO)","NativeReferenceName":"NU_MAX_AMINOACIDO"}]},"Binding":{"Primary":{"Groupings":[{"Projections":[0,1,2]}]},"DataReduction":{"DataVolume":3,"Primary":{"Window":{"Count":500}}},"Version":1},"ExecutionMetricsKind":1}}]}"]',
      QueryId: "",
      ApplicationContext: {
        DatasetId: "2c48de50-1aae-49f1-8e76-3199016e7d36",
        Sources: [
          {
            ReportId: "59c023a1-c18c-4c57-9b56-3059a9a47450",
            VisualId: "e20c397aebdc30a3b404",
          },
        ],
      },
    },
  ],
  cancelQueries: [],
  modelId: 2201537,
};
