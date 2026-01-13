import { useCallback, useEffect, useState } from "react";
import { getPerfilLayout, PerfilLayoutDTO } from "@/react-app/services/layout.service";
import { AppError } from "@/react-app/lib/errors";
import { logger } from "@/react-app/lib/logger";

export function useLayoutPerfil(usuarioId?: string) {
  const [perfil, setPerfil] = useState<PerfilLayoutDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  const load = useCallback(async () => {
    if (!usuarioId) {
      setPerfil(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await getPerfilLayout(usuarioId);
      setPerfil(data);
    } catch (err) {
      const appError =
        err instanceof AppError
          ? err
          : new AppError(
              "LAYOUT_UNKNOWN_ERROR",
              "Erro inesperado no layout",
              err,
            );

      logger.error("Erro em useLayoutPerfil", appError);
      setError(appError);
    } finally {
      setLoading(false);
    }
  }, [usuarioId]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    perfil,
    loading,
    error,
    reload: load,
  };
}
