import { describe, it, expect } from "vitest";
import { normalizarMarca, extrairMarcaDoNome, nomeComMarca } from "./referencias";

describe("referencias lib (ENH-0004 — modelo de identidade, canônico revisto 2026-09-04)", () => {
  describe("normalizarMarca", () => {
    it("devolve '' para vazio/undefined/null (marca não declarada)", () => {
      expect(normalizarMarca()).toBe("");
      expect(normalizarMarca(undefined)).toBe("");
      expect(normalizarMarca(null)).toBe("");
      expect(normalizarMarca("")).toBe("");
      expect(normalizarMarca("   ")).toBe("");
    });

    it("devolve '' para variantes 'não se aplica/in natura' (significam sem marca)", () => {
      expect(normalizarMarca("Não Se Aplica/Produto In Natura")).toBe("");
      expect(normalizarMarca("nao se aplica/produto in natura")).toBe("");
      expect(normalizarMarca("NÃO SE APLICA (PRODUTO IN NATURA)")).toBe("");
    });

    it("preserva 'Produto In Natura' como marca DECLARADA (decisão 2026-09-04)", () => {
      expect(normalizarMarca("Produto In Natura")).toBe("Produto In Natura");
      expect(normalizarMarca("  Produto In Natura  ")).toBe("Produto In Natura");
    });

    it("preserva marcas reais com trim", () => {
      expect(normalizarMarca("  Tio João  ")).toBe("Tio João");
    });

    it("extrai o conteúdo de um invólucro '(Marca: X)' persistido/digitado (correção 20260904020000)", () => {
      expect(normalizarMarca("(Marca: Nestlé Coco)")).toBe("Nestlé Coco");
      expect(normalizarMarca("(Marca: Sollys)")).toBe("Sollys");
      expect(normalizarMarca("(Marca: Kit Kat (Vegan))")).toBe(
        "Kit Kat (Vegan)"
      );
    });

    it("devolve '' para variantes de sem marca dentro do invólucro", () => {
      expect(normalizarMarca("(Marca: Não Se Aplica/Produto In Natura)")).toBe(
        ""
      );
      expect(normalizarMarca("(Marca: )")).toBe("");
    });

    it("desempilha invólucro repetido até o conteúdo (defesa contra dobra)", () => {
      expect(normalizarMarca("(Marca: (Marca: Sollys))")).toBe("Sollys");
    });

    it("marca que não é invólucro permanece intacta", () => {
      expect(normalizarMarca("Marca X (Genérica)")).toBe("Marca X (Genérica)");
    });
  });

  describe("extrairMarcaDoNome", () => {
    it("nome sem sufixo: mantém nome e marca vazia (não declarada)", () => {
      const r = extrairMarcaDoNome("Banana");
      expect(r.nome).toBe("Banana");
      expect(r.marca).toBe("");
    });

    it("extrai sufixo simples no fim do nome", () => {
      const r = extrairMarcaDoNome("Arroz (Marca: Tio João)");
      expect(r.nome).toBe("Arroz");
      expect(r.marca).toBe("Tio João");
    });

    it("suporta marca com parênteses aninhados (ex.: Kit Kat (Vegan))", () => {
      const r = extrairMarcaDoNome(
        "Wafer recheado coberto com chocolate amargo (Marca: Kit Kat (Vegan))"
      );
      expect(r.nome).toBe("Wafer recheado coberto com chocolate amargo");
      expect(r.marca).toBe("Kit Kat (Vegan)");
    });

    it("remove múltiplas ocorrências e usa a última para a marca", () => {
      const r = extrairMarcaDoNome("Biscoito (Marca: Marca A) (Marca: Marca B)");
      expect(r.nome).toBe("Biscoito");
      expect(r.marca).toBe("Marca B");
    });

    it("devolve '' para sufixo de sem marca (não se aplica/in natura)", () => {
      const r = extrairMarcaDoNome(
        "Maçã (Marca: Não se aplica/Produto in natura)"
      );
      expect(r.nome).toBe("Maçã");
      expect(r.marca).toBe("");
    });

    it("preserva o sufixo 'Produto In Natura' literal como marca declarada", () => {
      const r = extrairMarcaDoNome("Abacate (Marca: Produto In Natura)");
      expect(r.nome).toBe("Abacate");
      expect(r.marca).toBe("Produto In Natura");
    });

    it("colapsa espaços duplos deixados pela remoção (divergência intencional com o SQL)", () => {
      const r = extrairMarcaDoNome("Arroz   (Marca: Tio João)");
      expect(r.nome).toBe("Arroz");
    });
  });

  describe("nomeComMarca", () => {
    it("sem marca (em branco): retorna só o nome", () => {
      expect(nomeComMarca("Banana")).toBe("Banana");
      expect(nomeComMarca("Banana", "")).toBe("Banana");
      expect(nomeComMarca("Banana", "  ")).toBe("Banana");
    });

    it("com marca: monta 'Nome (Marca: X)'", () => {
      expect(nomeComMarca("Arroz", "Tio João")).toBe(
        "Arroz (Marca: Tio João)"
      );
    });

    it("marca 'Produto In Natura' (declarada pela fonte) aparece no sufixo", () => {
      expect(nomeComMarca("Abacate", "Produto In Natura")).toBe(
        "Abacate (Marca: Produto In Natura)"
      );
    });

    it("marca com parênteses internos é exibida íntegra", () => {
      expect(nomeComMarca("Wafer", "Kit Kat (Vegan)")).toBe(
        "Wafer (Marca: Kit Kat (Vegan))"
      );
    });

    it("marca que ainda carrega o invólucro não duplica o prefixo '(Marca:'", () => {
      expect(
        nomeComMarca("Alimento com soja com suco de maracujá", "(Marca: Sollys)")
      ).toBe("Alimento com soja com suco de maracujá (Marca: Sollys)");
    });
  });
});
