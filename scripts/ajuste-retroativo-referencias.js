#!/usr/bin/env node
/**
 * ENH-0012 — Ajuste retroativo de formatação das referências globais para
 * fidelidade verbatim com a ANVISA.
 *
 * Para cada referência global ativa no catálogo, busca correspondente na
 * ANVISA por comparação case-insensitive de nome+marca. Quando encontra,
 * atualiza nome e marca para o valor verbatim da ANVISA. Nunca altera
 * fenil_mg_por_100g. Idempotente.
 *
 * Requisitos (.env.development):
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   POWERBI_RESOURCE_KEY
 *
 * Uso: node scripts/ajuste-retroativo-referencias.js
 *
 * Saída:
 *   stdout — log de progresso + totais (avaliados, atualizados, sem correspondência)
 *   .ai/.temp/ENH-0012-ajuste-retroativo-YYYYMMDD.md — tabela Markdown por item
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadEnvFileIfPresent } from "./cli/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Chaves canônicas (espelho de src/shared/referencias-sync/canonical.ts)
// Usadas SOMENTE para lookup — o valor persistido nunca é normalizado.
// ---------------------------------------------------------------------------

const SEM_MARCA_PARA_CHAVE = new Set([
  "",
  "não se aplica/produto in natura",
  "nao se aplica/produto in natura",
  "não se aplica (produto in natura)",
  "nao se aplica (produto in natura)",
  "produto in natura",
]);

function chaveNome(nome) {
  return nome.trim().toLowerCase();
}

function chaveMarca(marca) {
  const limpa = marca.trim().toLowerCase();
  return SEM_MARCA_PARA_CHAVE.has(limpa) ? "" : limpa;
}

function chaveNomeMarca(nome, marca) {
  return `${chaveNome(nome)}\u0001${chaveMarca(marca)}`;
}

// ---------------------------------------------------------------------------
// Extração Power BI / ANVISA
// (port de src/shared/powerbi/extract.ts + decode.ts — sem normalização de
//  valores, apenas decodificação estrutural do DSR)
// ---------------------------------------------------------------------------

const QUERY_DATA_URL =
  "https://wabi-brazil-south-api.analysis.windows.net/public/reports/querydata?synchronous=true";

const COUNT_PATCH_APLICADO = 30000;

const QUERY_PAYLOAD = {
  version: "1.0.0",
  queries: [
    {
      Query: {
        Commands: [
          {
            SemanticQueryDataShapeCommand: {
              Query: {
                Version: 2,
                From: [{ Name: "c1", Entity: "Consulta", Type: 0 }],
                Select: [
                  {
                    Column: {
                      Expression: { SourceRef: { Source: "c1" } },
                      Property: "DS_NOME",
                    },
                    Name: "Consulta1 (2).DS_NOME",
                    NativeReferenceName: "Nome do Produto",
                  },
                  {
                    Column: {
                      Expression: { SourceRef: { Source: "c1" } },
                      Property: "DS_MARCA_INDUSTRIALIZADO",
                    },
                    Name: "Consulta1 (2).DS_MARCA_INDUSTRIALIZADO",
                    NativeReferenceName: "Marca do Produto",
                  },
                  {
                    Column: {
                      Expression: { SourceRef: { Source: "c1" } },
                      Property: "NU_MAX_AMINOACIDO",
                    },
                    Name: "Sum(Consulta1 (2).NU_MAX_AMINOACIDO)",
                    NativeReferenceName: "NU_MAX_AMINOACIDO",
                  },
                ],
              },
              Binding: {
                Primary: { Groupings: [{ Projections: [0, 1, 2] }] },
                DataReduction: {
                  DataVolume: 3,
                  Primary: { Window: { Count: 500 } },
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

// --- DSR decoder (port de src/shared/powerbi/decode.ts) ---

function getPayloadSelectEntries(payload) {
  const commands = payload?.queries?.[0]?.Query?.Commands ?? [];
  const cmd = commands.find((c) => c?.SemanticQueryDataShapeCommand);
  return cmd?.SemanticQueryDataShapeCommand?.Query?.Select ?? [];
}

function normalizeName(value) {
  return typeof value === "string" ? value.trim() : "";
}

function resolveOutputName(payloadSelectItem, descriptorEntry, idColuna) {
  const alias = normalizeName(
    payloadSelectItem?.NativeReferenceName || payloadSelectItem?.DisplayName
  );
  if (alias) return alias;
  const desc = normalizeName(descriptorEntry?.Name);
  if (desc) return desc;
  throw new Error(`Coluna "${idColuna}" sem nome resolvido`);
}

function buildColumnDefinitions(schema, descriptor, payload) {
  const payloadSelect = getPayloadSelectEntries(payload);
  const bySource = new Map();
  for (const item of payloadSelect) {
    if (item?.Name) bySource.set(item.Name, item);
  }
  const descriptorList = Array.isArray(descriptor) ? descriptor : [];
  return schema.map((entry) => {
    const idColuna = String(entry.N ?? "");
    const descriptorEntry = descriptorList.find((c) => c?.Value === idColuna);
    const descriptorName = descriptorEntry?.Name || idColuna;
    const payloadSelectItem = bySource.get(descriptorName);
    return {
      id: idColuna,
      nome: resolveOutputName(payloadSelectItem, descriptorEntry, idColuna),
      dict: entry.DN == null ? null : String(entry.DN),
    };
  });
}

function normalizeValue(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return value;
  return null;
}

function createResolveDictionary(valueDicts) {
  return function (dictName, value) {
    if (!dictName) return normalizeValue(value);
    const dict = valueDicts[dictName] ?? null;
    if (!dict) return normalizeValue(value);
    if (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value < dict.length
    ) {
      return normalizeValue(dict[value]);
    }
    return normalizeValue(value);
  };
}

function decodeDsr(response, payload) {
  const result = response?.results?.[0]?.result?.data;
  if (!result) throw new Error("Resposta Power BI inválida (results[0].result.data ausente)");
  const ds = result?.dsr?.DS?.[0];
  if (!ds) throw new Error("DSR dataset não encontrado");
  const dm0 = ds?.PH?.[0]?.DM0;
  if (!Array.isArray(dm0) || dm0.length === 0) throw new Error("DM0 não encontrado");
  const schema = dm0[0]?.S;
  if (!Array.isArray(schema)) throw new Error("DM0[0].S ausente");
  if (schema.length > 32)
    throw new Error(`${schema.length} colunas excedem o limite de 32 do bitmask 32-bit`);

  const descriptor =
    result?.descriptor?.Select ??
    response?.results?.[0]?.result?.descriptor?.Select ??
    [];
  const resolveDictionary = createResolveDictionary(ds?.ValueDicts ?? {});
  const columns = buildColumnDefinitions(schema, descriptor, payload);
  const rows = [];
  let previousRow = new Array(columns.length).fill(null);

  for (let i = 1; i < dm0.length; i++) {
    const source = dm0[i];
    const row = [...previousRow];
    let cursor = 0;
    const repeatMask = typeof source.R === "number" ? source.R : 0;
    const nullMask = typeof source["Ø"] === "number" ? source["Ø"] : 0;
    const values = Array.isArray(source.C) ? source.C : [];

    for (let col = 0; col < columns.length; col++) {
      const bit = 1 << col;
      if (nullMask & bit) { row[col] = null; continue; }
      if (repeatMask & bit) continue;
      row[col] = normalizeValue(values[cursor]);
      cursor++;
    }

    if (cursor !== values.length) {
      throw new Error(
        `Linha ${i}: máscara consumiu ${cursor} valores, mas a linha traz ${values.length}`
      );
    }

    const output = {};
    for (let col = 0; col < columns.length; col++) {
      output[columns[col].nome] = resolveDictionary(columns[col].dict, row[col]);
    }
    rows.push(output);
    previousRow = row;
  }
  return rows;
}

// --- Extrator (port de src/shared/powerbi/extract.ts) ---

async function extrairAnvisa(resourceKey) {
  const clone = JSON.parse(JSON.stringify(QUERY_PAYLOAD));
  const janela =
    clone?.queries?.[0]?.Query?.Commands?.[0]?.SemanticQueryDataShapeCommand
      ?.Binding?.DataReduction?.Primary?.Window;
  if (!janela) {
    throw new Error("Payload sem Binding.DataReduction.Primary.Window — patch de volume não aplicado");
  }
  janela.Count = COUNT_PATCH_APLICADO;

  const response = await fetch(QUERY_DATA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      Accept: "application/json",
      "X-PowerBI-ResourceKey": resourceKey,
    },
    body: JSON.stringify(clone),
  });

  if (!response.ok) {
    throw new Error(`Falha na extração Power BI: HTTP ${response.status} ${response.statusText}`);
  }

  const corpo = await response.json();
  return decodeDsr(corpo, QUERY_PAYLOAD);
}

// ---------------------------------------------------------------------------
// Paginação
// ---------------------------------------------------------------------------

const TAMANHO_PAGINA = 1000;

async function buscarTodasAsLinhas(executar) {
  const linhas = [];
  for (let from = 0; ; from += TAMANHO_PAGINA) {
    const { data, error } = await executar(from, from + TAMANHO_PAGINA - 1);
    if (error) throw error;
    const pagina = data ?? [];
    linhas.push(...pagina);
    if (pagina.length < TAMANHO_PAGINA) break;
  }
  return linhas;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  loadEnvFileIfPresent(".env.development");

  const supabaseUrl = requireEnv("VITE_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const resourceKey = requireEnv("POWERBI_RESOURCE_KEY");

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Extrair ANVISA em tempo real
  console.log("[ENH-0012] Extraindo dados da ANVISA em tempo real...");
  const linhasAnvisa = await extrairAnvisa(resourceKey);
  console.log(`[ENH-0012] Extração concluída: ${linhasAnvisa.length} itens.`);

  // 2. Monta lookup: chaveNomeMarca → verbatim ANVISA { nome, marca }
  // Mantém apenas a 1ª ocorrência de cada chave (mesma política do motor M3).
  const lookupAnvisa = new Map();
  for (const linha of linhasAnvisa) {
    const nome = typeof linha["Nome do Produto"] === "string" ? linha["Nome do Produto"] : "";
    const marca = typeof linha["Marca do Produto"] === "string" ? linha["Marca do Produto"] : "";
    if (!nome) continue;
    const chave = chaveNomeMarca(nome, marca);
    if (!lookupAnvisa.has(chave)) {
      lookupAnvisa.set(chave, { nome, marca });
    }
  }

  // 3. Buscar todas as referências globais ativas
  console.log("[ENH-0012] Buscando referências globais ativas...");
  const globaisAtivas = await buscarTodasAsLinhas((from, to) =>
    supabase
      .from("referencias")
      .select("id, nome, marca, fenil_mg_por_100g")
      .eq("is_global", true)
      .eq("is_ativa", true)
      .range(from, to)
  );
  console.log(`[ENH-0012] Referências globais ativas: ${globaisAtivas.length}`);

  // 4. Avaliar cada referência
  const relatorio = [];
  let atualizadas = 0;
  let semCorrespondencia = 0;
  let jaVerbatim = 0;

  for (const ref of globaisAtivas) {
    const marca = ref.marca ?? "";
    const chave = chaveNomeMarca(ref.nome, marca);
    const verbatim = lookupAnvisa.get(chave);

    if (!verbatim) {
      relatorio.push({
        id: ref.id,
        antes: `nome: "${ref.nome}" / marca: "${marca}"`,
        depois: "(sem correspondência — mantido)",
      });
      semCorrespondencia++;
      continue;
    }

    const nomeIgual = ref.nome === verbatim.nome;
    const marcaIgual = marca === verbatim.marca;

    if (nomeIgual && marcaIgual) {
      // Já verbatim — idempotência: sem UPDATE
      relatorio.push({
        id: ref.id,
        antes: `nome: "${ref.nome}" / marca: "${marca}"`,
        depois: `nome: "${verbatim.nome}" / marca: "${verbatim.marca}"`,
      });
      jaVerbatim++;
      continue;
    }

    const { error } = await supabase
      .from("referencias")
      .update({ nome: verbatim.nome, marca: verbatim.marca, updated_at: new Date().toISOString() })
      .eq("id", ref.id)
      .eq("is_global", true)
      .eq("is_ativa", true);

    if (error) {
      throw new Error(`Falha ao atualizar referência ${ref.id}: ${error.message}`);
    }

    relatorio.push({
      id: ref.id,
      antes: `nome: "${ref.nome}" / marca: "${marca}"`,
      depois: `nome: "${verbatim.nome}" / marca: "${verbatim.marca}"`,
    });
    atualizadas++;
  }

  // 5. Log stdout
  console.log("\n[ENH-0012] Resumo:");
  console.log(`  Avaliados:                ${globaisAtivas.length}`);
  console.log(`  Atualizados (verbatim):   ${atualizadas}`);
  console.log(`  Já verbatim (sem update): ${jaVerbatim}`);
  console.log(`  Sem correspondência ANVISA: ${semCorrespondencia}`);

  // 6. Relatório .ai/.temp/ENH-0012-ajuste-retroativo-YYYYMMDD.md
  const dataHoje = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const tempDir = path.resolve(REPO_ROOT, ".ai", ".temp");
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const relatorioPath = path.join(tempDir, `ENH-0012-ajuste-retroativo-${dataHoje}.md`);

  const linhasTabela = relatorio.map(
    (r) => `| ${r.id} | ${r.antes} | ${r.depois} |`
  );

  const conteudo = [
    `# ENH-0012 — Relatório de Ajuste Retroativo`,
    ``,
    `**Data:** ${new Date().toISOString().slice(0, 10)}`,
    `**Total avaliado:** ${globaisAtivas.length}`,
    `**Atualizados (verbatim):** ${atualizadas}`,
    `**Já verbatim (sem update):** ${jaVerbatim}`,
    `**Sem correspondência ANVISA:** ${semCorrespondencia}`,
    ``,
    `| id | antes (nome / marca) | depois (nome / marca) |`,
    `|---|---|---|`,
    ...linhasTabela,
  ].join("\n");

  fs.writeFileSync(relatorioPath, conteudo, "utf8");
  console.log(`\n[ENH-0012] Relatório: ${relatorioPath}`);
}

main().catch((erro) => {
  console.error(`[ENH-0012] ERRO: ${erro.message}`);
  process.exit(1);
});
