import { useCallback, useEffect, useState } from "react";
import { format, subDays } from "date-fns";
import { getDashboardData } from "@/react-app/services/dashboard.service";
import { RegistroDTO } from "@/react-app/services/registros.service";
import { UsuarioDTO } from "@/react-app/services/dtos/usuarios.dto";
import { read } from "@/react-app/services/offlineStorage.service";
import { DashboardDTO } from "@/react-app/services/dtos/dashboard.dto";
import { AppError } from "@/react-app/lib/errors";

export function useDashboard(userId?: string, isOnline: boolean = true) {
  const [data, setData] = useState<DashboardDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      if (!isOnline) {
        const [historicoRaw, perfilRaw] = await Promise.all([
          read('historico', userId),
          read('perfil', userId),
        ]);
        const historico = (Array.isArray(historicoRaw) ? historicoRaw : []) as RegistroDTO[];
        const perfil = perfilRaw as UsuarioDTO | null;
        if (!perfil) {
          setLoading(false);
          return;
        }

        const today = format(new Date(), 'yyyy-MM-dd');
        const totalHoje = historico
          .filter((r) => r.data === today)
          .reduce((acc, r) => acc + (r.fenil_mg ?? 0), 0);

        const sevenDaysAgo = format(subDays(new Date(), 6), 'yyyy-MM-dd');
        const recentRegistros = historico.filter((r) => r.data >= sevenDaysAgo);
        const mapa: Record<string, number> = {};
        recentRegistros.forEach((r) => {
          mapa[r.data] = (mapa[r.data] ?? 0) + (r.fenil_mg ?? 0);
        });
        const grafico = Object.keys(mapa).sort().map((dateStr) => ({ data: dateStr, total: mapa[dateStr] }));

        setData({
          usuario: {
            id: perfil.id,
            limite_diario_mg: perfil.limite_diario_mg,
            consentimento_lgpd_em: perfil.consentimento_lgpd_em,
            timezone: perfil.timezone,
          },
          hoje: { total: totalHoje, limite: perfil.limite_diario_mg, data: today },
          grafico,
        });
      } else {
        const result = await getDashboardData(userId);
        setData(result);
      }
    } catch (err) {
      setError(err as AppError);
    } finally {
      setLoading(false);
    }
  }, [userId, isOnline]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    data,
    loading,
    error,
    reload: load,
  };
}
