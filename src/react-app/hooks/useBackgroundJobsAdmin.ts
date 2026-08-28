import { useCallback, useEffect, useMemo, useState } from "react";
import { AppError } from "@/react-app/lib/errors";
import { logger } from "@/react-app/lib/logger";
import {
  getBackgroundJobExecutions,
  getBackgroundJobOverview,
  getDefaultBackgroundJobsOverviewLimit,
  getDefaultBackgroundJobsPageSize,
  getDefaultBackgroundJobsPeriodDays,
} from "@/react-app/services/background-jobs.service";
import {
  BackgroundJobExecutionDTO,
  BackgroundJobFiltersDTO,
  BackgroundJobOverviewDTO,
} from "@/react-app/services/dtos/background-jobs.dto";

export interface BackgroundJobsAdminFilters {
  jobKey: string;
  status: "all" | "success" | "failure" | "partial";
  periodDays: number;
}

export function useBackgroundJobsAdmin(
  usuarioId?: string,
  enabled = false,
) {
  const [overview, setOverview] = useState<BackgroundJobOverviewDTO[]>([]);
  const [executions, setExecutions] = useState<BackgroundJobExecutionDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [filters, setFilters] = useState<BackgroundJobsAdminFilters>({
    jobKey: "keepalive",
    status: "all",
    periodDays: getDefaultBackgroundJobsPeriodDays(),
  });

  const [pageSize, setPageSizeState] = useState(getDefaultBackgroundJobsPageSize());
  const overviewLimit = getDefaultBackgroundJobsOverviewLimit();

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const normalizedFilters = useMemo<BackgroundJobFiltersDTO>(() => {
    return {
      jobKey: filters.jobKey === "all" ? undefined : filters.jobKey,
      status: filters.status === "all" ? undefined : filters.status,
      periodDays: filters.periodDays,
    };
  }, [filters]);

  const load = useCallback(async () => {
    if (!enabled || !usuarioId) {
      setOverview([]);
      setExecutions([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [overviewData, pageData] = await Promise.all([
        getBackgroundJobOverview(normalizedFilters, overviewLimit),
        getBackgroundJobExecutions(normalizedFilters, page, pageSize),
      ]);

      setOverview(overviewData);
      setExecutions(pageData.items);
      setTotal(pageData.total);
    } catch (err) {
      const appError =
        err instanceof AppError
          ? err
          : new AppError(
              "BACKGROUND_JOBS_UNKNOWN_ERROR",
              "Erro inesperado ao carregar jobs em background",
              err,
            );

      logger.error("Erro ao carregar jobs em background", appError);
      setError(appError);
      setOverview([]);
      setExecutions([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [enabled, usuarioId, normalizedFilters, overviewLimit, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const updateFilters = useCallback((patch: Partial<BackgroundJobsAdminFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }, []);

  const setPageSize = useCallback((newSize: number) => {
    setPageSizeState(newSize);
    setPage(1);
  }, []);

  const reload = useCallback(() => {
    return load();
  }, [load]);

  return {
    overview,
    executions,
    total,
    page,
    pageSize,
    totalPages,
    loading,
    error,
    filters,
    setFilters: updateFilters,
    setPage,
    setPageSize,
    reload,
  };
}
