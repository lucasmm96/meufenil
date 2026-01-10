import { useCallback, useEffect, useState } from "react";
import { getDashboardData } from "@/react-app/services/dashboard.service";
import { DashboardDTO } from "@/react-app/services/dtos/dashboard.dto";
import { AppError } from "@/react-app/lib/errors";

export function useDashboard(userId?: string) {
  const [data, setData] = useState<DashboardDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await getDashboardData(userId);
      setData(result);
    } catch (err) {
      setError(err as AppError);
    } finally {
      setLoading(false);
    }
  }, [userId]);

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
