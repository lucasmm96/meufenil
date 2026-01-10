import { useState, useCallback } from "react";
import { createRegistro } from "@/react-app/services/registros.service";
import { AppError } from "@/react-app/lib/errors";
import { logger } from "@/react-app/lib/logger";

export function useCreateRegistro() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const create = useCallback(async (params: {
    usuarioId: string;
    referenciaId: string;
    data: string;
    peso_g: number;
    fenil_mg: number;
  }) => {
    setLoading(true);
    setError(null);

    try {
      await createRegistro(params);
    } catch (err) {
      const appError =
        err instanceof AppError
          ? err
          : new AppError("UNKNOWN_ERROR", "Erro inesperado", err);

      setError(appError);
      logger.error("Erro ao criar registro", appError);
      throw appError;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    create,
    loading,
    error,
  };
}
