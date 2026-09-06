/**
 * Decode DSR (Data Shape Response) do Power BI — port de `decode.js`
 * (projeto irmão `powerbi-export`, FEAT-0017 B1) com os guardas do
 * design §4.2:
 *
 * - > 32 colunas → erro estrutural (bitmask JS é 32-bit);
 * - desalinhamento máscara↔cursor (valores sobrando/faltando) → erro;
 * - nome de coluna sem resolução (NativeReferenceName/DisplayName →
 *   descriptor → NÃO cai em `N` silenciosamente) → erro;
 * - null-mask `Ø` (U+00D8) preservado byte a byte — nada de re-encoding;
 * - throws estruturais do original mantidos (resposta/DSR/DM0 ausentes).
 *
 * Função pura: `decodeImpl` injetável no extract (DI-friendly, testes sem
 * rede). Retorna as linhas decodificadas — a "matriz" de origem.
 */

import {
  COLUNAS_ORIGEM,
  MAX_COLUNAS_DECODIFICAVEIS,
  type ColunaDecodificada,
  type ItemDescriptor,
  type ItemSelectPayload,
  type LinhaDsrBruta,
  type LinhaOrigem,
  type RespostaPowerBi,
} from "./types";

/** Erro estrutural do DSR (resposta/forma inesperadas — fail-high). */
export class ErroEstruturalDsr extends Error {}

function getPayloadSelectEntries(payload: unknown): ItemSelectPayload[] {
  const root = payload as {
    queries?: Array<{ Query?: { Commands?: unknown[] } }>;
  } | null;
  const commands = root?.queries?.[0]?.Query?.Commands ?? [];

  const semanticQueryCommand = (
    commands.find(
      (command) =>
        (command as { SemanticQueryDataShapeCommand?: unknown })
          ?.SemanticQueryDataShapeCommand
    ) as { SemanticQueryDataShapeCommand?: { Query?: { Select?: unknown } } } | undefined
  )?.SemanticQueryDataShapeCommand;

  return (semanticQueryCommand?.Query?.Select as ItemSelectPayload[] | undefined) ?? [];
}

function normalizeName(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function resolveOutputName(
  payloadSelectItem: ItemSelectPayload | undefined,
  descriptorEntry: ItemDescriptor | undefined,
  idColuna: string
): string {
  const payloadAlias = normalizeName(
    payloadSelectItem?.NativeReferenceName || payloadSelectItem?.DisplayName
  );

  if (payloadAlias) {
    return payloadAlias;
  }

  const descriptorName = normalizeName(descriptorEntry?.Name);

  if (descriptorName) {
    return descriptorName;
  }

  // Guarda do port: o fallback silencioso para o id técnico da coluna (`N`,
  // ex. "G0") produziria cabeçalhos sem sentido — nunca usar (design §4.2).
  throw new ErroEstruturalDsr(
    `Coluna "${idColuna}" sem nome resolvido (NativeReferenceName/DisplayName/descriptor ausentes).`
  );
}

function buildColumnDefinitions(
  schema: unknown[],
  descriptor: unknown,
  payload: unknown
): ColunaDecodificada[] {
  const payloadSelect = getPayloadSelectEntries(payload);
  const payloadNameBySource = new Map<string, ItemSelectPayload>();

  for (const item of payloadSelect) {
    const sourceName = item?.Name;

    if (!sourceName) {
      continue;
    }

    payloadNameBySource.set(sourceName, item);
  }

  const descriptorList = Array.isArray(descriptor) ? descriptor : [];

  return schema.map((entry) => {
    const column = entry as { N?: unknown; DN?: unknown };
    const idColuna = String(column.N ?? "");
    const descriptorEntry = (
      descriptorList.find(
        (candidate) =>
          (candidate as ItemDescriptor | undefined)?.Value === idColuna
      ) as ItemDescriptor | undefined
    );
    const descriptorName = descriptorEntry?.Name || idColuna;
    const payloadSelectItem = payloadNameBySource.get(descriptorName);

    return {
      id: idColuna,
      nome: resolveOutputName(payloadSelectItem, descriptorEntry, idColuna),
      dict: column.DN == null ? null : String(column.DN),
    };
  });
}

function normalize(value: unknown): string | number | null {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return value;
  }

  return null;
}

