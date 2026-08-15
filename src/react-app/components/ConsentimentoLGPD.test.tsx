import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConsentimentoLGPD from "./ConsentimentoLGPD";

describe("ConsentimentoLGPD component", () => {
  it("renderiza o modal com as seções do consentimento", () => {
    render(<ConsentimentoLGPD onAccept={() => {}} />);

    expect(
      screen.getByRole("heading", { name: "Consentimento LGPD" })
    ).toBeTruthy();
    expect(
      screen.getByText(/Lei Geral de Proteção de Dados \(LGPD\)/i)
    ).toBeTruthy();
    expect(screen.getByText("Dados coletados:")).toBeTruthy();
    expect(screen.getByText("Finalidade:")).toBeTruthy();
    expect(screen.getByText("Seus direitos:")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Aceitar e Continuar" })
    ).toBeTruthy();
  });

  it("chama onAccept e fecha o modal ao aceitar", () => {
    const onAccept = vi.fn();
    render(<ConsentimentoLGPD onAccept={onAccept} />);

    fireEvent.click(screen.getByRole("button", { name: "Aceitar e Continuar" }));

    expect(onAccept).toHaveBeenCalled();
    expect(
      screen.queryByRole("heading", { name: "Consentimento LGPD" })
    ).toBeNull();
  });
});
