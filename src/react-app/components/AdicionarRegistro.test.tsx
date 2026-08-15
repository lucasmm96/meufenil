import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdicionarRegistro from "./AdicionarRegistro";

vi.mock("@/react-app/context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/react-app/hooks/useReferencias", () => ({
  useReferencias: vi.fn(),
}));

vi.mock("@/react-app/hooks/useCreateRegistro", () => ({
  useCreateRegistro: vi.fn(),
}));

import { useAuth } from "@/react-app/context/AuthContext";
import { useReferencias } from "@/react-app/hooks/useReferencias";
import { useCreateRegistro } from "@/react-app/hooks/useCreateRegistro";

const refMaca = {
  id: "ref-1",
  nome: "Maçã",
  fenil_mg_por_100g: 30,
  is_favorita: false,
  is_ativa: true,
  is_global: true,
  criado_por: "admin-1",
};

const refBanana = {
  id: "ref-2",
  nome: "Banana",
  fenil_mg_por_100g: 40,
  is_favorita: true,
  is_ativa: true,
  is_global: true,
  criado_por: "admin-1",
};

describe("AdicionarRegistro component", () => {
  const useAuthMock = useAuth as unknown as ReturnType<typeof vi.fn>;
  const useReferenciasMock = useReferencias as unknown as ReturnType<typeof vi.fn>;
  const useCreateRegistroMock = useCreateRegistro as unknown as ReturnType<typeof vi.fn>;
  let onClose: ReturnType<typeof vi.fn>;
  let onSuccess: ReturnType<typeof vi.fn>;

  function setupAuth(overrides: Record<string, unknown> = {}) {
    useAuthMock.mockReturnValue({
      ready: true,
      usuarioAtivoId: "user-1",
      timezone: "America/Sao_Paulo",
      ...overrides,
    });
  }

  function setupReferencias(overrides: Record<string, unknown> = {}) {
    const state = {
      data: [refMaca, refBanana],
      loading: false,
      search: vi.fn(),
      create: vi.fn(),
      ...overrides,
    };
    useReferenciasMock.mockReturnValue(state);
    return state;
  }

  function setupRegistro(overrides: Record<string, unknown> = {}) {
    const state = {
      loading: false,
      create: vi.fn(),
      ...overrides,
    };
    useCreateRegistroMock.mockReturnValue(state);
    return state;
  }

  function renderComponent() {
    const view = render(
      <AdicionarRegistro onClose={onClose} onSuccess={onSuccess} />
    );
    return view;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    onClose = vi.fn();
    onSuccess = vi.fn();
    setupAuth();
    setupReferencias();
    setupRegistro();
  });

  it("não renderiza nada enquanto o auth não está pronto", () => {
    setupAuth({ ready: false });
    const { container } = renderComponent();

    expect(container).toBeEmptyDOMElement();
  });

  it("não renderiza nada sem usuário ativo", () => {
    setupAuth({ usuarioAtivoId: null });
    const { container } = renderComponent();

    expect(container).toBeEmptyDOMElement();
  });

  it("busca referências com debounce ao digitar", async () => {
    const { search } = setupReferencias();
    renderComponent();

    fireEvent.change(screen.getByPlaceholderText("Buscar alimento..."), {
      target: { value: "ma" },
    });

    await waitFor(
      () => expect(search).toHaveBeenCalledWith("ma"),
      { timeout: 1000 }
    );
  });

  it("seleciona referência do dropdown e mostra o card de seleção", () => {
    renderComponent();

    fireEvent.focus(screen.getByPlaceholderText("Buscar alimento..."));
    expect(screen.getByRole("button", { name: /Banana/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Maçã/ }));

    // nome fica em span próprio; valor em texto direto do card
    expect(screen.getByText("Maçã")).toBeTruthy();
    expect(screen.getByText(/30.0 mg de fenilalanina por 100g/)).toBeTruthy();
    expect(screen.getByPlaceholderText("Buscar alimento...")).toHaveValue("Maçã");
    // dropdown fecha após selecionar
    expect(screen.queryByRole("button", { name: /Banana/ })).toBeNull();
  });

  it("calcula a fenilalanina a partir do peso informado", async () => {
    renderComponent();

    fireEvent.focus(screen.getByPlaceholderText("Buscar alimento..."));
    fireEvent.click(screen.getByRole("button", { name: /Maçã/ }));

    fireEvent.change(screen.getByPlaceholderText("Ex: 150"), {
      target: { value: "150" },
    });

    // 30 mg/100g × 150g / 100 = 45 mg
    expect(screen.getByText("45.0 mg")).toBeTruthy();
  });

  it("habilita o salvar apenas com referência e peso preenchidos", () => {
    renderComponent();

    const salvar = screen.getByRole("button", { name: "Salvar Registro" });
    expect(salvar).toBeDisabled();

    fireEvent.focus(screen.getByPlaceholderText("Buscar alimento..."));
    fireEvent.click(screen.getByRole("button", { name: /Maçã/ }));
    expect(salvar).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Ex: 150"), {
      target: { value: "150" },
    });
    expect(salvar).toBeEnabled();
  });

  it("mostra estado de salvamento no botão", () => {
    setupRegistro({ loading: true });
    renderComponent();

    const salvar = screen.getByRole("button", { name: "Salvando..." });
    expect(salvar).toBeDisabled();
  });

  it("limpa a referência selecionada pelo X", () => {
    renderComponent();

    fireEvent.focus(screen.getByPlaceholderText("Buscar alimento..."));
    fireEvent.click(screen.getByRole("button", { name: /Maçã/ }));
    expect(screen.getByText(/30.0 mg de fenilalanina/)).toBeTruthy();

    // o X de limpar seleção fica no card da referência selecionada
    const card = screen.getByText(/30.0 mg de fenilalanina/).parentElement!;
    fireEvent.click(within(card).getByRole("button"));

    expect(screen.queryByText(/30.0 mg de fenilalanina/)).toBeNull();
  });

  it("limpa a busca e reabre o dropdown", () => {
    const { search } = setupReferencias();
    renderComponent();

    fireEvent.change(screen.getByPlaceholderText("Buscar alimento..."), {
      target: { value: "ma" },
    });
    // o X de limpar busca fica ao lado do input de busca
    const inputWrapper = screen.getByPlaceholderText(
      "Buscar alimento..."
    ).parentElement!;
    fireEvent.click(within(inputWrapper).getByRole("button"));

    expect(screen.getByPlaceholderText("Buscar alimento...")).toHaveValue("");
    expect(search).toHaveBeenCalledWith("");
    expect(screen.getByRole("button", { name: /Banana/ })).toBeTruthy();
  });

  it("fecha o dropdown ao pressionar Escape", () => {
    renderComponent();

    fireEvent.focus(screen.getByPlaceholderText("Buscar alimento..."));
    expect(screen.getByRole("button", { name: /Banana/ })).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("button", { name: /Banana/ })).toBeNull();
  });

  it("fecha o dropdown ao clicar fora", () => {
    renderComponent();

    fireEvent.focus(screen.getByPlaceholderText("Buscar alimento..."));
    expect(screen.getByRole("button", { name: /Banana/ })).toBeTruthy();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole("button", { name: /Banana/ })).toBeNull();
  });

  it("cria referência pela modal e a seleciona", async () => {
    const { create, search } = setupReferencias({
      create: vi.fn().mockResolvedValue({
        id: "ref-nova",
        nome: "Pera",
        fenil_mg_por_100g: 20,
        is_favorita: false,
      }),
    });
    renderComponent();

    fireEvent.click(screen.getByRole("button", { name: /Criar novo alimento/ }));
    expect(screen.getByText("Nova Referência")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Ex: Maçã Fuji"), {
      target: { value: "Pera" },
    });
    fireEvent.change(screen.getByPlaceholderText("Ex: 25.50"), {
      target: { value: "20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith("Pera", 20);
      expect(screen.queryByText("Nova Referência")).toBeNull();
    });
    expect(search).toHaveBeenCalledWith("");
    expect(screen.getByText("Pera")).toBeTruthy();
    expect(screen.getByText(/20.0 mg de fenilalanina por 100g/)).toBeTruthy();
  });

  it("cria o registro com a fenilalanina calculada e chama onSuccess", async () => {
    const { create } = setupRegistro();
    const { container } = renderComponent();

    // espera o efeito preencher a data a partir do timezone
    const dateInput = container.querySelector(
      'input[type="date"]'
    ) as HTMLInputElement;
    await waitFor(() =>
      expect(dateInput.value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    );

    fireEvent.focus(screen.getByPlaceholderText("Buscar alimento..."));
    fireEvent.click(screen.getByRole("button", { name: /Maçã/ }));
    fireEvent.change(screen.getByPlaceholderText("Ex: 150"), {
      target: { value: "150" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar Registro" }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        usuarioId: "user-1",
        referenciaId: "ref-1",
        data: expect.stringContaining("T00:00:00"),
        peso_g: 150,
        fenil_mg: 45,
      });
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
