import { subDays } from "date-fns";
import { supabase } from "@/react-app/lib/supabase";
import { AppError } from "@/react-app/lib/errors";
import { CURRENT_APP_ENVIRONMENT } from "@/react-app/lib/app-environment";
import {
  BackgroundJobExecutionDTO,
  BackgroundJobExecutionsPageDTO,
  BackgroundJobFiltersDTO,
  BackgroundJobOverviewDTO,
} from "./dtos/background-jobs.dto";

const QUERY_FIELDS = `
  id,
  run_id,
  job_key,
  environment,
  status,
  started_at,
  finished_at,
  duration_ms,
  message,
  details,
  created_at
`;

const DEFAULT_PAGE_SIZE = 3;
const DEFAULT_OVERVIEW_LIMIT = 240;
const DEFAULT_PERIOD_DAYS = 30;

type BackgroundJobRow = Omit<BackgroundJobExecutionDTO, "details"> & {
  details: unknown;
};

function parseDetails(details: unknown): Record<string, unknown> {
  if (details && typeof details === "object" && !Array.isArray(details)) {
    return details as Record<string, unknown>;
  }

  if (Array.isArray(details)) {
    return { items: details };
  }

  if (details === null || details === undefined) {
    return {};
  }

  return { value: details as string | number | boolean };
}

function toExecutionDTO(row: BackgroundJobRow): BackgroundJobExecutionDTO {
  return {
    ...row,
    details: parseDetails(row.details),
  };
}

function groupOverview(rows: BackgroundJobExecutionDTO[]): BackgroundJobOverviewDTO[] {
  const groups = new Map<string, BackgroundJobOverviewDTO & { total_count: number }>();

  for (const row of rows) {
    const key = `${row.job_key}:${row.environment}`;
    const current = groups.get(key);

    if (!current) {
      groups.set(key, {
        job_key: row.job_key,
        environment: row.environment,
        total_count: 1,
        success_count: row.status === "success" ? 1 : 0,
        failure_count: row.status === "failure" ? 1 : 0,
        partial_count: row.status === "partial" ? 1 : 0,
        last_status: row.status,
        last_started_at: row.started_at,
        last_finished_at: row.finished_at,
        last_duration_ms: row.duration_ms,
        last_message: row.message,
        last_details: row.details,
        last_run_id: row.run_id,
        last_created_at: row.created_at,
      });
      continue;
    }

    current.total_count += 1;
    current.success_count += row.status === "success" ? 1 : 0;
    current.failure_count += row.status === "failure" ? 1 : 0;
    current.partial_count += row.status === "partial" ? 1 : 0;

    if (new Date(row.started_at).getTime() > new Date(current.last_started_at).getTime()) {
      current.last_status = row.status;
      current.last_started_at = row.started_at;
      current.last_finished_at = row.finished_at;
      current.last_duration_ms = row.duration_ms;
      current.last_message = row.message;
      current.last_details = row.details;
      current.last_run_id = row.run_id;
      current.last_created_at = row.created_at;
    }
  }

  return [...groups.values()].sort((a, b) => {
    const diff = new Date(b.last_started_at).getTime() - new Date(a.last_started_at).getTime();
    if (diff !== 0) return diff;

    if (a.job_key !== b.job_key) {
      return a.job_key.localeCompare(b.job_key);
    }

    return a.environment.localeCompare(b.environment);
  });
}

export async function getBackgroundJobOverview(
  filters: BackgroundJobFiltersDTO = {},
  limit = DEFAULT_OVERVIEW_LIMIT,
): Promise<BackgroundJobOverviewDTO[]> {
  const { jobKey, status, periodDays } = filters;

  let query = supabase.from("background_job_executions").select(QUERY_FIELDS);
  query = query.eq("environment", CURRENT_APP_ENVIRONMENT);

  if (jobKey) {
    query = query.eq("job_key", jobKey);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const days = periodDays ?? DEFAULT_PERIOD_DAYS;
  if (days > 0) {
    query = query.gte("started_at", subDays(new Date(), days).toISOString());
  }

  const { data, error } = await query.order("started_at", { ascending: false }).limit(limit);

  if (error || !data) {
    throw new AppError(
      "BACKGROUND_JOBS_OVERVIEW_ERROR",
      "Erro ao carregar visão geral dos jobs",
      error,
    );
  }

  return groupOverview(data as BackgroundJobExecutionDTO[]);
}

export async function getBackgroundJobExecutions(
  filters: BackgroundJobFiltersDTO = {},
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<BackgroundJobExecutionsPageDTO> {
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;

  const { jobKey, status, periodDays } = filters;

  let query = supabase.from("background_job_executions").select(QUERY_FIELDS, { count: "exact" });
  query = query.eq("environment", CURRENT_APP_ENVIRONMENT);

  if (jobKey) {
    query = query.eq("job_key", jobKey);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const days = periodDays ?? DEFAULT_PERIOD_DAYS;
  if (days > 0) {
    query = query.gte("started_at", subDays(new Date(), days).toISOString());
  }

  const { data, error, count } = await query.order("started_at", { ascending: false }).range(from, to);

  if (error || !data) {
    throw new AppError(
      "BACKGROUND_JOBS_HISTORY_ERROR",
      "Erro ao carregar histórico dos jobs",
      error,
    );
  }

  return {
    items: (data as BackgroundJobRow[]).map(toExecutionDTO),
    total: count ?? 0,
    page,
    pageSize,
  };
}

export function getDefaultBackgroundJobsPageSize() {
  return DEFAULT_PAGE_SIZE;
}

export function getDefaultBackgroundJobsOverviewLimit() {
  return DEFAULT_OVERVIEW_LIMIT;
}

export function getDefaultBackgroundJobsPeriodDays() {
  return DEFAULT_PERIOD_DAYS;
}
