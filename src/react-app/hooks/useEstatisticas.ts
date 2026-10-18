import { useCallback, useEffect, useState } from "react";
import { subDays, format } from "date-fns";
import { getEstatisticas } from "@/react-app/services/estatisticas.service";
import { read } from "@/react-app/services/offlineStorage.service";
import {
  EstatisticasDTO,
  EstatisticaRegistroDTO,
  PeriodoEstatisticas,
} from "@/react-app/services/dtos/estatisticas.dto";
import { logger } from "@/react-app/lib/logger";

interface UseEstatisticasParams {
  usuarioId: string;
  periodo: PeriodoEstatisticas;
  isOnline?: boolean;
}

async function getEstatisticasOffline(
  usuarioId: string,
  periodo: PeriodoEstatisticas
): Promise<EstatisticasDTO | null> {
  const raw = await read("historico", usuarioId);
  if (!Array.isArray(raw)) return null;

  const diasFiltro = periodo === "semana" ? 7 : 7;
  const dataMin = format(subDays(new Date(), diasFiltro - 1), "yyyy-MM-dd");

  type HistItem = { data: string; fenil_mg: number };
  const items = (raw as HistItem[]).filter(
    (r) => typeof r.data === "string" && r.data >= dataMin
  );

  const mapa: Record<string, number> = {};
  for (const r of items) {
    mapa[r.data] = (mapa[r.data] ?? 0) + (r.fenil_mg ?? 0);
  }

  const registros: EstatisticaRegistroDTO[] = Object.keys(mapa)
    .sort()
    .map((data) => ({ data, total: mapa[data] }));

  const totalConsumo = registros.reduce((sum, r) => sum + r.total, 0);
  const mediaConsumo = registros.length > 0 ? totalConsumo / registros.length : 0;
  const maiorConsumo = registros.length > 0 ? Math.max(...registros.map((r) => r.total)) : 0;

  return { registros, totalConsumo, mediaConsumo, maiorConsumo };
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
      if (params.isOnline === false) {
        const resultado = await getEstatisticasOffline(params.usuarioId, params.periodo);
        setData(resultado);
      } else {
        const resultado = await getEstatisticas(params.usuarioId, params.periodo);
        setData(resultado);
      }
    } catch (err) {
      logger.error("Erro ao carregar estatísticas", err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [params?.usuarioId, params?.periodo, params?.isOnline]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    data,
    loading,
    reload: load,
  };
}
