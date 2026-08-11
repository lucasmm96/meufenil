export const BACKGROUND_JOB_STATUSES = ["success", "failure", "partial"] as const;

export type BackgroundJobStatus = (typeof BACKGROUND_JOB_STATUSES)[number];

export type BackgroundJobEnvironment = "prod" | "dev";

export interface BackgroundJobExecutionDTO {
  id: string;
  run_id: string;
  job_key: string;
  environment: BackgroundJobEnvironment;
  status: BackgroundJobStatus;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  message: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface BackgroundJobOverviewDTO {
  job_key: string;
  environment: BackgroundJobEnvironment;
  total_count: number;
  success_count: number;
  failure_count: number;
  partial_count: number;
  last_status: BackgroundJobStatus;
  last_started_at: string;
  last_finished_at: string;
  last_duration_ms: number;
  last_message: string;
  last_details: Record<string, unknown>;
  last_run_id: string;
  last_created_at: string;
}

export interface BackgroundJobFiltersDTO {
  jobKey?: string;
  environment?: BackgroundJobEnvironment;
  status?: BackgroundJobStatus;
  periodDays?: number;
}

export interface BackgroundJobExecutionsPageDTO {
  items: BackgroundJobExecutionDTO[];
  total: number;
  page: number;
  pageSize: number;
}
