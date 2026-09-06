import { describe, expect, it } from "vitest";
import { construirPlanoSync } from "./engine";
import { PLANO_VERSAO } from "./types";
import type { EntradaPlanoSync } from "./engine";
import type { ArquivadaGlobal, GlobalAtiva, ModoSync } from "./types";
import type { LinhaOrigem } from "../powerbi/types";

/**
 * Engine puro (§7.5): conversão linha→item (marca nula ≡ ''), dedupe de
 * exatas mantendo a 1ª ocorrência, comparação e `p_plano` com resumo.
 * Idempotência (§6.6): 2ª execução com o estado pós-aplicação → zero ops.
 */

function base(modo: ModoSync = "pos_bootstrap"): EntradaPlanoSync {
  return { origem: [], ativas: [], arquivadas: [], pendenciasAbertas: [], decisoes: [], modo };
}

function com(parcial: Partial<EntradaPlanoSync>): EntradaPlanoSync {
  return { ...base(), ...parcial };
}

function linha(nome: string, marca: string | null, fenil: number): LinhaOrigem {
  return {
    "Nome do Produto": nome,
    "Marca do Produto": marca,
    NU_MAX_AMINOACIDO: fenil,
  };
}

function ativa(id: string, nome: string, marca: string, fenil: number): GlobalAtiva {
  return { id, nome, marca, fenil_mg_por_100g: fenil };
}

function arquivada(
  nome: string,
  marca: string,
  fenil: number,
  eventos: { tipo: string; criadoEm: string }[],
): ArquivadaGlobal {
  return { nome, marca, fenil_mg_por_100g: fenil, eventos };
}

describe("construirPlanoSync — p_plano e resumo", () => {
  it("plano pós-bootstrap: matched + novo, com contadores e versão", () => {
    const plano = construirPlanoSync(
      com({
        origem: [linha("Arroz", "Marca A", 8), linha("Feijão", null, 12)],
        ativas: [ativa("a1", "Arroz", "Marca A", 8)],
      }),
    );

    expect(plano.versao).toBe(PLANO_VERSAO);
    expect(plano.modo).toBe("pos_bootstrap");
    expect(plano.criacoes).toEqual([
      { op: "create", identidade: { nome: "Feijão", marca: "", fenil_mg_por_100g: 12 } },
    ]);
    expect(plano.arquivamentos).toEqual([]);
    expect(plano.pendencias).toEqual([]);
    expect(plano.resumo).toEqual({
      totalOrigem: 2,
      equivalentes: 1,
      criadas: 1,
      arquivadas: 0,
      divergencias: 0,
      pendencias: { substitution: 0, absence: 0, new_item: 0 },
    });
  });

  it("bootstrap: tudo vira pendência — zero criações e zero arquivamentos", () => {
    const plano = construirPlanoSync(
      com({
        modo: "bootstrap",
        origem: [linha("Feijão", "", 12)],
        ativas: [ativa("a1", "Arroz", "Marca A", 8)],
      }),
    );

    expect(plano.criacoes).toEqual([]);
    expect(plano.arquivamentos).toEqual([]);
    expect(plano.pendencias).toEqual([
      { tipo: "new_item", referencia_id: null, proposta: { nome: "Feijão", marca: "", fenil_mg_por_100g: 12 }, diff: null },
      { tipo: "absence", referencia_id: "a1", proposta: null, diff: null },
    ]);
    expect(plano.resumo).toEqual({
      totalOrigem: 1,
      equivalentes: 0,
      criadas: 0,
      arquivadas: 0,
      divergencias: 2,
      pendencias: { substitution: 0, absence: 1, new_item: 1 },
    });
  });

  it("dedupe de exatas: 1ª ocorrência vence; totalOrigem conta as linhas cruas", () => {
    const plano = construirPlanoSync(
      com({
        origem: [
          linha("Cuscuz", "Marca X", 5),
          linha("Cuscuz", "Marca X", 5),
          linha(" Cuscuz ", "MARCA X", 5),
        ],
      }),
    );

    expect(plano.criacoes).toHaveLength(1);
    expect(plano.criacoes[0]?.identidade).toEqual({ nome: "Cuscuz", marca: "Marca X", fenil_mg_por_100g: 5 });
    expect(plano.resumo.totalOrigem).toBe(3);
    expect(plano.resumo.equivalentes).toBe(0);
  });

  it("marca nula ≡ marca '' na dedupe e na identidade criada", () => {
    const plano = construirPlanoSync(
      com({
        origem: [linha("Produto", null, 7), linha("Produto", "", 7)],
      }),
    );

    expect(plano.criacoes).toHaveLength(1);
    expect(plano.criacoes[0]?.identidade.marca).toBe("");
  });
});

