import { useCallback, useEffect, useState } from "react";
import {
  getUsuarioPerfil,
  atualizarUsuarioPerfil,
} from "@/react-app/services/usuarios.service";
import { UsuarioDTO } from "@/react-app/services/dtos/usuarios.dto";
import { AppError } from "@/react-app/lib/errors";
import { logger } from "@/react-app/lib/logger";

export function usePerfil(usuarioId?: string) {
  const [perfil, setPerfil] = useState<UsuarioDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const load = useCallback(async () => {
    if (!usuarioId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await getUsuarioPerfil(usuarioId);
      setPerfil(data);
    } catch (err) {
      const appError =
        err instanceof AppError
          ? err
          : new AppError(
              "USER_PROFILE_UNKNOWN_ERROR",
              "Erro inesperado ao carregar perfil",
              err
            );

      logger.error("Erro em usePerfil", appError);
      setError(appError);
      setPerfil(null);
    } finally {
      setLoading(false);
    }
  }, [usuarioId]);

  useEffect(() => {
    load();
  }, [load]);

  const salvar = async (params: {
    nome: string;
    limite_diario_mg: number;
  }) => {
    if (!usuarioId) return;

    setSaving(true);

    try {
      await atualizarUsuarioPerfil(usuarioId, params);
      await load();
    } finally {
      setSaving(false);
    }
  };

  return {
    perfil,
    loading,
    saving,
    error,
    reload: load,
    salvar,
  };
}
