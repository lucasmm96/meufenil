import { useCallback, useEffect, useState } from "react";
import {getExamesPKU, createExamePKU, deleteExamePKU} from "@/react-app/services/exames.service";
import { ExameDTO } from "@/react-app/services/dtos/exames.dto";
import { usePerfil } from "@/react-app/hooks/usePerfil";
import { AppError } from "@/react-app/lib/errors";
import { logger } from "@/react-app/lib/logger";

export function useExames(usuarioId?: string) {
  const [exames, setExames] = useState<ExameDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  const { perfil } = usePerfil(usuarioId);

  const timezone = perfil?.timezone ?? "America/Sao_Paulo";

  const load = useCallback(async () => {
    if (!usuarioId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const examesData = await getExamesPKU(usuarioId);
      setExames(examesData);
    } catch (err) {
      const appError =
        err instanceof AppError
          ? err
          : new AppError(
              "EXAMES_UNKNOWN_ERROR",
              "Erro inesperado ao carregar exames",
              err,
            );

      logger.error("Erro em useExames", appError);
      setError(appError);
      setExames([]);
    } finally {
      setLoading(false);
    }
  }, [usuarioId]);

  useEffect(() => {
    load();
  }, [load]);

  const criar = async (params: {
    dataISO: string;
    resultado: number;
  }) => {
    if (!usuarioId) return;
    await createExamePKU({
      usuarioId,
      dataExameISO: params.dataISO,
      resultadoMgDl: params.resultado,
    });
    await load();
  };

  const remover = async (exameId: string) => {
    if (!usuarioId) return;
    await deleteExamePKU({ exameId, usuarioId });
    await load();
  };

  return {
    exames,
    timezone,
    loading,
    error,
    reload: load,
    criar,
    remover,
  };
}
