import { useCallback, useState } from "react";
import {
  getReferencias,
  createReferencia,
  ReferenciaDTO,
} from "@/react-app/services/referencias.service";
import { AppError } from "@/react-app/lib/errors";
import { logger } from "@/react-app/lib/logger";

export function useReferencias(usuarioId: string) {
  const [data, setData] = useState<ReferenciaDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const search = useCallback(
    async (term: string) => {
      setLoading(true);
      setError(null);

      try {
        const refs = await getReferencias({ usuarioId, search: term });
        setData(refs);
      } catch (err) {
        const appError =
          err instanceof AppError
            ? err
            : new AppError("UNKNOWN_ERROR", "Erro inesperado", err);

        setError(appError);
        logger.error("Erro ao buscar referências", appError);
      } finally {
        setLoading(false);
      }
    },
    [usuarioId]
  );

  const create = useCallback(
    async (nome: string, fenil: number) => {
      try {
        const ref = await createReferencia({
          nome,
          fenil_mg_por_100g: fenil,
          usuarioId,
        });
        return ref;
      } catch (err) {
        const appError =
          err instanceof AppError
            ? err
            : new AppError("UNKNOWN_ERROR", "Erro inesperado", err);

        setError(appError);
        logger.error("Erro ao criar referência", appError);
        throw appError;
      }
    },
    [usuarioId]
  );

  return {
    data,
    loading,
    error,
    search,
    create,
  };
}
