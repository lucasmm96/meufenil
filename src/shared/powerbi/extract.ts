/**
 * Extração do relatório Power BI/ANVISA — port de `fetch.js`/`export.js`
 * (projeto irmão `powerbi-export`, FEAT-0017 B1) + fail-high do patch
 * `Window.Count` (D-1/design §4.2).
 *
 * Contrato:
 * - resource key NUNCA hardcoded: exigida via parâmetro (a rota lê de
 *   `POWERBI_RESOURCE_KEY`); ausente → erro explícito de configuração;
 * - patch `Window.Count` 500 → 30000 aplicado numa CLONE do payload; se a
 *   janela não existir no payload, a extração FALHA antes do fetch (nunca
 *   processar 500 linhas como volume real);
 * - `fetchImpl`/`decodeImpl` injetáveis (DI-friendly, testes sem rede);
 * - resposta HTTP não-ok → erro explícito (`status statusText`).
 */

import { decodeDsr } from "./decode";
import { QUERY_PAYLOAD, type PayloadConsultaPowerBi } from "./query-payload";
import type { LinhaOrigem } from "./types";

export const QUERY_DATA_URL =
  "https://wabi-brazil-south-api.analysis.windows.net/public/reports/querydata?synchronous=true";

/** Volume real garantido pelo patch (default da fonte era 500 linhas). */
export const COUNT_PATCH_APLICADO = 30000;

/** Falha técnica/configuração da extração (fail-high). */
export class ErroExtracaoPowerBi extends Error {}

export type RespostaFetch = {
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
};

export type FetchPowerBi = (url: string, init: {
  method: string;
  headers: Record<string, string>;
  body: string;
}) => Promise<RespostaFetch>;

export type DecodePowerBi = (response: unknown, payload: unknown) => LinhaOrigem[];

export type OpcoesExtracao = {
  /** Query payload do relatório (default: fixture versionada do monorepo). */
  payload?: unknown;
  /** Resource key pública do recurso — obrigatória (nunca hardcoded). */
  resourceKey: string;
  /** Override do endpoint (testes). */
  url?: string;
  fetchImpl?: FetchPowerBi;
  decodeImpl?: DecodePowerBi;
};

export type ResultadoExtracao = {
  /** Linhas decodificadas (brutas, sem validação de conteúdo). */
  rows: LinhaOrigem[];
  /** true quando o patch `Window.Count` → 30000 foi aplicado. */
  patchAplicado: boolean;
  contagem: number;
};

async function fetchPadrao(url: string, init: {
  method: string;
  headers: Record<string, string>;
  body: string;
}): Promise<RespostaFetch> {
  const response = await fetch(url, init);

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    json: () => response.json(),
  };
}

function clonarPayload(payload: unknown): unknown {
  return JSON.parse(JSON.stringify(payload));
}

/**
 * Aplica o patch `Window.Count` num clone do payload e informa se a janela
 * existia (invariante observável para o fail-high da chamada).
 */
export function aplicarPatchJanela(
  payload: PayloadConsultaPowerBi,
  count: number
): { payloadPatch: PayloadConsultaPowerBi; patchAplicado: boolean } {
  const clone = clonarPayload(payload) as PayloadConsultaPowerBi;
  const janela =
    clone?.queries?.[0]?.Query?.Commands?.[0]?.SemanticQueryDataShapeCommand?.Binding
      ?.DataReduction?.Primary?.Window;

  if (janela) {
    janela.Count = count;
    return { payloadPatch: clone, patchAplicado: true };
  }

  return { payloadPatch: clone, patchAplicado: false };
}

export async function extractPowerBiReport(
  options: OpcoesExtracao
): Promise<ResultadoExtracao> {
  const payload = options.payload ?? QUERY_PAYLOAD;

  if (!options.resourceKey) {
    throw new ErroExtracaoPowerBi(
      "Resource key do Power BI ausente (configuração: POWERBI_RESOURCE_KEY)."
    );
  }

  // Fail-high (D-1): sem a janela no payload o patch não ocorre e o volume
  // ficaria em 500 linhas silenciosamente — aborta antes do fetch.
  const { payloadPatch, patchAplicado } = aplicarPatchJanela(
    payload as PayloadConsultaPowerBi,
    COUNT_PATCH_APLICADO
  );

  if (!patchAplicado) {
    throw new ErroExtracaoPowerBi(
      "Payload sem Binding.DataReduction.Primary.Window — patch de volume não aplicado (fail-high)."
    );
  }

  const fetchImpl = options.fetchImpl ?? fetchPadrao;
  const decodeImpl = options.decodeImpl ?? decodeDsr;
  const response = await fetchImpl(options.url ?? QUERY_DATA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      Accept: "application/json",
      "X-PowerBI-ResourceKey": options.resourceKey,
    },
    body: JSON.stringify(payloadPatch),
  });

  if (!response.ok) {
    throw new ErroExtracaoPowerBi(
      `Falha na extração Power BI: HTTP ${response.status} ${response.statusText}.`
    );
  }

  const corpo = await response.json();
  const rows = decodeImpl(corpo, payload);

  return { rows, patchAplicado, contagem: rows.length };
}