function createResolveDictionary(valueDicts: Record<string, unknown>) {
  return function resolveDictionary(
    dictName: string | null,
    value: unknown
  ): string | number | null {
    if (!dictName) {
      return normalize(value);
    }

    const dict = (valueDicts[dictName] ?? null) as unknown[] | null;

    if (!dict) {
      return normalize(value);
    }

    if (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value < dict.length
    ) {
      return normalize(dict[value]);
    }

    return normalize(value);
  };
}

export function decodeDsr(
  response: RespostaPowerBi | unknown,
  payload: unknown = null
): LinhaOrigem[] {
  const resposta = response as RespostaPowerBi;
  const result = resposta?.results?.[0]?.result?.data;

  if (!result) {
    throw new ErroEstruturalDsr("Resposta Power BI inválida (results[0].result.data ausente).");
  }

  const ds = result?.dsr?.DS?.[0];

  if (!ds) {
    throw new ErroEstruturalDsr("DSR dataset não encontrado.");
  }

  const dm0 = ds?.PH?.[0]?.DM0;

  if (!Array.isArray(dm0) || dm0.length === 0) {
    throw new ErroEstruturalDsr("DM0 não encontrado.");
  }

  const schema = (dm0[0] as LinhaDsrBruta)?.S;

  if (!Array.isArray(schema)) {
    throw new ErroEstruturalDsr("DM0[0].S (schema de colunas) ausente.");
  }

  // Guarda 32-bit: com ≥ 32 colunas `1 << col` transborda (design §4.2).
  if (schema.length > MAX_COLUNAS_DECODIFICAVEIS) {
    throw new ErroEstruturalDsr(
      `Matriz com ${schema.length} colunas excede o limite de ${MAX_COLUNAS_DECODIFICAVEIS} do bitmask 32-bit.`
    );
  }

  // Descriptor vive em results[0].result.descriptor (o primeiro operando do
  // original apontava para .data.descriptor, sempre ausente — mantido o
  // caminho efetivo, sem o ramo morto).
  const descriptor = resposta?.results?.[0]?.result?.descriptor?.Select ?? [];

  // Colunas esperadas: exatamente as 3 do relatório (B9). Nome resolvido via
  // payload/descriptor; a checagem de conjunto acontece na validação (§6.3).
  const resolveDictionary = createResolveDictionary(ds?.ValueDicts ?? {});

  const columns = buildColumnDefinitions(schema, descriptor, payload);
  const rows: LinhaOrigem[] = [];
  let previousRow: Array<string | number | null> = new Array(columns.length).fill(null);

  for (let i = 1; i < dm0.length; i++) {
    const source = dm0[i] as LinhaDsrBruta;
    const row: Array<string | number | null> = [...previousRow];
    let cursor = 0;

    const repeatMask = typeof source.R === "number" ? source.R : 0;
    const nullMask = typeof source["Ø"] === "number" ? source["Ø"] : 0;
    const values = Array.isArray(source.C) ? source.C : [];

    for (let col = 0; col < columns.length; col++) {
      const bit = 1 << col;

      if (nullMask & bit) {
        row[col] = null;
        continue;
      }

      if (repeatMask & bit) {
        continue;
      }

      row[col] = normalize(values[cursor]);
      cursor++;
    }

    // Guarda do port: máscaras que não consomem exatamente os valores
    // enviados indicam DSR fora do contrato — erro, nunca silêncio.
    if (cursor !== values.length) {
      throw new ErroEstruturalDsr(
        `Linha ${i}: máscara consumiu ${cursor} valores, mas a linha traz ${values.length} (desalinhamento máscara↔cursor).`
      );
    }

    const output: LinhaOrigem = {};

    for (let col = 0; col < columns.length; col++) {
      const value = resolveDictionary(columns[col].dict, row[col]);
      output[columns[col].nome] = value;
    }

    rows.push(output);
    previousRow = row;
  }

  return rows;
}

/** Guarda nominal das colunas esperadas (validação estrutural §6.3). */
export function colunasDecodificadas(rows: LinhaOrigem[]): string[] {
  if (rows.length === 0) {
    return [];
  }

  return Object.keys(rows[0]);
}

export function colunasEsperadas(): readonly string[] {
  return COLUNAS_ORIGEM;
}
