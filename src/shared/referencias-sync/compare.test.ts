import { describe, expect, it } from "vitest";
import { comparar, derivarModoSync, derivarOrigemArquivada } from "./compare";
import type { EntradaComparacao } from "./compare";
import type { ArquivadaGlobal, GlobalAtiva, IdentidadeReferencia, ModoSync } from "./types";

/**
 * Comparação §7.3 — matriz linha a linha: matched | novo | ausente |
 * substituição | reaparição | bloqueio manual | pendência aberta (D-6) |
 * re-apresentação pós-rejeição (decisão humana 2026-09-06) | bootstrap.
 */

function base(modo: ModoSync = "pos_bootstrap"): EntradaComparacao {
  return { origem: [], ativas: [], arquivadas: [], pendenciasAbertas: [], decisoes: [], modo };
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

describe("derivarModoSync (§14.1/§14.4 — 1ª sync × sync confiável)", () => {
  it("nenhuma sync anterior → bootstrap", () => {
    expect(derivarModoSync([])).toBe("bootstrap");
  });

  it("histórico sem extração válida concluída → bootstrap", () => {
    expect(derivarModoSync([{ status: "failure" }])).toBe("bootstrap");
    expect(derivarModoSync([{ status: "origin_invalid" }])).toBe("bootstrap");
    expect(derivarModoSync([{ status: "running" }])).toBe("bootstrap");
    expect(derivarModoSync([{ status: "failure" }, { status: "origin_invalid" }])).toBe(
      "bootstrap",
    );
  });

  it("sync anterior com extração válida concluída → pos_bootstrap", () => {
    expect(derivarModoSync([{ status: "success" }])).toBe("pos_bootstrap");
    expect(derivarModoSync([{ status: "pending_review" }])).toBe("pos_bootstrap");
    expect(
      derivarModoSync([{ status: "failure" }, { status: "origin_invalid" }, { status: "success" }]),
    ).toBe("pos_bootstrap");
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
    expect(resultado.pendencias).toEqual([]);
  });

  it("matched com variação textual de marca/nome (§7.2 — matching é canônico)", () => {
    const resultado = comparar(
      com({
        origem: [item("feijão", "", 100)],
        ativas: [ativa("a1", "Feijão", "Produto In Natura", 100)],
      }),
    );

    expect(resultado.equivalentes).toBe(1);
    expect(resultado.pendencias).toEqual([]);
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
  it("pós-bootstrap: item sem correspondência → criar", () => {
    const resultado = comparar(com({ origem: [item("Cuscuz", "", 5)] }));

    expect(resultado.itensParaCriar).toEqual([item("Cuscuz", "", 5)]);
    expect(resultado.pendencias).toEqual([]);
  });

  it("bootstrap: 1ª sync — zero auto, tudo vira pendência new_item", () => {
    const resultado = comparar(com({ modo: "bootstrap", origem: [item("Cuscuz", "", 5)] }));

    expect(resultado.itensParaCriar).toEqual([]);
    expect(resultado.pendencias).toEqual([
      { tipo: "new_item", referencia_id: null, proposta: item("Cuscuz", "", 5), diff: null },
    ]);
  });
});

describe("comparar — ausente (matriz §7.3)", () => {
  it("pós-bootstrap: ativa sem correspondência na origem → arquivar", () => {
    const resultado = comparar(com({ ativas: [ativa("a1", "Feijão Preto", "", 150)] }));

    expect(resultado.ativasParaArquivar).toEqual([ativa("a1", "Feijão Preto", "", 150)]);
    expect(resultado.pendencias).toEqual([]);
  });

  it("bootstrap: ausência vira pendência, nunca auto-arquiva", () => {
    const resultado = comparar(com({ modo: "bootstrap", ativas: [ativa("a1", "Feijão Preto", "", 150)] }));

    expect(resultado.ativasParaArquivar).toEqual([]);
    expect(resultado.pendencias).toEqual([
      { tipo: "absence", referencia_id: "a1", proposta: null, diff: null },
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

    expect(resultado.ativasParaArquivar).toEqual([ativa("a2", "Feijão", "", 200)]);
  });
});

describe("comparar — substituição (B7/§7.4: sempre pendência)", () => {
  it("mesmo nome+marca, fenil diferente → pendência substitution nos DOIS modos", () => {
    const resultadoPos = comparar(
      com({
        origem: [item("Arroz", "Marca A", 150)],
        ativas: [ativa("a1", "Arroz", "Marca A", 100)],
      }),
    );
    const resultadoBootstrap = comparar(
      com({
        modo: "bootstrap",
        origem: [item("Arroz", "Marca A", 150)],
        ativas: [ativa("a1", "Arroz", "Marca A", 100)],
      }),
    );

    const pendenciaEsperada = [
      {
        tipo: "substitution" as const,
        referencia_id: "a1",
        proposta: item("Arroz", "Marca A", 150),
        diff: [{ campo: "fenil_mg_por_100g", antes: 100, depois: 150 }],
      },
    ];

    expect(resultadoPos.itensParaCriar).toEqual([]);
    expect(resultadoPos.ativasParaArquivar).toEqual([]);
    expect(resultadoPos.pendencias).toEqual(pendenciaEsperada);
    expect(resultadoBootstrap.pendencias).toEqual(pendenciaEsperada);
  });

  it("diff é verbatim (nome/marca raw) e o alvo não vira ausência", () => {
    const resultado = comparar(
      com({
        origem: [item("Feijão", "", 150)],
        ativas: [ativa("a1", "Feijão", "Produto In Natura", 100)],
      }),
    );

    expect(resultado.pendencias).toEqual([
      {
        tipo: "substitution",
        referencia_id: "a1",
        proposta: item("Feijão", "", 150),
        diff: [
          { campo: "marca", antes: "Produto In Natura", depois: "" },
          { campo: "fenil_mg_por_100g", antes: 100, depois: 150 },
        ],
      },
    ]);
    expect(resultado.ativasParaArquivar).toEqual([]);
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
    expect(resultado.pendencias).toEqual([
      {
        tipo: "substitution",
        referencia_id: "a",
        proposta: item("Arroz", "Marca A", 100),
        diff: [{ campo: "fenil_mg_por_100g", antes: 90, depois: 100 }],
      },
    ]);
    expect(resultado.ativasParaArquivar).toEqual([
      ativa("b", "Arroz", "Marca A", 140),
      ativa("c", "Outro Produto", "", 999),
    ]);
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

    expect(resultado.pendencias[0]?.referencia_id).toBe("a");
  });
});

describe("comparar — reaparição e bloqueio manual (B8, §17)", () => {
  it("arquivada_pela_origem que reaparece → recria (pós-bootstrap)", () => {
    const resultado = comparar(
      com({
        origem: [item("Cuscuz", "", 5)],
        arquivadas: [
          arquivada("Cuscuz", "", 5, [evento("referencia_arquivada", "2026-09-01T10:00:00Z")]),
        ],
      }),
    );

    expect(resultado.itensParaCriar).toEqual([item("Cuscuz", "", 5)]);
    expect(resultado.pendencias).toEqual([]);
  });

  it("bootstrap: reaparição segue o fluxo do novo (pendência, zero auto)", () => {
    const resultado = comparar(
      com({
        modo: "bootstrap",
        origem: [item("Cuscuz", "", 5)],
        arquivadas: [
          arquivada("Cuscuz", "", 5, [evento("referencia_arquivada", "2026-09-01T10:00:00Z")]),
        ],
      }),
    );

    expect(resultado.itensParaCriar).toEqual([]);
    expect(resultado.pendencias).toEqual([
      { tipo: "new_item", referencia_id: null, proposta: item("Cuscuz", "", 5), diff: null },
    ]);
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
    expect(resultado.pendencias).toEqual([]);
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
      expect(resultado.pendencias).toEqual([]);
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
    expect(resultado.pendencias).toEqual([]);
  });
});

describe("comparar — pendência aberta suprime (D-6)", () => {
  it("absence open no alvo: sem auto-arquivo e sem pendência nova", () => {
    const resultado = comparar(
      com({
        ativas: [ativa("a1", "Feijão Preto", "", 150)],
        pendenciasAbertas: [{ tipo: "absence", referencia_id: "a1", proposta: null }],
      }),
    );

    expect(resultado.ativasParaArquivar).toEqual([]);
    expect(resultado.pendencias).toEqual([]);
  });

  it("new_item open com a MESMA proposta: sem criação e sem pendência nova", () => {
    const proposta = item("Cuscuz", "", 5);
    const resultado = comparar(
      com({
        origem: [proposta],
        pendenciasAbertas: [{ tipo: "new_item", referencia_id: null, proposta }],
      }),
    );

    expect(resultado.itensParaCriar).toEqual([]);
    expect(resultado.pendencias).toEqual([]);
  });

  it("substitution open cobre o alvo: origem não gera nada; outras ausências seguem", () => {
    const resultado = comparar(
      com({
        origem: [item("Arroz", "Marca A", 150)],
        ativas: [
          ativa("a1", "Arroz", "Marca A", 100),
          ativa("c", "Outro Produto", "", 999),
        ],
        pendenciasAbertas: [{ tipo: "substitution", referencia_id: "a1", proposta: item("Arroz", "Marca A", 150) }],
      }),
    );

    expect(resultado.itensParaCriar).toEqual([]);
    expect(resultado.pendencias).toEqual([]);
    expect(resultado.ativasParaArquivar).toEqual([ativa("c", "Outro Produto", "", 999)]);
  });

  it("pendência aberta de outra divergência não suprime esta", () => {
    const resultado = comparar(
      com({
        origem: [item("Cuscuz", "", 5)],
        pendenciasAbertas: [{ tipo: "new_item", referencia_id: null, proposta: item("Outro", "", 7) }],
      }),
    );

    expect(resultado.itensParaCriar).toEqual([item("Cuscuz", "", 5)]);
  });
});

describe("comparar — re-apresentação pós-rejeição (decisão humana 2026-09-06)", () => {
  it("ausência rejeitada: nunca auto-arquiva; divergência volta como pendência", () => {
    const resultado = comparar(
      com({
        ativas: [ativa("a1", "Feijão Preto", "", 150)],
        decisoes: [{ tipo: "absence", referencia_id: "a1", proposta: null, status: "rejected" }],
      }),
    );

    expect(resultado.ativasParaArquivar).toEqual([]);
    expect(resultado.pendencias).toEqual([
      { tipo: "absence", referencia_id: "a1", proposta: null, diff: null },
    ]);
  });

  it("new_item rejeitado: nunca cria automático; divergência volta como pendência", () => {
    const proposta = item("Cuscuz", "", 5);
    const resultado = comparar(
      com({
        origem: [proposta],
        decisoes: [{ tipo: "new_item", referencia_id: null, proposta, status: "rejected" }],
      }),
    );

    expect(resultado.itensParaCriar).toEqual([]);
    expect(resultado.pendencias).toEqual([
      { tipo: "new_item", referencia_id: null, proposta, diff: null },
    ]);
  });

  it("decisão approved não suprime auto (sem memória especial de aprovado)", () => {
    const resultado = comparar(
      com({
        ativas: [ativa("a1", "Feijão Preto", "", 150)],
        decisoes: [{ tipo: "absence", referencia_id: "a1", proposta: null, status: "approved" }],
      }),
    );

    expect(resultado.ativasParaArquivar).toEqual([ativa("a1", "Feijão Preto", "", 150)]);
    expect(resultado.pendencias).toEqual([]);
  });

  it("rejeição de outra divergência não suprime esta", () => {
    const resultado = comparar(
      com({
        ativas: [ativa("a1", "Feijão Preto", "", 150)],
        decisoes: [
          { tipo: "absence", referencia_id: "a2", proposta: null, status: "rejected" },
        ],
      }),
    );

    expect(resultado.ativasParaArquivar).toEqual([ativa("a1", "Feijão Preto", "", 150)]);
  });

  it("última decisão cronológica vence (approved depois de rejected reautoriza)", () => {
    const resultado = comparar(
      com({
        ativas: [ativa("a1", "Feijão Preto", "", 150)],
        decisoes: [
          { tipo: "absence", referencia_id: "a1", proposta: null, status: "rejected" },
          { tipo: "absence", referencia_id: "a1", proposta: null, status: "approved" },
        ],
      }),
    );

    expect(resultado.ativasParaArquivar).toEqual([ativa("a1", "Feijão Preto", "", 150)]);
    expect(resultado.pendencias).toEqual([]);
  });
});
