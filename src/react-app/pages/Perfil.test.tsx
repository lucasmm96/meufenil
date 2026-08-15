import type { ReactNode } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Perfil from "./Perfil";

vi.mock("@/react-app/components/Layout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@skeletons", () => ({
  LayoutSkeleton: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PerfilSkeleton: () => <div data-testid="perfil-skeleton" />,
}));

vi.mock("@/react-app/context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/react-app/hooks/usePerfil", () => ({
  usePerfil: vi.fn(),
}));

vi.mock("@/react-app/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

import { useAuth } from "@/react-app/context/AuthContext";
import { usePerfil } from "@/react-app/hooks/usePerfil";
import { supabase } from "@/react-app/lib/supabase";

const mockPerfil = {
  id: "user-1",
  nome: "Lucas",
  email: "lucas@email.com",
  role: "user",
  limite_diario_mg: 300,
  timezone: "America/Sao_Paulo",
  consentimento_lgpd_em: null,
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
};

// Cadeia de query do supabase (select → eq → order/single)
function queryChain(result: { data: unknown; error: unknown } = { data: null, error: null }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
  };
  return chain;
}

describe("Perfil page", () => {
  const useAuthMock = useAuth as unknown as ReturnType<typeof vi.fn>;
  const usePerfilMock = usePerfil as unknown as ReturnType<typeof vi.fn>;
  const fromMock = vi.mocked(supabase.from);
  const getSessionMock = vi.mocked(supabase.auth.getSession);
  const signOutMock = vi.mocked(supabase.auth.signOut);
  let fetchMock: ReturnType<typeof vi.fn>;
  let alertSpy: ReturnType<typeof vi.spyOn>;
  let confirmSpy: ReturnType<typeof vi.spyOn>;
  let promptSpy: ReturnType<typeof vi.spyOn>;

  function setupAuth(overrides: Record<string, unknown> = {}) {
    const auth = {
      authUser: { id: "user-1" },
      ready: true,
      usuarioAtivoId: "user-1",
      isDelegado: false,
      concedidos: [],
      recebidos: [],
      carregarDelegacoes: vi.fn(),
      conceder: vi.fn(),
      revogar: vi.fn(),
      assumir: vi.fn(),
      ...overrides,
    };
    useAuthMock.mockReturnValue(auth);
    return auth;
  }

  function setupPerfil(overrides: Record<string, unknown> = {}) {
    const state = {
      perfil: mockPerfil,
      loading: false,
      saving: false,
      salvar: vi.fn(),
      error: null,
      ...overrides,
    };
    usePerfilMock.mockReturnValue(state);
    return state;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    promptSpy = vi.spyOn(window, "prompt").mockReturnValue("EXCLUIR");
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "token-123" } },
      error: null,
    } as never);
    signOutMock.mockResolvedValue({ error: null } as never);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    alertSpy.mockRestore();
    confirmSpy.mockRestore();
    promptSpy.mockRestore();
  });

  it("mostra skeleton enquanto o auth não está pronto", () => {
    setupAuth({ ready: false });
    setupPerfil();
    render(<Perfil />);

    expect(screen.getByTestId("perfil-skeleton")).toBeTruthy();
  });

  it("mostra skeleton enquanto o perfil carrega", () => {
    setupAuth();
    setupPerfil({ loading: true, perfil: null });
    render(<Perfil />);

    expect(screen.getByTestId("perfil-skeleton")).toBeTruthy();
  });

  it("não renderiza nada quando não há perfil (erro sem UI)", () => {
    setupAuth();
    setupPerfil({ perfil: null });
    const { container } = render(<Perfil />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza dados do perfil e estados vazios das delegações", () => {
    setupAuth();
    setupPerfil();
    render(<Perfil />);

    expect(screen.getByRole("heading", { name: "Perfil" })).toBeTruthy();
    expect(screen.getByText("Gerencie suas informações pessoais")).toBeTruthy();

    const nomeInput = screen.getAllByRole("textbox")[0] as HTMLInputElement;
    expect(nomeInput.value).toBe("Lucas");
    const emailInput = screen.getAllByRole("textbox")[1] as HTMLInputElement;
    expect(emailInput.value).toBe("lucas@email.com");
    expect(emailInput).toBeDisabled();
    expect(screen.getByRole("spinbutton")).toHaveValue(300);

    expect(
      screen.getByText("Você ainda não concedeu acesso a ninguém.")
    ).toBeTruthy();
    expect(screen.getByText("Nenhum acesso recebido.")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Exportar meus dados" })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Excluir minha conta" })
    ).toBeTruthy();
  });

  it("salva alterações do perfil e mostra confirmação", async () => {
    setupAuth();
    const { salvar } = setupPerfil();
    render(<Perfil />);

    fireEvent.change(screen.getAllByRole("textbox")[0], {
      target: { value: "Lucas M." },
    });
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "450" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(salvar).toHaveBeenCalledWith({
        nome: "Lucas M.",
        limite_diario_mg: 450,
      });
    });
    expect(alertSpy).toHaveBeenCalledWith("Perfil atualizado com sucesso!");
  });

  it("mostra estado de salvamento no botão", () => {
    setupAuth();
    setupPerfil({ saving: true });
    render(<Perfil />);

    const botao = screen.getByRole("button", { name: "Salvando..." });
    expect(botao).toBeDisabled();
  });

  it("modo delegado é somente leitura e oculta privacidade", () => {
    setupAuth({ isDelegado: true });
    setupPerfil();
    render(<Perfil />);

    expect(
      screen.getByText("Visualização de perfil via acesso delegado")
    ).toBeTruthy();
    expect(
      screen.getByText(/Você está acessando esta conta por meio de um acesso delegado/i)
    ).toBeTruthy();

    expect(screen.getAllByRole("textbox")[0]).toBeDisabled();
    expect(screen.getByRole("spinbutton")).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Salvar alterações" })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Excluir minha conta" })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Exportar meus dados" })
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Conceder acesso" })).toBeNull();
  });

  it("revoga um acesso concedido", async () => {
    const { revogar } = setupAuth({
      concedidos: [
        {
          id: "d1",
          usuario_destino: { nome: "Maria", email: "maria@email.com" },
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    });
    setupPerfil();
    render(<Perfil />);

    const item = screen.getByText("Maria").closest("li")!;
    fireEvent.click(within(item).getByRole("button"));

    await waitFor(() => expect(revogar).toHaveBeenCalledWith("d1"));
  });

  it("assume um perfil recebido", async () => {
    const { assumir } = setupAuth({
      recebidos: [
        { id: "r1", usuario_origem: { nome: "Ana", email: "ana@email.com" } },
      ],
    });
    setupPerfil();
    render(<Perfil />);

    fireEvent.click(screen.getByRole("button", { name: "Acessar" }));

    await waitFor(() => expect(assumir).toHaveBeenCalledWith("r1"));
  });

  it("concede acesso pela modal e fecha ao concluir", async () => {
    const { conceder } = setupAuth();
    setupPerfil();
    render(<Perfil />);

    fireEvent.click(screen.getByRole("button", { name: "Conceder acesso" }));
    expect(screen.getByText("Conceder acesso à conta")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("email@exemplo.com"), {
      target: { value: "novo@email.com" },
    });
    const form = screen.getByPlaceholderText("email@exemplo.com").closest("form")!;
    fireEvent.click(within(form).getByRole("button", { name: "Conceder acesso" }));

    await waitFor(() => {
      expect(conceder).toHaveBeenCalledWith("novo@email.com");
      expect(screen.queryByText("Conceder acesso à conta")).toBeNull();
    });
  });

  it("exibe erro da API na modal ao conceder acesso", async () => {
    setupAuth({
      conceder: vi.fn().mockRejectedValue({ error: "Usuário não encontrado" }),
    });
    setupPerfil();
    render(<Perfil />);

    fireEvent.click(screen.getByRole("button", { name: "Conceder acesso" }));
    fireEvent.change(screen.getByPlaceholderText("email@exemplo.com"), {
      target: { value: "nao-existe@email.com" },
    });
    const form = screen.getByPlaceholderText("email@exemplo.com").closest("form")!;
    fireEvent.click(within(form).getByRole("button", { name: "Conceder acesso" }));

    await waitFor(() => {
      expect(screen.getByText("Usuário não encontrado")).toBeTruthy();
    });
  });

  it("exclui a conta após confirmações e redireciona para o início", async () => {
    setupAuth();
    setupPerfil();
    render(<Perfil />);

    fireEvent.click(screen.getByRole("button", { name: "Excluir minha conta" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/functions/v1/delete-account"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer token-123",
          }),
        })
      );
      expect(signOutMock).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });

  it("não exclui a conta quando o usuário cancela o confirm", () => {
    confirmSpy.mockReturnValue(false);
    setupAuth();
    setupPerfil();
    render(<Perfil />);

    fireEvent.click(screen.getByRole("button", { name: "Excluir minha conta" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("não exclui a conta quando a digitação de confirmação não é EXCLUIR", () => {
    promptSpy.mockReturnValue("nope");
    setupAuth();
    setupPerfil();
    render(<Perfil />);

    fireEvent.click(screen.getByRole("button", { name: "Excluir minha conta" }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mostra alerta quando a exclusão da conta falha", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    setupAuth();
    setupPerfil();
    render(<Perfil />);

    fireEvent.click(screen.getByRole("button", { name: "Excluir minha conta" }));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Erro ao excluir conta");
    });
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("exporta os dados em JSON ao clicar em exportar", async () => {
    const createObjectURLSpy = vi.fn(() => "blob:fake");
    Object.defineProperty(URL, "createObjectURL", {
      value: createObjectURLSpy,
      writable: true,
      configurable: true,
    });
    const anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    fromMock.mockImplementation((table: unknown) =>
      table === "usuarios"
        ? queryChain({ data: { id: "user-1" }, error: null })
        : queryChain({ data: [], error: null })
    );

    setupAuth();
    setupPerfil();
    render(<Perfil />);

    fireEvent.click(screen.getByRole("button", { name: "Exportar meus dados" }));

    await waitFor(() => {
      expect(anchorClickSpy).toHaveBeenCalled();
    });
    expect(fromMock).toHaveBeenCalledWith("usuarios");
    expect(fromMock).toHaveBeenCalledWith("registros");
    expect(alertSpy).not.toHaveBeenCalledWith("Erro ao exportar dados");

    anchorClickSpy.mockRestore();
  });

  it("mostra alerta quando a exportação falha", async () => {
    fromMock.mockImplementation((table: unknown) =>
      table === "usuarios"
        ? queryChain({ data: null, error: new Error("falhou") })
        : queryChain({ data: [], error: null })
    );

    setupAuth();
    setupPerfil();
    render(<Perfil />);

    fireEvent.click(screen.getByRole("button", { name: "Exportar meus dados" }));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Erro ao exportar dados");
    });
  });
});
