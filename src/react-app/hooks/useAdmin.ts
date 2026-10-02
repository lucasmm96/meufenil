import { useCallback, useEffect, useState } from "react";
import {
  getPerfilAdmin,
  getUsuariosAdmin,
  toggleRoleUsuario,
  getEstatisticasAdmin,
} from "@/react-app/services/admin.service";
import { UsuarioAdminDTO, EstatisticasAdminDTO } from "@/react-app/services/dtos/admin.dto";
import { AppError } from "@/react-app/lib/errors";
import { logger } from "@/react-app/lib/logger";

export function useAdmin(usuarioId?: string) {
  const [perfilUsuario, setPerfilUsuario] = useState<UsuarioAdminDTO | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioAdminDTO[]>([]);
  const [estatisticasDB, setEstatisticasDB] = useState<EstatisticasAdminDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  const load = useCallback(async () => {
    if (!usuarioId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const perfil = await getPerfilAdmin(usuarioId);
      setPerfilUsuario(perfil);

      if (perfil.role !== "admin") {
        setUsuarios([]);
        setEstatisticasDB(null);
        return;
      }

      const usuariosData = await getUsuariosAdmin();
      setUsuarios(usuariosData);

      const stats = await getEstatisticasAdmin(usuariosData.length);
      setEstatisticasDB(stats);
    } catch (err) {
      const appError =
        err instanceof AppError
          ? err
          : new AppError(
              "ADMIN_UNKNOWN_ERROR",
              "Erro inesperado no painel administrativo",
              err,
            );

      logger.error("Erro em useAdmin", appError);
      setError(appError);
    } finally {
      setLoading(false);
    }
  }, [usuarioId]);

  useEffect(() => {
    load();
  }, [load]);

  const [toggleRoleId, setToggleRoleId] = useState<string | null>(null);
  const [toggleRoleError, setToggleRoleError] = useState<string | null>(null);

  const toggleRole = async (id: string, roleAtual: "admin" | "user") => {
    const novoRole = roleAtual === "admin" ? "user" : "admin";
    setToggleRoleId(id);
    setToggleRoleError(null);
    try {
      await toggleRoleUsuario(id, novoRole);
      await load();
    } catch (err) {
      const appError =
        err instanceof AppError
          ? err
          : new AppError("ADMIN_TOGGLE_ROLE_ERROR", "Erro ao alterar papel do usuário", err);
      logger.error("Erro em toggleRole", appError);
      setToggleRoleError(appError.message);
    } finally {
      setToggleRoleId(null);
    }
  };

  return {
    perfilUsuario,
    usuarios,
    estatisticasDB,
    loading,
    error,
    reload: load,
    toggleRole,
    toggleRoleId,
    toggleRoleError,
  };
}
