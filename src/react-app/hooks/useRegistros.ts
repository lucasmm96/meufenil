import { useEffect, useState, useCallback } from "react";
import {
  getRegistros,
  deleteRegistro,
  RegistroDTO,
} from "@/react-app/services/registros.service";
import { logger } from "@/react-app/lib/logger";

export interface UseRegistrosParams {
  usuarioId: string;
  dataInicio?: string;
  dataFim?: string;
}

export function useRegistros(params?: UseRegistrosParams) {
  const [data, setData] = useState<RegistroDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!params?.usuarioId) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const registros = await getRegistros(
        params.usuarioId,
        params.dataInicio,
        params.dataFim
      );
      setData(registros);
    } catch (err) {
      logger.error("Erro ao carregar registros", err);
    } finally {
      setLoading(false);
    }
  }, [params?.usuarioId, params?.dataInicio, params?.dataFim]);

  const remove = useCallback(
    async (id: string) => {
      await deleteRegistro(id);
      await load();
    },
    [load]
  );

  useEffect(() => {
    load();
  }, [load]);

  return {
    data,
    loading,
    remove,
  };
}