describe("construirPlanoSync — idempotência (§6.6)", () => {
  it("2ª execução com o estado pós-aplicação → zero operações", () => {
    const origem = [linha("Arroz", "Marca A", 8), linha("Feijão", "", 12)];
    const primeiro = construirPlanoSync(
      com({ origem, ativas: [ativa("a1", "Arroz", "Marca A", 8)] }),
    );

    // Simula a aplicação do plano: cria Feijão (novo id f1) e arquiva a1.
    const estadoPosAplicacao = {
      ativas: [ativa("a1", "Arroz", "Marca A", 8), ativa("f1", "Feijão", "", 12)],
      arquivadas: [] as ArquivadaGlobal[],
    };

    expect(primeiro.criacoes.map((c) => c.identidade)).toEqual([
      { nome: "Feijão", marca: "", fenil_mg_por_100g: 12 },
    ]);

    const segundo = construirPlanoSync(com({ origem, ...estadoPosAplicacao }));

    expect(segundo.criacoes).toEqual([]);
    expect(segundo.arquivamentos).toEqual([]);
    expect(segundo.pendencias).toEqual([]);
    expect(segundo.resumo.equivalentes).toBe(2);
    expect(segundo.resumo.divergencias).toBe(0);
  });

  it("ausência auto-arquivada some das ativas e não reaparece sem origem", () => {
    const origem = [linha("Arroz", "Marca A", 8)];
    const primeiro = construirPlanoSync(
      com({
        origem,
        ativas: [ativa("a1", "Arroz", "Marca A", 8), ativa("b2", "Feijão", "", 12)],
      }),
    );

    expect(primeiro.arquivamentos.map((a) => a.referencia_id)).toEqual(["b2"]);

    const estadoPosAplicacao = {
      ativas: [ativa("a1", "Arroz", "Marca A", 8)],
      arquivadas: [arquivada("Feijão", "", 12, [evento("referencia_arquivada", "2026-09-01T10:00:00Z")])],
    };

    const segundo = construirPlanoSync(com({ origem, ...estadoPosAplicacao }));

    expect(segundo.arquivamentos).toEqual([]);
    expect(segundo.pendencias).toEqual([]);
    expect(segundo.resumo.equivalentes).toBe(1);
  });

  it("item arquivado pela origem que REAPARECE é recriado (novo id — nunca reativa)", () => {
    const origem = [linha("Arroz", "Marca A", 8), linha("Feijão", "", 12)];
    const plano = construirPlanoSync(
      com({
        origem,
        ativas: [ativa("a1", "Arroz", "Marca A", 8)],
        arquivadas: [arquivada("Feijão", "", 12, [evento("referencia_arquivada", "2026-09-01T10:00:00Z")])],
      }),
    );

    expect(plano.criacoes).toHaveLength(1);
    expect(plano.arquivamentos).toEqual([]);
  });
});

/** Helper de evento — só para o teste de idempotência acima. */
function evento(tipo: string, criadoEm: string): { tipo: string; criadoEm: string } {
  return { tipo, criadoEm };
}
