import type { ReactNode } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Referencias from "./Referencias";

vi.mock("@/react-app/components/Layout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@skeletons", () => ({
  LayoutSkeleton: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ReferenciasSkeleton: () => <div data-testid="referencias-skeleton" />,
}));

vi.mock("@/react-app/context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/react-app/hooks/useUsuarioAtivo", () => ({
  useUsuarioAtivo: vi.fn(),
}));

vi.mock("@/react-app/hooks/useLayoutPerfil", () => ({
  useLayoutPerfil: vi.fn(),
}));

vi.mock("@/react-app/hooks/useReferencias", () => ({
  useReferencias: vi.fn(),
}));

import { useAuth } from "@/react-app/context/AuthContext";
import { useUsuarioAtivo } from "@/react-app/hooks/useUsuarioAtivo";
import { useLayoutPerfil } from "@/react-app/hooks/useLayoutPerfil";
import { useReferencias } from "@/react-app/hooks/useReferencias";

const refPropria = {
  id: "ref-1",
  nome: "Arroz",
  fenil_mg_por_100g: 25.5,
  is_ativa: true,
  is_global: false,
  is_favorita: false,
  criado_por: "user-1",
};

const refGlobalDeOutro = {
  id: "ref-2",
  nome: "Feijão",
  fenil_mg_por_100g: 30,
  is_ativa: true,
  is_global: true,
  is_favorita: false,
  criado_por: "admin-1",
};

