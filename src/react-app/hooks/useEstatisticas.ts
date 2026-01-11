import { useCallback, useEffect, useState } from "react";
import { getEstatisticas } from "@/react-app/services/estatisticas.service";
import {
  EstatisticasDTO,
  PeriodoEstatisticas,
} from "@/react-app/services/dtos/estatisticas.dto";
import { logger } from "@/react-app/lib/logger";

interface UseEstatisticasParams {
  usuarioId: string;
  periodo: PeriodoEstatisticas;
}

export function useEstatisticas(params?: UseEstatisticasParams) {
  const [data, setData] = useState<EstatisticasDTO | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!params?.usuarioId) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const resultado = await getEstatisticas(
        params.usuarioId,
        params.periodo
      );
      setData(resultado);
    } catch (err) {
      logger.error("Erro ao carregar estatísticas", err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [params?.usuarioId, params?.periodo]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    data,
    loading,
    reload: load,
  };
}
