/**
 * Validação da extração (FEAT-0017 B9; design §6.3) — abort imediato na 1ª
 * anomalia, sem retry. Ordem dos checks:
 *
 * 1. Estrutura: matriz decodificada com EXATAMENTE as 3 colunas do relatório
 *    (coluna extra/faltante = estrutura inesperada); decode já garante
 *    ≤ 32 colunas e alinhamento máscara↔cursor (decode.ts).
 * 2. Quantidade: 0 linhas aborta SEMPRE; variação vs. linha de base fica
 *    INFORMATIVA até a 1ª extração real calibrar as margens (R5) — registra,
 *    não aborta.
 * 3. Campos/tipos: nome não vazio (nulo aborta); marca string (nulo é
 *    tolerado → equivalente a ''); NU_MAX_AMINOACIDO inteiro 0–2040 (nulo
 *    ou fora da faixa aborta — dado suspeito não arrisca catálogo).
 *    Registro: se a 1ª linha de dados vier com nomes nulos + valor, o flag
 *    `linha1Anomala` entra no resultado (design §4.2/§6.3 — o abort ocorre
 *    pelo nome nulo).
 * 4. Duplicidades: exata (nome+marca+fenil) → contada, dedupe é da
 *    comparação (M3); CONFLITANTE (mesmo nome+marca com fenil diferente) →
 *    invalida a sync (D-10), nada é aplicado.
 *
 * Normalização de chave aqui é espelho local da identidade canônica do banco
 * (lower/trim — ENH-0004); o módulo canônico completo vive no motor (M3).
 */

import { COLUNAS_ORIGEM, FENIL_MAX, FENIL_MIN, type LinhaOrigem } from "./types";

export const CHAVE_COLUNAS_ESPERADAS = [...COLUNAS_ORIGEM].sort();

export type ResultadoQuantidade = {
  total: number;
  /** Margens calibradas com dados reais — [UNKNOWN] até a 1ª extração (R5). */
  status: "informativa";
};

export type ValidacaoExtracao = {
  valida: boolean;
  /** Primeira anomalia (ordem §6.3); null quando valida. */
  motivo: string | null;
  colunas: { esperadas: string[]; encontradas: string[] };
  quantidade: ResultadoQuantidade;
  contagem: {
    duplicadasExatas: number;
    conflitantes: number;
    marcaNulas: number;
    linha1Anomala: boolean;
  };
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
    },
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

  // Check 2 — quantidade: 0 linhas aborta sempre; margem informativa (R5).
  if (rows.length === 0) {
    return {
      ...base,
      valida: false,
      motivo: "Origem sem linhas (0) — extração vazia.",
    };
  }

  // Linha 1 anômala da amostra: nomes nulos + valor presente. Se reaparecer,
  // o abort ocorre pelo check 3 (nome nulo); o flag documenta a forma.
  const primeira = rows[0];
  const primeiraAnomala =
    primeira["Nome do Produto"] == null &&
    fenilNumerico(primeira["NU_MAX_AMINOACIDO"]) !== null;

  // Check 3 — campos/tipos por linha de dados (1-based).
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const numeroLinha = i + 1;
    const nome = row["Nome do Produto"];
    const marca = row["Marca do Produto"];
    const fenil = row["NU_MAX_AMINOACIDO"];

    if (nome == null || (typeof nome === "string" && nome.trim() === "")) {
      return {
        ...base,
        valida: false,
        motivo: `Linha de dados ${numeroLinha}: nome nulo ou vazio.`,
        contagem: { ...base.contagem, linha1Anomala: i === 0 && primeiraAnomala },
      };
    }

    if (typeof nome !== "string") {
      return {
        ...base,
        valida: false,
        motivo: `Linha de dados ${numeroLinha}: nome não é texto (${typeof nome}).`,
      };
    }

    if (marca == null) {
      base.contagem.marcaNulas++;
    } else if (typeof marca !== "string") {
      return {
        ...base,
        valida: false,
        motivo: `Linha de dados ${numeroLinha}: marca não é texto nem nula (${typeof marca}).`,
      };
    }

    const fenilNumero = fenilNumerico(fenil);

    if (fenil == null) {
      return {
        ...base,
        valida: false,
        contagem: { ...base.contagem, linha1Anomala: i === 0 && primeiraAnomala },
        motivo: `Linha de dados ${numeroLinha}: NU_MAX_AMINOACIDO nulo.`,
      };
    }

    if (fenilNumero === null) {
      return {
        ...base,
        valida: false,
        motivo: `Linha de dados ${numeroLinha}: NU_MAX_AMINOACIDO não é inteiro (${String(fenil)}).`,
      };
    }

    if (fenilNumero < FENIL_MIN || fenilNumero > FENIL_MAX) {
      return {
        ...base,
        valida: false,
        motivo:
          `Linha de dados ${numeroLinha}: NU_MAX_AMINOACIDO ${fenilNumero} fora da faixa ` +
          `${FENIL_MIN}–${FENIL_MAX}.`,
      };
    }
  }

  // Check 4 — duplicidades: exatas contadas; conflitantes invalidam (D-10).
  const fenilPorNomeMarca = new Map<string, { fenil: number; linha: number }>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const numeroLinha = i + 1;
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

  return base;
}
