/**
 * Validação da extração (FEAT-0017 B9).
 *
 * Revisão de 2026-09-11: o design original previa abort na 1ª anomalia. A
 * origem real traz artefatos e linhas com campos inválidos que não justificam
 * perder o sync inteiro — anomalias de campo/tipo passam a ser rejeição
 * individual, reportada ao usuário. Comportamento vigente em
 * `.ai/specs/current/backend/api-referencias-sync.md` (estágio 3) e
 * `current/domain/business-rules.md` (BR-039, BR-044).
 *
 * Checks em ordem:
 * 1. Estrutura: conjunto exato de colunas (abort).
 * 2. Quantidade bruta: 0 linhas aborta sempre (abort).
 * 3. Campo/tipo por linha: rejeição INDIVIDUAL — o sync continua com as
 *    linhas restantes; só aborta se não restar nenhuma linha válida.
 *    - Nome nulo/vazio → rejeita (reporta ao usuário).
 *    - NU_MAX_AMINOACIDO nulo, não-inteiro ou fora de 0–2040 → rejeita.
 *    - Marca nula → normaliza para "" (produto sem marca declarada).
 *    - Marca não-string → rejeita.
 * 4. Duplicidades sobre linhas válidas: exatas contadas; conflitantes
 *    invalidam o sync inteiro (D-10).
 *
 * Normalização de chave aqui é espelho local da identidade canônica do banco
 * (lower/trim — ENH-0004); o módulo canônico completo vive no motor (M3).
 */

import { COLUNAS_ORIGEM, FENIL_MAX, FENIL_MIN, type LinhaOrigem } from "./types.js";

export const CHAVE_COLUNAS_ESPERADAS = [...COLUNAS_ORIGEM].sort();

export type ResultadoQuantidade = {
  total: number;
  /** Margens calibradas com dados reais — [UNKNOWN] até a 1ª extração (R5). */
  status: "informativa";
};

export type RowRejeitada = {
  /** 1-based. */
  linha: number;
  /** Nome do produto se disponível na linha bruta; null quando o próprio nome é inválido. */
  nome: string | null;
  motivo: string;
};

export type ValidacaoExtracao = {
  valida: boolean;
  /** Motivo de abort total (estrutura, 0 linhas válidas, conflito); null quando valida. */
  motivo: string | null;
  colunas: { esperadas: string[]; encontradas: string[] };
  quantidade: ResultadoQuantidade;
  contagem: {
    duplicadasExatas: number;
    conflitantes: number;
    marcaNulas: number;
    linha1Anomala: boolean;
    /** Linhas rejeitadas individualmente no check 3. */
    rejeitadas: number;
  };
  /** Linhas rejeitadas individualmente (reportadas ao usuário). */
  rejeitadas: RowRejeitada[];
  /**
   * Linhas válidas e normalizadas (null marca → ""), prontas para snapshot e
   * inserção. Vazio quando `valida` é false.
   */
  rowsValidas: LinhaOrigem[];
};

function chaveNome(nome: string): string {
  return nome.trim().toLowerCase();
}

function chaveMarca(marca: string): string {
  return marca.trim().toLowerCase();
}

function fenilNumerico(valor: unknown): number | null {
  if (typeof valor === "number" && Number.isInteger(valor)) {
    return valor;
  }

  if (typeof valor === "string" && /^\d+$/.test(valor.trim())) {
    return Number.parseInt(valor, 10);
  }

  return null;
}

