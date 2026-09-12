import { describe, expect, it } from "vitest";
import { validarExtracao } from "./validate";
import type { LinhaOrigem } from "./types";

/**
 * Validação §6.3: abort na ordem estrutura → quantidade bruta → 0 linhas
 * válidas → duplicidades. Anomalias de campo/tipo são rejeições INDIVIDUAIS
 * (reportadas em `rejeitadas`), não abortam o sync. Cobertura por check, com
 * os limites exatos (colunas esperadas, faixa fenil 0–2040, dedupe exata vs.
 * conflitante D-10) e a normalização de marca nula → "".
 */

function linha(nome: string | number | null, marca: string | number | null, fenil: number | string | null): LinhaOrigem {
  return {
    "Nome do Produto": nome,
    "Marca do Produto": marca,
    NU_MAX_AMINOACIDO: fenil,
  };
}

function linhasValidas(): LinhaOrigem[] {
  return [linha("Arroz", "Marca A", 8), linha("Feijão", "Marca B", 12)];
}

describe("validarExtracao", () => {
  it("matriz válida: colunas exatas, quantidade informativa, zero anomalias", () => {
    const validacao = validarExtracao(linhasValidas());

    expect(validacao.valida).toBe(true);
    expect(validacao.motivo).toBeNull();
    expect(validacao.colunas).toEqual({
      esperadas: ["Marca do Produto", "NU_MAX_AMINOACIDO", "Nome do Produto"],
      encontradas: ["Marca do Produto", "NU_MAX_AMINOACIDO", "Nome do Produto"],
    });
    expect(validacao.quantidade).toEqual({ total: 2, status: "informativa" });
    expect(validacao.contagem).toEqual({
      duplicadasExatas: 0,
      conflitantes: 0,
      marcaNulas: 0,
      linha1Anomala: false,
      rejeitadas: 0,
    });
    expect(validacao.rejeitadas).toEqual([]);
    expect(validacao.rowsValidas).toEqual(linhasValidas());
  });

  it("coluna extra → inválida (estrutura inesperada), antes de qualquer outro check", () => {
    const comColunaExtra = linhasValidas();
    comColunaExtra[0] = { ...comColunaExtra[0], ColunaFantasma: 1 } as LinhaOrigem;

    const validacao = validarExtracao(comColunaExtra);

    expect(validacao.valida).toBe(false);
    expect(validacao.motivo).toMatch(/^Estrutura inesperada/);
    expect(validacao.motivo).toMatch(/ColunaFantasma/);
    expect(validacao.rowsValidas).toEqual([]);
  });

  it("coluna faltante → inválida (estrutura inesperada)", () => {
    const faltandoMarca = linhasValidas().map((linha) => {
      const copia = { ...linha };
      delete copia["Marca do Produto"];

      return copia;
    });

    const validacao = validarExtracao(faltandoMarca);

    expect(validacao.valida).toBe(false);
    expect(validacao.motivo).toMatch(/^Estrutura inesperada/);
  });

  it("0 linhas → inválida SEMPRE", () => {
    const validacao = validarExtracao([]);

    expect(validacao.valida).toBe(false);
    expect(validacao.motivo).toMatch(/Origem sem linhas/);
  });

  it("artefato da API na 1ª linha (nome nulo + fenil presente) é rejeitado e as demais seguem válidas", () => {
    const validacao = validarExtracao([linha(null, null, 239), ...linhasValidas()]);

    expect(validacao.valida).toBe(true);
    expect(validacao.motivo).toBeNull();
    expect(validacao.contagem.linha1Anomala).toBe(true);
    expect(validacao.contagem.rejeitadas).toBe(1);
    expect(validacao.rejeitadas).toEqual([
      { linha: 1, nome: null, motivo: "nome nulo ou vazio" },
    ]);
    expect(validacao.rowsValidas).toEqual(linhasValidas());
  });

  it("nome vazio → rejeitada individualmente", () => {
    const validacao = validarExtracao([linha("   ", "Marca A", 8), linha("Feijão", "Marca B", 12)]);

    expect(validacao.valida).toBe(true);
    expect(validacao.contagem.rejeitadas).toBe(1);
    expect(validacao.rejeitadas[0]).toMatchObject({ linha: 1, motivo: "nome nulo ou vazio" });
  });

  it("nome numérico → rejeitada (não é texto)", () => {
    const validacao = validarExtracao([linha(42, "Marca A", 8), linha("Feijão", "Marca B", 12)]);

    expect(validacao.valida).toBe(true);
    expect(validacao.rejeitadas[0]).toMatchObject({ linha: 1, nome: null });
    expect(validacao.rejeitadas[0].motivo).toMatch(/nome não é texto/);
  });

  it("marca numérica → rejeitada (marca não é texto nem nula)", () => {
    const validacao = validarExtracao([linha("Arroz", 42, 8), linha("Feijão", "Marca B", 12)]);

    expect(validacao.valida).toBe(true);
    expect(validacao.rejeitadas[0].motivo).toMatch(/marca não é texto nem nula/);
    expect(validacao.rejeitadas[0].nome).toBe("Arroz");
  });

  it("marca nula é tolerada (contada) e normalizada para string vazia", () => {
    const validacao = validarExtracao([linha("Arroz", null, 8)]);

    expect(validacao.valida).toBe(true);
    expect(validacao.contagem.marcaNulas).toBe(1);
    expect(validacao.contagem.rejeitadas).toBe(0);
    expect(validacao.rowsValidas).toEqual([linha("Arroz", "", 8)]);
  });

  it("fenil decimal é aceito (5.4, 1.5, 0.1); string numérica com ponto ou vírgula também", () => {
    expect(validarExtracao([linha("Arroz", "Marca A", 5.4)]).valida).toBe(true);
    expect(validarExtracao([linha("Arroz", "Marca A", 1.5)]).valida).toBe(true);
    expect(validarExtracao([linha("Arroz", "Marca A", "5.4")]).valida).toBe(true);
    expect(validarExtracao([linha("Arroz", "Marca A", "5,4")]).valida).toBe(true);
    expect(validarExtracao([linha("Arroz", "Marca A", "239")]).valida).toBe(true);
  });

  it("fenil com 2 casas decimais é aceito (limite de numeric(10,2))", () => {
    expect(validarExtracao([linha("Arroz", "Marca A", 0.55)]).valida).toBe(true);
    expect(validarExtracao([linha("Arroz", "Marca A", 2039.99)]).valida).toBe(true);
    expect(validarExtracao([linha("Arroz", "Marca A", "5,42")]).valida).toBe(true);
    // 5.10 e "5.10" valem 5.1 em ponto flutuante — 1 casa, dentro do limite.
    expect(validarExtracao([linha("Arroz", "Marca A", 5.1)]).valida).toBe(true);
    expect(validarExtracao([linha("Arroz", "Marca A", "5.10")]).valida).toBe(true);
  });

  it("fenil com mais de 2 casas decimais → rejeitada, com motivo próprio (≠ não-numérico)", () => {
    const validacao = validarExtracao([
      linha("Arroz", "Marca A", 5.123),
      linha("Feijão", "Marca B", "1,234"),
      linha("Trigo", "Marca C", 8),
    ]);

    expect(validacao.valida).toBe(true);
    expect(validacao.contagem.rejeitadas).toBe(2);
    expect(validacao.rejeitadas[0]).toEqual({
      linha: 1,
      nome: "Arroz",
      motivo: "NU_MAX_AMINOACIDO com mais de 2 casas decimais (5.123)",
    });
    expect(validacao.rejeitadas[1].motivo).toBe(
      "NU_MAX_AMINOACIDO com mais de 2 casas decimais (1.234)",
    );
    expect(validacao.rejeitadas[0].motivo).not.toMatch(/não é numérico/);
    expect(validacao.rowsValidas).toEqual([linha("Trigo", "Marca C", 8)]);
  });

  it("fenil string não numérica → rejeitada", () => {
    const naoNumerica = validarExtracao([linha("Arroz", "Marca A", "abc")]);

    expect(naoNumerica.valida).toBe(false);
    expect(naoNumerica.motivo).toMatch(/Origem sem linhas válidas/);
    expect(naoNumerica.rejeitadas[0].motivo).toMatch(/não é numérico/);
  });

  it("fenil nulo → rejeitada", () => {
    const validacao = validarExtracao([linha("Arroz", "Marca A", null)]);

    expect(validacao.valida).toBe(false);
    expect(validacao.rejeitadas[0]).toMatchObject({
      linha: 1,
      nome: "Arroz",
      motivo: "NU_MAX_AMINOACIDO nulo",
    });
  });

  it("limites da faixa: 0, 0.5 e 2039.9 válidos; −0.1 e 2040.1 rejeitados; motivo inclui valor e faixa", () => {
    expect(validarExtracao([linha("A", null, 0)]).valida).toBe(true);
    expect(validarExtracao([linha("A", null, 0.5)]).valida).toBe(true);
    expect(validarExtracao([linha("A", null, 2040)]).valida).toBe(true);
    expect(validarExtracao([linha("A", null, 2039.9)]).valida).toBe(true);

    const abaixo = validarExtracao([linha("A", null, -0.1)]);
    expect(abaixo.valida).toBe(false);
    expect(abaixo.rejeitadas[0].motivo).toMatch(/fora da faixa 0–2040/);
    expect(abaixo.rejeitadas[0].nome).toBe("A");

    const acima = validarExtracao([linha("A", null, 2040.1)]);
    expect(acima.valida).toBe(false);
    expect(acima.rejeitadas[0].motivo).toMatch(/fora da faixa 0–2040/);
  });

  it("todas as linhas rejeitadas → inválida, com a contagem bruta no motivo", () => {
    const validacao = validarExtracao([linha(null, "Marca A", 8), linha("Arroz", "Marca A", 9999)]);

    expect(validacao.valida).toBe(false);
    expect(validacao.motivo).toMatch(/\(2 brutas, 2 rejeitadas\)/);
    expect(validacao.contagem.rejeitadas).toBe(2);
    expect(validacao.rowsValidas).toEqual([]);
  });

  it("rejeitadas reportam o número da linha ORIGINAL mesmo com rejeições no meio", () => {
    const validacao = validarExtracao([
      linha("Arroz", "Marca A", 8),
      linha(null, "Marca B", 12),
      linha("Feijão", null, 300),
      linha("Trigo", "Marca C", 9999),
    ]);

    expect(validacao.valida).toBe(true);
    expect(validacao.rowsValidas).toEqual([linha("Arroz", "Marca A", 8), linha("Feijão", "", 300)]);
    expect(validacao.rejeitadas.map((r) => r.linha)).toEqual([2, 4]);
  });

  it("linha rejeitada não participa da checagem de duplicidade", () => {
    const validacao = validarExtracao([linha("Arroz", "Marca A", 8), linha("Arroz", "Marca A", 9999)]);

    expect(validacao.valida).toBe(true);
    expect(validacao.contagem.rejeitadas).toBe(1);
    expect(validacao.contagem.conflitantes).toBe(0);
    expect(validacao.rowsValidas).toEqual([linha("Arroz", "Marca A", 8)]);
  });

  it("duplicidade exata é contada, não invalida", () => {
    const validacao = validarExtracao([
      linha("Arroz", "Marca A", 8),
      linha("Arroz", "Marca A", 8),
    ]);

    expect(validacao.valida).toBe(true);
    expect(validacao.contagem.duplicadasExatas).toBe(1);
  });

  it("chave de duplicidade ignora caixa e espaços das bordas", () => {
    const validacao = validarExtracao([
      linha("  Arroz  ", " Marca A ", 8),
      linha("arroz", "marca a", 8),
    ]);

    expect(validacao.valida).toBe(true);
    expect(validacao.contagem.duplicadasExatas).toBe(1);
  });

  it("duplicidade conflitante (mesmo nome+marca, fenil diferente) → inválida (D-10)", () => {
    const validacao = validarExtracao([
      linha("Arroz", "Marca A", 8),
      linha("Arroz", "Marca A", 12),
    ]);

    expect(validacao.valida).toBe(false);
    expect(validacao.motivo).toMatch(/Duplicidade conflitante/);
    expect(validacao.motivo).toMatch(/linha 1\) e 12 \(linha 2\)/);
    expect(validacao.contagem.conflitantes).toBe(1);
    expect(validacao.rowsValidas).toEqual([]);
  });

  it("conflito aponta a linha original quando há rejeição antes", () => {
    const validacao = validarExtracao([
      linha(null, "Marca A", 8),
      linha("Arroz", "Marca A", 8),
      linha("Arroz", "Marca A", 12),
    ]);

    expect(validacao.valida).toBe(false);
    expect(validacao.motivo).toMatch(/8 \(linha 2\) e 12 \(linha 3\)/);
  });

  it("marca nula conflita com marca vazia de outra linha (mesma identidade)", () => {
    const validacao = validarExtracao([
      linha("Arroz", null, 8),
      linha("Arroz", "", 12),
    ]);

    expect(validacao.valida).toBe(false);
    expect(validacao.motivo).toMatch(/Duplicidade conflitante/);
  });

  it("tripla com conflito na 3ª linha: aborta apontando a 1ª ocorrência", () => {
    const validacao = validarExtracao([
      linha("Arroz", "Marca A", 8),
      linha("Feijão", "Marca B", 12),
      linha("arroz", "marca a", 15),
    ]);

    expect(validacao.valida).toBe(false);
    expect(validacao.motivo).toMatch(/8 \(linha 1\) e 15 \(linha 3\)/);
  });
});
