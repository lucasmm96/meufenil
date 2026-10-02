import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RegistroDTO } from "@/react-app/services/registros.service";
import {
  gerarConteudoCSV,
  gerarConteudoJSON,
  exportarCSV,
  exportarJSON,
  derivarPeriodoPDF,
} from "./exportarHistorico";

const registroBase: RegistroDTO = {
  id: "r1",
  data: "2026-01-15",
  peso_g: 100,
  fenil_mg: 5.3,
  created_at: "2026-01-15T12:00:00Z",
  nome_alimento: "Arroz Branco",
};

const registros: RegistroDTO[] = [
  registroBase,
  {
    id: "r2",
    data: "2026-01-20",
    peso_g: 200,
    fenil_mg: 10.0,
    created_at: "2026-01-20T12:00:00Z",
    nome_alimento: 'Feijão "Preto"',
  },
];

describe("gerarConteudoCSV", () => {
  it("produz cabeçalho em pt-BR com separador ponto-e-vírgula", () => {
    const csv = gerarConteudoCSV([registroBase]);
    const [cabecalho] = csv.split("\r\n");
    expect(cabecalho).toBe("Data;Alimento;Peso (g);Fenilalanina (mg)");
  });

  it("formata data em dd/MM/yyyy (TZ pt-BR — sem desvio de fuso)", () => {
    const csv = gerarConteudoCSV([registroBase]);
    const linhas = csv.split("\r\n");
    expect(linhas[1]).toContain("15/01/2026");
  });

  it("inclui nome do alimento, peso e fenilalanina", () => {
    const csv = gerarConteudoCSV([registroBase]);
    const linhas = csv.split("\r\n");
    expect(linhas[1]).toContain("Arroz Branco");
    expect(linhas[1]).toContain("100");
    expect(linhas[1]).toContain("5.3");
  });

  it("escapa aspas duplas no nome do alimento (RFC 4180)", () => {
    const csv = gerarConteudoCSV([registros[1]]);
    const linhas = csv.split("\r\n");
    expect(linhas[1]).toContain('"Feijão ""Preto"""');
  });

  it("usa separador ponto-e-vírgula em todas as colunas", () => {
    const csv = gerarConteudoCSV([registroBase]);
    const linha = csv.split("\r\n")[1];
    const partes = linha.split(";");
    expect(partes.length).toBeGreaterThanOrEqual(4);
  });

  it("array vazio retorna somente cabeçalho", () => {
    const csv = gerarConteudoCSV([]);
    const linhas = csv.split("\r\n");
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toBe("Data;Alimento;Peso (g);Fenilalanina (mg)");
  });

  it("múltiplos registros geram múltiplas linhas", () => {
    const csv = gerarConteudoCSV(registros);
    const linhas = csv.split("\r\n");
    expect(linhas).toHaveLength(3); // cabeçalho + 2 registros
  });
});

describe("gerarConteudoJSON", () => {
  it("produz array com todos os campos obrigatórios", () => {
    const dados = gerarConteudoJSON([registroBase]);
    expect(dados).toHaveLength(1);
    const item = dados[0];
    expect(item).toHaveProperty("data", "2026-01-15");
    expect(item).toHaveProperty("data_formatada", "15/01/2026");
    expect(item).toHaveProperty("nome_alimento", "Arroz Branco");
    expect(item).toHaveProperty("peso_g", 100);
    expect(item).toHaveProperty("fenil_mg", 5.3);
  });

  it("formata data_formatada em dd/MM/yyyy sem desvio de fuso", () => {
    const dados = gerarConteudoJSON([{ ...registroBase, data: "2026-03-01" }]);
    expect(dados[0].data_formatada).toBe("01/03/2026");
  });

  it("preserva data ISO original no campo data", () => {
    const dados = gerarConteudoJSON([registroBase]);
    expect(dados[0].data).toBe("2026-01-15");
  });

  it("array vazio retorna array vazio", () => {
    expect(gerarConteudoJSON([])).toEqual([]);
  });

  it("serializa corretamente para JSON válido", () => {
    const dados = gerarConteudoJSON(registros);
    expect(() => JSON.parse(JSON.stringify(dados))).not.toThrow();
  });

  it("múltiplos registros preservados na ordem recebida", () => {
    const dados = gerarConteudoJSON(registros);
    expect(dados).toHaveLength(2);
    expect(dados[0].data).toBe("2026-01-15");
    expect(dados[1].data).toBe("2026-01-20");
  });
});