export function validarExtracao(rows: LinhaOrigem[]): ValidacaoExtracao {
  const colunasEncontradas = rows.length > 0 ? Object.keys(rows[0]).sort() : [];
  const base: ValidacaoExtracao = {
    valida: true,
    motivo: null,
    colunas: {
      esperadas: CHAVE_COLUNAS_ESPERADAS,
      encontradas: colunasEncontradas,
    },
    quantidade: { total: rows.length, status: "informativa" },
    contagem: {
      duplicadasExatas: 0,
      conflitantes: 0,
      marcaNulas: 0,
      linha1Anomala: false,
      rejeitadas: 0,
    },
    rejeitadas: [],
    rowsValidas: [],
  };

  // Check 1 — estrutura: conjunto exato de colunas (B9).
  if (
    rows.length > 0 &&
    JSON.stringify(colunasEncontradas) !== JSON.stringify(CHAVE_COLUNAS_ESPERADAS)
  ) {
    return {
      ...base,
      valida: false,
      motivo:
        `Estrutura inesperada: colunas [${colunasEncontradas.join(", ")}] ` +
        `≠ esperadas [${CHAVE_COLUNAS_ESPERADAS.join(", ")}].`,
    };
  }

  // Check 2 — quantidade bruta: 0 linhas aborta sempre.
  if (rows.length === 0) {
    return {
      ...base,
      valida: false,
      motivo: "Origem sem linhas (0) — extração vazia.",
    };
  }

  // Linha 1 anômala da amostra real: nome=null + fenil presente (artefato API).
  const primeira = rows[0];
  const primeiraAnomala =
    primeira["Nome do Produto"] == null &&
    fenilNumerico(primeira["NU_MAX_AMINOACIDO"]) !== null;

  // Check 3 — campos/tipos: rejeição INDIVIDUAL (não aborta o sync).
  // Linhas inválidas entram em `rejeitadas`; o sync continua com `rowsValidas`.
  const rowsValidas: LinhaOrigem[] = [];
  // Linha original (1-based) de cada entrada de rowsValidas — as rejeições
  // deslocam os índices, então a posição no array não serve como número de linha.
  const linhasValidas: number[] = [];
  const rejeitadas: RowRejeitada[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const numeroLinha = i + 1;
    const nome = row["Nome do Produto"];
    const marca = row["Marca do Produto"];
    const fenil = row["NU_MAX_AMINOACIDO"];

    if (nome == null || (typeof nome === "string" && nome.trim() === "")) {
      if (i === 0 && primeiraAnomala) base.contagem.linha1Anomala = true;
      rejeitadas.push({ linha: numeroLinha, nome: null, motivo: "nome nulo ou vazio" });
      continue;
    }

    if (typeof nome !== "string") {
      rejeitadas.push({
        linha: numeroLinha,
        nome: null,
        motivo: `nome não é texto (${typeof nome})`,
      });
      continue;
    }

    // Marca nula: produto sem marca declarada — normaliza para "" (ponto 2 B9).
    if (marca == null) {
      base.contagem.marcaNulas++;
    } else if (typeof marca !== "string") {
      rejeitadas.push({
        linha: numeroLinha,
        nome: nome.trim(),
        motivo: `marca não é texto nem nula (${typeof marca})`,
      });
      continue;
    }

    if (fenil == null) {
      rejeitadas.push({
        linha: numeroLinha,
        nome: nome.trim(),
        motivo: "NU_MAX_AMINOACIDO nulo",
      });
      continue;
    }

    const fenilNumero = fenilNumerico(fenil);

    if (fenilNumero === null) {
      rejeitadas.push({
        linha: numeroLinha,
        nome: nome.trim(),
        motivo: `NU_MAX_AMINOACIDO não é inteiro (${String(fenil)})`,
      });
      continue;
    }

    if (fenilNumero < FENIL_MIN || fenilNumero > FENIL_MAX) {
      rejeitadas.push({
        linha: numeroLinha,
        nome: nome.trim(),
        motivo:
          `NU_MAX_AMINOACIDO ${fenilNumero} fora da faixa ` +
          `${FENIL_MIN}–${FENIL_MAX}`,
      });
      continue;
    }

    // Linha válida: normaliza null marca → "" e inclui nas válidas.
    rowsValidas.push({
      ...row,
      "Marca do Produto": marca == null ? "" : marca,
    });
    linhasValidas.push(numeroLinha);
  }

  base.contagem.rejeitadas = rejeitadas.length;
  base.rejeitadas = rejeitadas;

  if (rowsValidas.length === 0) {
    return {
      ...base,
      valida: false,
      motivo:
        `Origem sem linhas válidas ` +
        `(${rows.length} brutas, ${rejeitadas.length} rejeitadas).`,
    };
  }

  // Check 4 — duplicidades sobre linhas válidas (D-10).
  const fenilPorNomeMarca = new Map<string, { fenil: number; linha: number }>();

  for (let i = 0; i < rowsValidas.length; i++) {
    const row = rowsValidas[i];
    const numeroLinha = linhasValidas[i];
    const nome = row["Nome do Produto"] as string;
    const marcaRaw = row["Marca do Produto"];
    const marca = marcaRaw == null ? "" : (marcaRaw as string);
    const fenil = fenilNumerico(row["NU_MAX_AMINOACIDO"]) as number;
    const chaveDuplicidade = `${chaveNome(nome)}\u0000${chaveMarca(marca)}`;
    const existente = fenilPorNomeMarca.get(chaveDuplicidade);

    if (existente) {
      if (existente.fenil === fenil) {
        base.contagem.duplicadasExatas++;
      } else {
        return {
          ...base,
          valida: false,
          contagem: { ...base.contagem, conflitantes: 1 },
          motivo:
            `Duplicidade conflitante: "${nome.trim()}" / "${marca.trim()}" com ` +
            `NU_MAX_AMINOACIDO ${existente.fenil} (linha ${existente.linha}) e ${fenil} (linha ${numeroLinha}).`,
        };
      }
    } else {
      fenilPorNomeMarca.set(chaveDuplicidade, { fenil, linha: numeroLinha });
    }
  }

  base.rowsValidas = rowsValidas;
  return base;
}
