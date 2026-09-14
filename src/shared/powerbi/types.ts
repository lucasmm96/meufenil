/**
 * Tipos do domínio de extração do relatório Power BI/ANVISA (FEAT-0017).
 *
 * Port do projeto irmão `powerbi-export` (fora do monorepo — B1 decidido em
 * R2, 2026-09-04). Modelagem estrutural mínima das respostas DSR, suficiente
 * para o decode fiel + guardas do design §4.2 — sem dependência externa.
 */

/** As 3 colunas exatas do relatório (B9: estrutura inesperada aborta). */
export const COLUNAS_ORIGEM = [
  "Nome do Produto",
  "Marca do Produto",
  "NU_MAX_AMINOACIDO",
] as const;

/** Linha decodificada: valores escalares (string já trimada, number ou null). */
export type LinhaOrigem = Record<string, string | number | null>;

/** Faixa documentada de NU_MAX_AMINOACIDO na amostra (0–2040; B9). */
export const FENIL_MIN = 0;
export const FENIL_MAX = 2040;

/**
 * Máscaras de bit do DSR são 32-bit em JS — mais colunas quebram o decode
 * silenciosamente (guard estrutural, design §4.2).
 */
export const MAX_COLUNAS_DECODIFICAVEIS = 32;

export type ColunaDecodificada = {
  id: string;
  nome: string;
  dict: string | null;
};

export type ItemSelectPayload = {
  Name?: string;
  NativeReferenceName?: string;
  DisplayName?: string;
};

export type ItemDescriptor = {
  Value?: string;
  Name?: string;
};

export type PayloadPowerBi = {
  queries?: Array<{
    Query?: {
      Commands?: Array<{
        SemanticQueryDataShapeCommand?: {
          Query?: { Select?: ItemSelectPayload[] };
          Binding?: {
            DataReduction?: { Primary?: { Window?: { Count?: number } } };
          };
        };
      }>;
    };
  }>;
};

export type RespostaPowerBi = {
  results?: Array<{
    result?: {
      data?: {
        dsr?: {
          DS?: Array<{
            ValueDicts?: Record<string, unknown>;
            PH?: Array<{ DM0?: unknown[] }>;
          }>;
        };
        /** Descriptor no payload de dados — caminho primário da API real. */
        descriptor?: { Select?: ItemDescriptor[] };
      };
      /** Descriptor alternativo (fora de data) — fallback para variações da API. */
      descriptor?: { Select?: ItemDescriptor[] };
    };
  }>;
};


/** Linha bruta do DSR (DM0): máscaras + valores compactados. */
export type LinhaDsrBruta = {
  S?: unknown[];
  C?: unknown[];
  R?: number;
  [chave: string]: unknown;
};
