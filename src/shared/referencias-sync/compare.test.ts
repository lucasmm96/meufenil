import { describe, expect, it } from "vitest";
import { comparar, derivarOrigemArquivada } from "./compare";
import type { EntradaComparacao } from "./compare";
import type { ArquivadaGlobal, GlobalAtiva, IdentidadeReferencia } from "./types";

/**
 * Comparação §7.3 — matriz linha a linha (ENH-0009): matched | novo | ausente |
 * substituição (auto-aplicada) | reaparição | bloqueio manual.
 */

function base(): EntradaComparacao {
  return { origem: [], ativas: [], arquivadas: [] };
}

function com(parcial: Partial<EntradaComparacao>): EntradaComparacao {
  return { ...base(), ...parcial };
}

function item(nome: string, marca = "", fenil = 100): IdentidadeReferencia {
  return { nome, marca, fenil_mg_por_100g: fenil };
}

function ativa(id: string, nome: string, marca = "", fenil = 100): GlobalAtiva {
  return { id, ...item(nome, marca, fenil) };
}

function arquivada(
  nome: string,
  marca: string,
  fenil: number,
  eventos: { tipo: string; criadoEm: string }[],
): ArquivadaGlobal {
  return { ...item(nome, marca, fenil), eventos };
}

function evento(tipo: string, criadoEm: string): { tipo: string; criadoEm: string } {
  return { tipo, criadoEm };
}

describe("derivarOrigemArquivada (B8(b), §6.4)", () => {
  it("sem eventos decisivos (arquivo legado) → bloqueada_manual", () => {
    expect(derivarOrigemArquivada([])).toBe("bloqueada_manual");
    expect(derivarOrigemArquivada([evento("mudanca_aprovada", "2026-09-01T10:00:00Z")])).toBe(
      "bloqueada_manual",
    );
  });

  it("referencia_arquivada → arquivada_pela_origem", () => {
    expect(
      derivarOrigemArquivada([evento("referencia_arquivada", "2026-09-01T10:00:00Z")]),
    ).toBe("arquivada_pela_origem");
  });

  it("is_ativa_manual e pre_sync_inativa → bloqueada_manual", () => {
    expect(derivarOrigemArquivada([evento("is_ativa_manual", "2026-09-01T10:00:00Z")])).toBe(
      "bloqueada_manual",
    );
    expect(derivarOrigemArquivada([evento("pre_sync_inativa", "2026-09-01T10:00:00Z")])).toBe(
      "bloqueada_manual",
    );
  });

  it("o último evento decisivo vence, independente da ordem da entrada", () => {
    const arquivada10h = evento("referencia_arquivada", "2026-09-01T10:00:00Z");
    const manual11h = evento("is_ativa_manual", "2026-09-01T11:00:00Z");
    const arquivada12h = evento("referencia_arquivada", "2026-09-01T12:00:00Z");

    expect(derivarOrigemArquivada([arquivada10h, manual11h])).toBe("bloqueada_manual");
    expect(derivarOrigemArquivada([manual11h, arquivada10h])).toBe("bloqueada_manual");
    expect(derivarOrigemArquivada([manual11h, arquivada12h])).toBe("arquivada_pela_origem");
    expect(derivarOrigemArquivada([arquivada12h, manual11h])).toBe("arquivada_pela_origem");
  });
});

describe("comparar — matched e equivalentes", () => {
  it("matched: mesma identidade canônica nos dois lados → nada", () => {
    const resultado = comparar(
      com({ origem: [item("Arroz", "Marca A", 100)], ativas: [ativa("a1", "Arroz", "Marca A", 100)] }),
    );

    expect(resultado.equivalentes).toBe(1);
    expect(resultado.itensParaCriar).toEqual([]);
    expect(resultado.ativasParaArquivar).toEqual([]);
  });

  it("matched com variação textual de marca/nome (§7.2 — matching é canônico)", () => {
    const resultado = comparar(
      com({
        origem: [item("feijão", "", 100)],
        ativas: [ativa("a1", "Feijão", "Produto In Natura", 100)],
      }),
    );

    expect(resultado.equivalentes).toBe(1);
    expect(resultado.ativasParaArquivar).toEqual([]);
  });

  it("só o nome+marca canônico com fenil IGUAL é matched (184 ≡ 184.0)", () => {
    const resultado = comparar(
      com({
        origem: [item("Arroz", "", 184.0)],
        ativas: [ativa("a1", "Arroz", "", 184)],
      }),
    );

    expect(resultado.equivalentes).toBe(1);
  });
});

describe("comparar — novo (matriz §7.3)", () => {
  it("item sem correspondência na origem → criar automaticamente", () => {
    const resultado = comparar(com({ origem: [item("Cuscuz", "", 5)] }));

    expect(resultado.itensParaCriar).toEqual([item("Cuscuz", "", 5)]);
    expect(resultado.ativasParaArquivar).toEqual([]);
  });
});

describe("comparar — ausente (matriz §7.3)", () => {
  it("ativa sem correspondência na origem → arquivar com motivo='ausencia'", () => {
    const resultado = comparar(com({ ativas: [ativa("a1", "Feijão Preto", "", 150)] }));

    expect(resultado.ativasParaArquivar).toEqual([
      { ...ativa("a1", "Feijão Preto", "", 150), motivo: "ausencia" },
    ]);
  });

  it("matched nunca é arquivada por ausência", () => {
    const resultado = comparar(
      com({
        origem: [item("Arroz", "Marca A", 100)],
        ativas: [
          ativa("a1", "Arroz", "Marca A", 100),
          ativa("a2", "Feijão", "", 200),
        ],
      }),
    );

    expect(resultado.ativasParaArquivar).toEqual([
      { ...ativa("a2", "Feijão", "", 200), motivo: "ausencia" },
    ]);
  });
});

