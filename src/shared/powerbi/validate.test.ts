import { describe, expect, it } from "vitest";
import { validarExtracao } from "./validate";
import type { LinhaOrigem } from "./types";

/**
 * Validação §6.3: abort na 1ª anomalia, na ordem estrutura → quantidade →
 * campos → duplicidades. Cobertura por check, com os limites exatos
 * (colunas esperadas, faixa fenil 0–2040, dedupe exata vs. conflitante D-10).
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
    });
  });

  it("coluna extra → inválida (estrutura inesperada), antes de qualquer outro check", () => {
    const comColunaExtra = linhasValidas();
    comColunaExtra[0] = { ...comColunaExtra[0], ColunaFantasma: 1 } as LinhaOrigem;

    const validacao = validarExtracao(comColunaExtra);

    expect(validacao.valida).toBe(false);
    expect(validacao.motivo).toMatch(/^Estrutura inesperada/);
    expect(validacao.motivo).toMatch(/ColunaFantasma/);
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

  it("nome nulo na 1ª linha com fenil presente → inválida + flag linha1Anomala", () => {
    const segunda = linhasValidas()[1];
    const validacao = validarExtracao([linha(null, "Marca A", 8), segunda]);

    expect(validacao.valida).toBe(false);
    expect(validacao.motivo).toMatch(/Linha de dados 1: nome nulo ou vazio/);
    expect(validacao.contagem.linha1Anomala).toBe(true);
  });

  it("nome vazio → inválida", () => {
    const validacao = validarExtracao([linha("   ", "Marca A", 8)]);

    expect(validacao.valida).toBe(false);
    expect(validacao.motivo).toMatch(/nome nulo ou vazio/);
  });

  it("nome numérico → inválida (não é texto)", () => {
    const validacao = validarExtracao([linha(42, "Marca A", 8)]);

    expect(validacao.valida).toBe(false);
    expect(validacao.motivo).toMatch(/nome não é texto/);
  });

  it("marca numérica → inválida (marca não é texto nem nula)", () => {
    const validacao = validarExtracao([linha("Arroz", 42, 8)]);

    expect(validacao.valida).toBe(false);
    expect(validacao.motivo).toMatch(/marca não é texto nem nula/);
  });

  it("marca nula é tolerada (contada), linhas válidas", () => {
    const validacao = validarExtracao([linha("Arroz", null, 8)]);

    expect(validacao.valida).toBe(true);
    expect(validacao.contagem.marcaNulas).toBe(1);
  });

  it("fenil string numérica é aceita; string não numérica → inválida", () => {
    const comString = validarExtracao([linha("Arroz", "Marca A", "239")]);
    expect(comString.valida).toBe(true);
    expect(comString.quantidade.total).toBe(1);

    const naoNumerica = validarExtracao([linha("Arroz", "Marca A", "abc")]);
    expect(naoNumerica.valida).toBe(false);
    expect(naoNumerica.motivo).toMatch(/não é inteiro/);
  });

  it("fenil decimal → inválida (não é inteiro)", () => {
    const validacao = validarExtracao([linha("Arroz", "Marca A", 1.5)]);

    expect(validacao.valida).toBe(false);
    expect(validacao.motivo).toMatch(/não é inteiro/);
  });

  it("fenil nulo → inválida", () => {
    const validacao = validarExtracao([linha("Arroz", "Marca A", null)]);

    expect(validacao.valida).toBe(false);
    expect(validacao.motivo).toMatch(/NU_MAX_AMINOACIDO nulo/);
  });

  it("limites da faixa: 0 e 2040 válidos; −1 e 2041 inválidos", () => {
    expect(validarExtracao([linha("A", null, 0)]).valida).toBe(true);
    expect(validarExtracao([linha("A", null, 2040)]).valida).toBe(true);

    const abaixo = validarExtracao([linha("A", null, -1)]);
    expect(abaixo.valida).toBe(false);
    expect(abaixo.motivo).toMatch(/fora da faixa 0–2040/);

    const acima = validarExtracao([linha("A", null, 2041)]);
    expect(acima.valida).toBe(false);
    expect(acima.motivo).toMatch(/fora da faixa 0–2040/);
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