describe("Referencias page", () => {
  const useAuthMock = useAuth as unknown as ReturnType<typeof vi.fn>;
  const useUsuarioAtivoMock = useUsuarioAtivo as unknown as ReturnType<typeof vi.fn>;
  const useLayoutPerfilMock = useLayoutPerfil as unknown as ReturnType<typeof vi.fn>;
  const useReferenciasMock = useReferencias as unknown as ReturnType<typeof vi.fn>;
  let alertSpy: ReturnType<typeof vi.spyOn>;
  let confirmSpy: ReturnType<typeof vi.spyOn>;

  function setupAuth(overrides: Record<string, unknown> = {}) {
    useAuthMock.mockReturnValue({
      authUser: { id: "user-1" },
      ready: true,
      ...overrides,
    });
  }

  function setupUsuarioAtivo(overrides: Record<string, unknown> = {}) {
    useUsuarioAtivoMock.mockReturnValue({
      usuarioAtivoId: "user-1",
      ...overrides,
    });
  }

  function setupLayoutPerfil(overrides: Record<string, unknown> = {}) {
    useLayoutPerfilMock.mockReturnValue({
      perfil: { id: "user-1", role: "user" },
      ...overrides,
    });
  }

  function setupReferencias(overrides: Record<string, unknown> = {}) {
    const state = {
      data: [refPropria, refGlobalDeOutro],
      loading: false,
      error: null,
      search: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      activate: vi.fn(),
      deactivate: vi.fn(),
      remove: vi.fn(),
      ordenarPor: "nome",
      setOrdenarPor: vi.fn(),
      toggleFavoritoReferencia: vi.fn(),
      searchTerm: "",
      ...overrides,
    };
    useReferenciasMock.mockReturnValue(state);
    return state;
  }

  // linha da tabela desktop a partir do nome (mobile e desktop renderizam o nome)
  function tableRow(nome: string) {
    return screen.getAllByText(nome)[1].closest("tr")!;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    setupAuth();
    setupUsuarioAtivo();
    setupLayoutPerfil();
    setupReferencias();
  });

  it("mostra skeleton enquanto o auth não está pronto", () => {
    setupAuth({ ready: false });
    render(<Referencias />);

    expect(screen.getByTestId("referencias-skeleton")).toBeTruthy();
  });

  it("mostra estado vazio com atalho para criar", () => {
    setupReferencias({ data: [] });
    render(<Referencias />);

    expect(
      screen.getByText("Nenhuma referência cadastrada ainda")
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Criar primeira referência" })
    );
    expect(screen.getByText("Nova Referência")).toBeTruthy();
  });

  it("mostra erro de carregamento", () => {
    setupReferencias({ error: new Error("falhou"), data: [] });
    render(<Referencias />);

    expect(screen.getByText("Erro ao carregar referências")).toBeTruthy();
  });

  it("mostra overlay de loading sobre a lista", () => {
    setupReferencias({ loading: true });
    const { container } = render(<Referencias />);

    expect(container.querySelector(".animate-spin")).toBeTruthy();
    // lista anterior permanece visível durante o loading
    expect(screen.getAllByText("Arroz").length).toBeGreaterThan(0);
  });

  it("renderiza a tabela com valores, tipo e contagem", () => {
    render(<Referencias />);

    // nome aparece no card mobile e na tabela desktop
    expect(screen.getAllByText("Arroz").length).toBe(2);
    expect(screen.getAllByText("Feijão").length).toBe(2);
    // desktop mostra "25.5"; mobile mostra "25.5 mg" (textos diferentes)
    expect(screen.getAllByText("25.5").length).toBe(1);
    expect(screen.getAllByText("25.5 mg").length).toBe(1);
    expect(screen.getAllByText("30.0").length).toBe(1);
    expect(screen.getAllByText("30.0 mg").length).toBe(1);
    expect(screen.getAllByText("Global").length).toBe(1);
    expect(screen.getAllByText("Customizada").length).toBe(1);
    expect(screen.getByText("Total: 2 registros")).toBeTruthy();
  });

  it("exibe a coluna Marca ao lado de Nome — marca real, invólucro normalizado e '—' para marca em branco", () => {
    setupReferencias({
      data: [
        { ...refPropria, marca: "Tio João" },
        { ...refGlobalDeOutro, marca: "(Marca: Feijão Carioca)" },
        { ...refPropria, id: "ref-3", nome: "Maçã", criado_por: "user-1" },
      ],
    });
    render(<Referencias />);

    // coluna Marca logo após a coluna Nome (desktop)
    const cabecalhos = screen
      .getAllByRole("columnheader")
      .map((h) => h.textContent?.trim());
    expect(cabecalhos.indexOf("Nome")).toBeLessThan(cabecalhos.indexOf("Marca"));

    // desktop: nome limpo na coluna Nome e marca em coluna própria
    const linhas = screen.getAllByRole("row");
    const linhaArroz = linhas.find((l) => within(l).queryByText("Arroz"))!;
    expect(within(linhaArroz).getByText("Tio João")).toBeTruthy();
    expect(within(linhaArroz).queryByText("Arroz (Marca: Tio João)")).toBeNull();

    // regressão do bug do invólucro: marca persistida "(Marca: X)" aparece como X
    const linhaFeijao = linhas.find((l) => within(l).queryByText("Feijão"))!;
    expect(within(linhaFeijao).getByText("Feijão Carioca")).toBeTruthy();
    expect(within(linhaFeijao).queryByText("(Marca: Feijão Carioca)")).toBeNull();

    // marca não declarada (em branco): '—' na coluna Marca
    const linhaMaca = linhas.find((l) => within(l).queryByText("Maçã"))!;
    expect(within(linhaMaca).getByText("—")).toBeTruthy();
  });

  it("pagina os resultados e reseta ao trocar itens por página", () => {
    const refs = Array.from({ length: 25 }, (_, i) => ({
      ...refPropria,
      id: `ref-${i}`,
      nome: `Ref ${i}`,
    }));
    setupReferencias({ data: refs });
    const { container } = render(<Referencias />);

    expect(screen.getByText("Total: 25 registros")).toBeTruthy();
    expect(container.querySelector("strong")?.textContent).toBe("1");
    expect(screen.queryAllByText("Ref 24").length).toBe(0);

    fireEvent.click(screen.getByTitle("Próxima página"));
    expect(container.querySelector("strong")?.textContent).toBe("2");
    expect(screen.getAllByText("Ref 24").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "10" },
    });
    expect(screen.queryAllByText("Ref 24").length).toBe(0);
  });

  it("alterna a ordenação pelo cabeçalho Nome", () => {
    const { setOrdenarPor } = setupReferencias();
    render(<Referencias />);

    fireEvent.click(screen.getByText("Nome"));
    expect(setOrdenarPor).toHaveBeenCalledWith("nome_desc");
  });

  it("ordena por fenilalanina pelo cabeçalho", () => {
    const { setOrdenarPor } = setupReferencias();
    render(<Referencias />);

    fireEvent.click(screen.getByText("Fenilalanina (mg/100g)"));
    expect(setOrdenarPor).toHaveBeenCalledWith("fenil");
  });

  it("busca alimentos com os filtros atuais", () => {
    const { search } = setupReferencias();
    render(<Referencias />);

    fireEvent.change(
      screen.getByPlaceholderText("Digite o nome do alimento..."),
      { target: { value: "arro" } }
    );

    expect(search).toHaveBeenCalledWith("arro", {
      showInativas: false,
      onlyFavoritas: false,
      onlyCustomizadas: false,
    });
  });

  it("limpa a busca pelo botão X", () => {
    const { search } = setupReferencias({ searchTerm: "arro" });
    render(<Referencias />);

    fireEvent.click(screen.getByTitle("Limpar busca"));

    expect(search).toHaveBeenCalledWith("", {
      showInativas: false,
      onlyFavoritas: false,
    });
  });

  it("aplica filtros de inativas, favoritas e customizadas", () => {
    const { search } = setupReferencias();
    render(<Referencias />);

    fireEvent.click(screen.getByLabelText("Mostrar referências inativas"));
    expect(search).toHaveBeenCalledWith("", {
      showInativas: true,
      onlyFavoritas: false,
    });

    fireEvent.click(screen.getByLabelText("Somente favoritas"));
    expect(search).toHaveBeenCalledWith("", {
      showInativas: true,
      onlyFavoritas: true,
    });

    fireEvent.click(screen.getByLabelText("Somente customizadas"));
    expect(search).toHaveBeenCalledWith("", {
      showInativas: true,
      onlyFavoritas: true,
      onlyCustomizadas: true,
    });
  });

  it("cria uma referência pela modal", async () => {
    const { create } = setupReferencias();
    render(<Referencias />);

    fireEvent.click(screen.getByRole("button", { name: "+ Nova Referência" }));
    expect(screen.getByText("Nova Referência")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Ex: Maçã Fuji"), {
      target: { value: "Maçã" },
    });
    fireEvent.change(screen.getByPlaceholderText("Ex: 25.50"), {
      target: { value: "30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      // ENH-0004: nome e marca são atributos separados (marca vazia = canônica).
      expect(create).toHaveBeenCalledWith("Maçã", "", 30);
      expect(alertSpy).toHaveBeenCalledWith("Referência criada com sucesso.");
      expect(screen.queryByText("Nova Referência")).toBeNull();
    });
  });

  it("mantém a modal aberta e alerta quando a referência é duplicada", async () => {
    setupReferencias({
      create: vi.fn().mockRejectedValue({ code: "REFERENCIA_DUPLICADA" }),
    });
    render(<Referencias />);

    fireEvent.click(screen.getByRole("button", { name: "+ Nova Referência" }));
    fireEvent.change(screen.getByPlaceholderText("Ex: Maçã Fuji"), {
      target: { value: "Maçã" },
    });
    fireEvent.change(screen.getByPlaceholderText("Ex: 25.50"), {
      target: { value: "30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "Já existe uma referência ativa com esse nome e marca."
      );
    });
    expect(screen.getByText("Nova Referência")).toBeTruthy();
  });

  it("alerta erro genérico ao falhar em salvar referência", async () => {
    setupReferencias({
      create: vi.fn().mockRejectedValue(new Error("rede")),
    });
    render(<Referencias />);

    fireEvent.click(screen.getByRole("button", { name: "+ Nova Referência" }));
    fireEvent.change(screen.getByPlaceholderText("Ex: Maçã Fuji"), {
      target: { value: "Maçã" },
    });
    fireEvent.change(screen.getByPlaceholderText("Ex: 25.50"), {
      target: { value: "30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Erro ao salvar referência.");
    });
  });

  it("edita uma referência própria pela modal", async () => {
    const { update } = setupReferencias();
    render(<Referencias />);

    const row = tableRow("Arroz");
    fireEvent.click(within(row).getAllByRole("button")[1]); // Edit2

    expect(screen.getByText("Editar Referência")).toBeTruthy();
    expect(screen.getByPlaceholderText("Ex: Maçã Fuji")).toHaveValue("Arroz");

    fireEvent.change(screen.getByPlaceholderText("Ex: Maçã Fuji"), {
      target: { value: "Arroz Integral" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      // ENH-0004: update(id, nome, marca, fenil) — marca preservada do estado.
      expect(update).toHaveBeenCalledWith("ref-1", "Arroz Integral", undefined, 25.5);
      expect(alertSpy).toHaveBeenCalledWith("Referência atualizada com sucesso.");
    });
  });

  it("bloqueia editar e remover referência de outro usuário (não admin)", () => {
    render(<Referencias />);

    const row = tableRow("Feijão");
    const botoes = within(row).getAllByRole("button");
    expect(botoes[1]).toBeDisabled(); // Edit2
    expect(botoes[2]).toBeDisabled(); // Trash2
  });

  it("permite a um admin editar referência global de outro criador", () => {
    setupLayoutPerfil({ perfil: { id: "user-1", role: "admin" } });
    render(<Referencias />);

    const row = tableRow("Feijão");
    expect(within(row).getAllByRole("button")[1]).toBeEnabled();
  });

  it("remove uma referência após confirmação", async () => {
    const { remove } = setupReferencias();
    render(<Referencias />);

    fireEvent.click(within(tableRow("Arroz")).getAllByRole("button")[2]); // Trash2

    await waitFor(() => {
      expect(remove).toHaveBeenCalledWith("ref-1");
      expect(alertSpy).toHaveBeenCalledWith("Referência removida com sucesso.");
    });
  });

  it("não remove quando o usuário cancela o confirm", () => {
    confirmSpy.mockReturnValue(false);
    const { remove } = setupReferencias();
    render(<Referencias />);

    fireEvent.click(within(tableRow("Arroz")).getAllByRole("button")[2]);

    expect(remove).not.toHaveBeenCalled();
  });

  it("avisa que a referência foi DESATIVADA quando a RPC devolve 'deactivated'", async () => {
    const { remove, deactivate } = setupReferencias({
      // ENH-0004: remover_ou_desativar_referencia decide no servidor —
      // com registros associados devolve "deactivated" (nunca exclui).
      remove: vi.fn().mockResolvedValue("deactivated"),
    });
    render(<Referencias />);

    fireEvent.click(within(tableRow("Arroz")).getAllByRole("button")[2]);

    await waitFor(() => {
      expect(remove).toHaveBeenCalledWith("ref-1");
      expect(deactivate).not.toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith(
        expect.stringContaining("DESATIVADA")
      );
    });
  });

  it("alerta erro genérico ao falhar em remover", async () => {
    const { remove } = setupReferencias({
      remove: vi.fn().mockRejectedValue(new Error("rede")),
    });
    render(<Referencias />);

    fireEvent.click(within(tableRow("Arroz")).getAllByRole("button")[2]);

    await waitFor(() => {
      expect(remove).toHaveBeenCalledWith("ref-1");
      expect(alertSpy).toHaveBeenCalledWith("Erro ao remover referência.");
    });
  });

  it("reabilita uma referência inativa após confirmação", async () => {
    const { activate } = setupReferencias({
      data: [{ ...refPropria, is_ativa: false }],
    });
    render(<Referencias />);

    const row = tableRow("Arroz");
    fireEvent.click(within(row).getAllByRole("button")[3]); // RotateCcw

    await waitFor(() => {
      expect(activate).toHaveBeenCalledWith("ref-1");
    });
  });

  it("bloqueia editar e remover referência inativa", () => {
    setupReferencias({
      data: [{ ...refPropria, is_ativa: false }],
    });
    render(<Referencias />);

    const botoes = within(tableRow("Arroz")).getAllByRole("button");
    expect(botoes[1]).toBeDisabled();
    expect(botoes[2]).toBeDisabled();
  });

  it("favorita uma referência ativa", () => {
    const { toggleFavoritoReferencia } = setupReferencias();
    render(<Referencias />);

    fireEvent.click(within(tableRow("Arroz")).getAllByRole("button")[0]); // Star

    expect(toggleFavoritoReferencia).toHaveBeenCalledWith("ref-1");
  });

  it("não permite favoritar referência inativa", () => {
    const { toggleFavoritoReferencia } = setupReferencias({
      data: [{ ...refPropria, is_ativa: false }],
    });
    render(<Referencias />);

    fireEvent.click(within(tableRow("Arroz")).getAllByRole("button")[0]);

    expect(toggleFavoritoReferencia).not.toHaveBeenCalled();
  });
});