describe("comparar — substituição (ENH-0009: auto-aplicada, B7/§7.4)", () => {
  it("mesmo nome+marca, fenil diferente → auto-arquiva com motivo='substituicao' e cria novo", () => {
    const resultado = comparar(
      com({
        origem: [item("Arroz", "Marca A", 150)],
        ativas: [ativa("a1", "Arroz", "Marca A", 100)],
      }),
    );

    expect(resultado.itensParaCriar).toEqual([item("Arroz", "Marca A", 150)]);
    expect(resultado.ativasParaArquivar).toEqual([
      { ...ativa("a1", "Arroz", "Marca A", 100), motivo: "substituicao" },
    ]);
  });

  it("alvo da substituição não vira ausência paralela", () => {
    const resultado = comparar(
      com({
        origem: [item("Feijão", "", 150)],
        ativas: [ativa("a1", "Feijão", "Produto In Natura", 100)],
      }),
    );

    expect(resultado.ativasParaArquivar).toEqual([
      { ...ativa("a1", "Feijão", "Produto In Natura", 100), motivo: "substituicao" },
    ]);
    expect(resultado.itensParaCriar).toEqual([item("Feijão", "", 150)]);
  });

  it("candidatas múltiplas: alvo = menor distância de fenil; empate → menor id; demais seguem ausência", () => {
    const resultado = comparar(
      com({
        origem: [item("Arroz", "Marca A", 100)],
        ativas: [
          ativa("b", "Arroz", "Marca A", 140),
          ativa("a", "Arroz", "Marca A", 90),
          ativa("c", "Outro Produto", "", 999),
        ],
      }),
    );

    // distâncias: a(90)=10, b(140)=40 → alvo "a"; "b" fica ausente; "c" ausente.
    const substituicao = resultado.ativasParaArquivar.find((x) => x.motivo === "substituicao");
    const ausencias = resultado.ativasParaArquivar.filter((x) => x.motivo === "ausencia");

    expect(substituicao?.id).toBe("a");
    expect(ausencias.map((x) => x.id).sort()).toEqual(["b", "c"]);
    expect(resultado.itensParaCriar).toEqual([item("Arroz", "Marca A", 100)]);
  });

  it("empate de distância: menor id vence (determinístico)", () => {
    const resultado = comparar(
      com({
        origem: [item("Arroz", "Marca A", 100)],
        ativas: [
          ativa("z", "Arroz", "Marca A", 110),
          ativa("a", "Arroz", "Marca A", 90),
        ],
      }),
    );

    const substituicao = resultado.ativasParaArquivar.find((x) => x.motivo === "substituicao");
    expect(substituicao?.id).toBe("a");
  });
});

describe("comparar — reaparição e bloqueio manual (B8, §17)", () => {
  it("arquivada_pela_origem que reaparece → recria", () => {
    const resultado = comparar(
      com({
        origem: [item("Cuscuz", "", 5)],
        arquivadas: [
          arquivada("Cuscuz", "", 5, [evento("referencia_arquivada", "2026-09-01T10:00:00Z")]),
        ],
      }),
    );

    expect(resultado.itensParaCriar).toEqual([item("Cuscuz", "", 5)]);
    expect(resultado.ativasParaArquivar).toEqual([]);
  });

  it("reaparição com bloqueio manual posterior → silêncio (nunca recria)", () => {
    const resultado = comparar(
      com({
        origem: [item("Cuscuz", "", 5)],
        arquivadas: [
          arquivada("Cuscuz", "", 5, [
            evento("referencia_arquivada", "2026-09-01T10:00:00Z"),
            evento("is_ativa_manual", "2026-09-01T11:00:00Z"),
          ]),
        ],
      }),
    );

    expect(resultado.itensParaCriar).toEqual([]);
    expect(resultado.ativasParaArquivar).toEqual([]);
  });

  it("arquivada legada sem evento (default bloqueada_manual) e pre_sync_inativa → silêncio", () => {
    for (const eventos of [
      [],
      [evento("pre_sync_inativa", "2026-09-01T10:00:00Z")],
    ]) {
      const resultado = comparar(
        com({ origem: [item("Cuscuz", "", 5)], arquivadas: [arquivada("Cuscuz", "", 5, eventos)] }),
      );

      expect(resultado.itensParaCriar).toEqual([]);
      expect(resultado.ativasParaArquivar).toEqual([]);
    }
  });

  it("arquivada com outra identidade não bloqueia o item", () => {
    const resultado = comparar(
      com({
        origem: [item("Cuscuz", "", 5)],
        arquivadas: [arquivada("Cuscuz", "", 50, [evento("is_ativa_manual", "2026-09-01T10:00:00Z")])],
      }),
    );

    expect(resultado.itensParaCriar).toEqual([item("Cuscuz", "", 5)]);
  });

  it("arquivada_pela_origem que NÃO reapareceu não gera ação", () => {
    const resultado = comparar(
      com({ arquivadas: [arquivada("Cuscuz", "", 5, [evento("referencia_arquivada", "2026-09-01T10:00:00Z")])] }),
    );

    expect(resultado.itensParaCriar).toEqual([]);
    expect(resultado.ativasParaArquivar).toEqual([]);
  });
});
