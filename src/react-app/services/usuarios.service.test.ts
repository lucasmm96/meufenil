import { describe, it, expect, vi, afterEach } from "vitest";
import { AppError } from "@/react-app/lib/errors";
import { UsuarioDTO } from "./dtos/usuarios.dto";

// 👉 mock do supabase ANTES do import do service
vi.mock("@/react-app/lib/supabase", () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

import { supabase } from "@/react-app/lib/supabase";
import {
  getUsuarioPerfil,
  atualizarUsuarioPerfil,
  getPerfilUsuarioTimezone,
} from "./usuarios.service";

describe("usuarios.service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getUsuarioPerfil", () => {
    it("deve retornar o perfil do usuário corretamente", async () => {
      const mockData = {
        id: "user-1",
        nome: "Lucas",
        email: "lucas@email.com",
        role: "user",
        limite_diario_mg: 300,
        timezone: "America/Sao_Paulo",
        consentimento_lgpd_em: "2024-01-01T10:00:00Z",
        created_at: "2024-01-01T10:00:00Z",
        updated_at: "2024-01-02T10:00:00Z",
      };

      const singleMock = vi.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const eqMock = vi.fn().mockReturnValue({
        single: singleMock,
      });

      const selectMock = vi.fn().mockReturnValue({
        eq: eqMock,
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: selectMock,
      });

      const result = await getUsuarioPerfil("user-1");

      const expected: UsuarioDTO = {
        id: "user-1",
        nome: "Lucas",
        email: "lucas@email.com",
        role: "user",
        limite_diario_mg: 300,
        timezone: "America/Sao_Paulo",
        consentimento_lgpd_em: "2024-01-01T10:00:00Z",
        created_at: "2024-01-01T10:00:00Z",
        updated_at: "2024-01-02T10:00:00Z",
      };

      expect(result).toEqual(expected);
      expect(selectMock).toHaveBeenCalledWith(`
      id,
      nome,
      email,
      role,
      limite_diario_mg,
      timezone,
      consentimento_lgpd_em,
      created_at,
      updated_at
    `);
      expect(eqMock).toHaveBeenCalledWith("id", "user-1");
      expect(singleMock).toHaveBeenCalled();
    });

    it("deve lançar AppError se ocorrer erro ao buscar perfil", async () => {
      const singleMock = vi.fn().mockResolvedValue({
        data: null,
        error: new Error("Query error"),
      });

      const eqMock = vi.fn().mockReturnValue({
        single: singleMock,
      });

      const selectMock = vi.fn().mockReturnValue({
        eq: eqMock,
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: selectMock,
      });

      await expect(getUsuarioPerfil("user-1")).rejects.toBeInstanceOf(
        AppError
      );
    });
  });

  describe("atualizarUsuarioPerfil", () => {
    it("deve atualizar o perfil do usuário corretamente", async () => {
      const eqMock = vi.fn().mockResolvedValue({
        error: null,
      });

      const updateMock = vi.fn().mockReturnValue({
        eq: eqMock,
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        update: updateMock,
      });

      await atualizarUsuarioPerfil("user-1", {
        nome: "Novo Nome",
        limite_diario_mg: 250,
      });

      expect(updateMock).toHaveBeenCalledWith({
        nome: "Novo Nome",
        limite_diario_mg: 250,
        updated_at: expect.any(String),
      });

      expect(eqMock).toHaveBeenCalledWith("id", "user-1");
    });

    it("deve lançar AppError se ocorrer erro ao atualizar perfil", async () => {
      const eqMock = vi.fn().mockResolvedValue({
        error: new Error("Update error"),
      });

      const updateMock = vi.fn().mockReturnValue({
        eq: eqMock,
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        update: updateMock,
      });

      await expect(
        atualizarUsuarioPerfil("user-1", {
          nome: "Erro",
          limite_diario_mg: 100,
        })
      ).rejects.toBeInstanceOf(AppError);
    });
  });

  describe("getPerfilUsuarioTimezone", () => {
    it("deve retornar o timezone do perfil do usuário", async () => {
      const mockData = {
        id: "user-1",
        nome: "Lucas",
        email: "lucas@email.com",
        role: "user",
        limite_diario_mg: 300,
        timezone: "America/Sao_Paulo",
        consentimento_lgpd_em: null,
        created_at: "2024-01-01T10:00:00Z",
        updated_at: "2024-01-02T10:00:00Z",
      };

      const singleMock = vi.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const eqMock = vi.fn().mockReturnValue({
        single: singleMock,
      });

      const selectMock = vi.fn().mockReturnValue({
        eq: eqMock,
      });

      (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        select: selectMock,
      });

      const timezone = await getPerfilUsuarioTimezone("user-1");

      expect(timezone).toBe("America/Sao_Paulo");
    });
  });
});
