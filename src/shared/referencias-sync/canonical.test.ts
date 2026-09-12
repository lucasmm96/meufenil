import { describe, expect, it } from "vitest";
import { chaveFenil, chaveMarca, chaveNome, chaveNomeMarca, chaveRef } from "./canonical";

/**
 * Chave canônica (§7.1/§7.2) — espelho do UNIQUE parcial do banco
 * `lower(trim(both from nome)), lower(trim(both from marca)), fenil
 * numeric(10,2)` (ENH-0004, escala ampliada pela FEAT-0017): "igual no motor"
 * ≡ "igual no índice".
 */

function item(nome: string, marca = "", fenil = 100) {
  return { nome, marca, fenil_mg_por_100g: fenil };
}

describe("chaveNome", () => {
  it("lower(trim) — espaço em volta e caixa são irrelevantes", () => {
    expect(chaveNome("  Arroz  ")).toBe("arroz");
    expect(chaveNome("ARROZ")).toBe("arroz");
    expect(chaveNome(" arroz ")).toBe("arroz");
  });

  it("preserva acentuação (lowercase não remove diacríticos)", () => {
    expect(chaveNome("Feijão")).toBe("feijão");
    expect(chaveNome("FEIJÃO")).toBe("feijão");
  });
});

describe("chaveMarca", () => {
  it("espelho de VARIANTES_SEM_MARCA (react-app) → ''", () => {
    expect(chaveMarca("")).toBe("");
    expect(chaveMarca("  ")).toBe("");
    expect(chaveMarca("não se aplica/produto in natura")).toBe("");
    expect(chaveMarca("nao se aplica/produto in natura")).toBe("");
    expect(chaveMarca("não se aplica (produto in natura)")).toBe("");
    expect(chaveMarca("nao se aplica (produto in natura)")).toBe("");
  });

  it("case/trim irrelevantes nas variantes", () => {
    expect(chaveMarca("  PRODUTO IN NATURA ")).toBe("");
    expect(chaveMarca("NÃO SE APLICA/PRODUTO IN NATURA")).toBe("");
    expect(chaveMarca("Produto in natura")).toBe("");
  });

  it("'produto in natura' (extensão §7.2) → ''", () => {
    expect(chaveMarca("Produto In Natura")).toBe("");
    expect(chaveMarca("PRODUTO IN NATURA")).toBe("");
  });

  it("marca real é preservada (lower(trim) apenas)", () => {
    expect(chaveMarca("Marca A")).toBe("marca a");
    expect(chaveMarca("Sem Marca")).toBe("sem marca");
  });
});

describe("chaveFenil", () => {
  it("inteiros e escala ≤2 são idênticos no índice (numeric(10,2))", () => {
    expect(chaveFenil(184)).toBe(184);
    expect(chaveFenil(184.0)).toBe(184);
    expect(chaveFenil(5.4)).toBe(5.4);
    expect(chaveFenil(5.42)).toBe(5.42);
    expect(chaveFenil(0.55)).toBe(0.55);
  });

  it("ruído além da escala 2 arredonda como numeric(10,2)", () => {
    expect(chaveFenil(184.049)).toBe(184.05);
    expect(chaveFenil(184.04)).toBe(184.04);
    expect(chaveFenil(0)).toBe(0);
    expect(chaveFenil(2040)).toBe(2040);
  });
});

describe("chaveRef / chaveNomeMarca", () => {
  it("chaveRef junta as 3 partes canônicas com o separador SOH (byte 001)", () => {
    const soh = String.fromCharCode(1);
    const chave = chaveRef(item("  Arroz  ", "Marca A", 184));

    expect(chave).toBe(`arroz${soh}marca a${soh}184`);
    expect(chave.split(soh)).toHaveLength(3);
  });

  it("marca sem marca ≡ produto in natura (matching §7.2)", () => {
    expect(chaveRef(item("Feijão", "Produto In Natura", 100))).toBe(
      chaveRef(item("feijão", "", 100)),
    );
    expect(chaveRef(item("Feijão", "não se aplica/produto in natura", 100))).toBe(
      chaveRef(item("Feijão", "", 100)),
    );
  });

  it("caixa e espaços de nome equivalem (como lower(trim) do índice)", () => {
    expect(chaveRef(item(" ARROZ ", "", 184.0))).toBe(chaveRef(item("arroz", "", 184)));
  });

  it("fenil 184 ≡ 184.0, e escala difere da chave de outro fenil", () => {
    expect(chaveRef(item("Arroz", "", 184))).toBe(chaveRef(item("Arroz", "", 184.0)));
    expect(chaveRef(item("Arroz", "", 184))).not.toBe(chaveRef(item("Arroz", "", 185)));
    expect(chaveRef(item("Arroz", "", 1))).not.toBe(chaveRef(item("Arroz", "", 10)));
  });

  it("'sem marca' textual NÃO equivale a '' (espelho literal das variantes)", () => {
    expect(chaveMarca("sem marca")).not.toBe(chaveMarca(""));
    expect(chaveRef(item("X", "sem marca", 1))).not.toBe(chaveRef(item("X", "", 1)));
  });

  it("fronteira entre campos não colide (concatenação é injetiva)", () => {
    expect(chaveNomeMarca(item("AB", "", 1))).not.toBe(chaveNomeMarca(item("A", "B", 1)));
    expect(chaveRef(item("AB", "", 1))).not.toBe(chaveRef(item("A", "B", 1)));
    expect(chaveRef(item("Arroz", "", 2))).not.toBe(chaveRef(item("Arroz", "2", 2)));
    expect(chaveRef(item("Feijão", "x", 1))).not.toBe(chaveRef(item("Feijão", "x", 12)));
  });

  it("chaveNomeMarca agrupa o que chaveRef separa por fenil", () => {
    const base = chaveNomeMarca(item("Arroz", "Marca A", 100));

    expect(chaveNomeMarca(item("Arroz", "Marca A", 150))).toBe(base);
    expect(chaveNomeMarca(item("Arroz", "Outra Marca", 100))).not.toBe(base);
    expect(chaveRef(item("Arroz", "Marca A", 100))).not.toBe(
      chaveRef(item("Arroz", "Marca A", 150)),
    );
  });
});
