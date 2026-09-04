import { describe, it, expect } from "vitest";
import {
  MARCA_SEM_MARCA,
  normalizarMarca,
  extrairMarcaDoNome,
  nomeComMarca,
} from "./referencias";

describe("referencias lib (ENH-0004 — modelo canônico)", () => {
  describe("normalizarMarca", () => {
    it("canonicaliza vazio/undefined/null para 'Produto In Natura'", () => {
      expect(normalizarMarca()).toBe(MARCA_SEM_MARCA);
      expect(normalizarMarca(undefined)).toBe(MARCA_SEM_MARCA);
      expect(normalizarMarca(null)).toBe(MARCA_SEM_MARCA);
      expect(normalizarMarca("")).toBe(MARCA_SEM_MARCA);
      expect(normalizarMarca("   ")).toBe(MARCA_SEM_MARCA);
    });

    it("canonicaliza variantes de in natura (case/acentos-insensitive)", () => {
      expect(normalizarMarca("Não Se Aplica/Produto In Natura")).toBe(
        MARCA_SEM_MARCA
      );
      expect(normalizarMarca("nao se aplica/produto in natura")).toBe(
        MARCA_SEM_MARCA
      );
      expect(normalizarMarca("NÃO SE APLICA (PRODUTO IN NATURA)")).toBe(
        MARCA_SEM_MARCA
      );
    });

    it("preserva marcas reais com trim", () => {
      expect(normalizarMarca("  Tio João  ")).toBe("Tio João");
    });
  });

  describe("extrairMarcaDoNome", () => {
    it("nome sem sufixo: mantém nome e marca vazia (canonicalizada)", () => {
      const r = extrairMarcaDoNome("Banana");
      expect(r.nome).toBe("Banana");
      expect(r.marca).toBe(MARCA_SEM_MARCA);
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

    it("canonicaliza sufixo in natura", () => {
      const r = extrairMarcaDoNome(
        "Maçã (Marca: Não se aplica/Produto in natura)"
      );
      expect(r.nome).toBe("Maçã");
      expect(r.marca).toBe(MARCA_SEM_MARCA);
    });

    it("colapsa espaços duplos deixados pela remoção (divergência intencional com o SQL)", () => {
      const r = extrairMarcaDoNome("Arroz   (Marca: Tio João)");
      expect(r.nome).toBe("Arroz");
    });
  });

  describe("nomeComMarca", () => {
    it("sem marca ou in natura: retorna só o nome", () => {
      expect(nomeComMarca("Banana")).toBe("Banana");
      expect(nomeComMarca("Banana", MARCA_SEM_MARCA)).toBe("Banana");
      expect(nomeComMarca("Banana", "  ")).toBe("Banana");
    });

    it("com marca: monta 'Nome (Marca: X)'", () => {
      expect(nomeComMarca("Arroz", "Tio João")).toBe(
        "Arroz (Marca: Tio João)"
      );
    });

    it("marca com parênteses internos é exibida íntegra", () => {
      expect(nomeComMarca("Wafer", "Kit Kat (Vegan)")).toBe(
        "Wafer (Marca: Kit Kat (Vegan))"
      );
    });
  });
});