describe("gerarConteudoCSV — com opcoes (bloco de metadados)", () => {
  it("inclui linha Paciente com nome do usuário", () => {
    const csv = gerarConteudoCSV([registroBase], { nomeUsuario: "Maria Silva" });
    expect(csv).toContain("Paciente;Maria Silva");
  });

  it("usa 'Não informado' quando nomeUsuario é null", () => {
    const csv = gerarConteudoCSV([registroBase], { nomeUsuario: null });
    expect(csv).toContain("Paciente;Não informado");
  });

  it("inclui linha Período quando período é derivável", () => {
    const csv = gerarConteudoCSV([registroBase], { nomeUsuario: "Maria" });
    expect(csv).toContain("Período;15/01/2026 à 15/01/2026");
  });

  it("inclui linha Período com datas do filtro quando fornecidas", () => {
    const csv = gerarConteudoCSV([registroBase], {
      nomeUsuario: "Maria",
      dataInicio: "2026-01-01",
      dataFim: "2026-01-31",
    });
    expect(csv).toContain("Período;01/01/2026 à 31/01/2026");
  });

  it("inclui linha Gerado em", () => {
    const csv = gerarConteudoCSV([registroBase], { nomeUsuario: "Maria" });
    expect(csv).toContain("Gerado em;");
  });

  it("metadados aparecem antes do cabeçalho da tabela", () => {
    const csv = gerarConteudoCSV([registroBase], { nomeUsuario: "Maria" });
    const idxPaciente = csv.indexOf("Paciente;");
    const idxHeader = csv.indexOf("Data;Alimento");
    expect(idxPaciente).toBeLessThan(idxHeader);
  });

  it("sem opcoes: formato original sem metadados", () => {
    const csv = gerarConteudoCSV([registroBase]);
    expect(csv.startsWith("Data;Alimento")).toBe(true);
  });
});

describe("exportarCSV", () => {
  let mockUrl: string;
  let mockClick: ReturnType<typeof vi.fn>;
  let mockAnchor: { href: string; download: string; click: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockUrl = "blob:mock-url";
    mockClick = vi.fn();
    mockAnchor = { href: "", download: "", click: mockClick };

    vi.spyOn(URL, "createObjectURL").mockReturnValue(mockUrl);
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(document, "createElement").mockReturnValue(mockAnchor as unknown as HTMLElement);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("cria blob CSV e dispara download", () => {
    exportarCSV([registroBase]);
    expect(URL.createObjectURL).toHaveBeenCalledWith(
      expect.objectContaining({ type: "text/csv;charset=utf-8;" })
    );
    expect(mockClick).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockUrl);
  });

  it("nome do arquivo contém 'historico-fenil' e extensão .csv", () => {
    exportarCSV([registroBase]);
    expect(mockAnchor.download).toMatch(/^historico-fenil-.+\.csv$/);
  });

  it("blob contém BOM UTF-8", () => {
    let capturedBlob: Blob | undefined;
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      capturedBlob = blob as Blob;
      return mockUrl;
    });

    exportarCSV([registroBase]);

    expect(capturedBlob).toBeDefined();
    // Verifica que o blob foi criado com conteúdo (BOM + CSV)
    expect(capturedBlob!.size).toBeGreaterThan(3); // BOM = 3 bytes
  });
});

describe("derivarPeriodoPDF", () => {
  const r1 = { ...registroBase, data: "2026-01-15" };
  const r2 = { ...registroBase, id: "r2", data: "2026-03-20" };
  const r3 = { ...registroBase, id: "r3", data: "2026-02-10" };

  it("sem filtro: usa min/max dos registros", () => {
    const periodo = derivarPeriodoPDF([r1, r2, r3], {});
    expect(periodo).not.toBeNull();
    expect(periodo!.inicio).toBe("15/01/2026");
    expect(periodo!.fim).toBe("20/03/2026");
  });

  it("filtro completo: usa as datas do filtro, ignora dados", () => {
    const periodo = derivarPeriodoPDF([r1, r2], { dataInicio: "2026-02-01", dataFim: "2026-02-28" });
    expect(periodo!.inicio).toBe("01/02/2026");
    expect(periodo!.fim).toBe("28/02/2026");
  });

  it("filtro parcial (só início): usa início do filtro e fim dos dados", () => {
    const periodo = derivarPeriodoPDF([r1, r2], { dataInicio: "2026-02-01" });
    expect(periodo!.inicio).toBe("01/02/2026");
    expect(periodo!.fim).toBe("20/03/2026");
  });

  it("filtro parcial (só fim): usa início dos dados e fim do filtro", () => {
    const periodo = derivarPeriodoPDF([r1, r2], { dataFim: "2026-02-28" });
    expect(periodo!.inicio).toBe("15/01/2026");
    expect(periodo!.fim).toBe("28/02/2026");
  });

  it("registros vazios sem filtro: retorna null", () => {
    expect(derivarPeriodoPDF([], {})).toBeNull();
  });

  it("registro único: início e fim são a mesma data", () => {
    const periodo = derivarPeriodoPDF([r1], {});
    expect(periodo!.inicio).toBe("15/01/2026");
    expect(periodo!.fim).toBe("15/01/2026");
  });
});

describe("exportarJSON", () => {
  let mockUrl: string;
  let mockClick: ReturnType<typeof vi.fn>;
  let mockAnchor: { href: string; download: string; click: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockUrl = "blob:mock-json-url";
    mockClick = vi.fn();
    mockAnchor = { href: "", download: "", click: mockClick };

    vi.spyOn(URL, "createObjectURL").mockReturnValue(mockUrl);
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(document, "createElement").mockReturnValue(mockAnchor as unknown as HTMLElement);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("cria blob JSON e dispara download", () => {
    exportarJSON([registroBase]);
    expect(URL.createObjectURL).toHaveBeenCalledWith(
      expect.objectContaining({ type: "application/json;charset=utf-8;" })
    );
    expect(mockClick).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockUrl);
  });

  it("nome do arquivo contém 'historico-fenil' e extensão .json", () => {
    exportarJSON([registroBase]);
    expect(mockAnchor.download).toMatch(/^historico-fenil-.+\.json$/);
  });
});
