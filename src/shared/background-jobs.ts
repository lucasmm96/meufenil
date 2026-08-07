import type { SupabaseClient } from "@supabase/supabase-js";

export const BACKGROUND_JOB_STATUSES = ["success", "failure", "partial"] as const;

export type BackgroundJobStatus = (typeof BACKGROUND_JOB_STATUSES)[number];

export type BackgroundJobExecutionInput = {
  runId: string;
  jobKey: string;
  environment: string;
  status: BackgroundJobStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  message: string;
  details?: Record<string, unknown>;
};

export async function recordBackgroundJobExecution(
  client: SupabaseClient,
  input: BackgroundJobExecutionInput
): Promise<void> {
  const { error } = await client.from("background_job_executions").insert({
    run_id: input.runId,
    job_key: input.jobKey,
    environment: input.environment,
    status: input.status,
    started_at: input.startedAt,
    finished_at: input.finishedAt,
    duration_ms: input.durationMs,
    message: input.message,
    details: input.details ?? {},
  });

  if (error) {
    throw new Error(error.message);
  }
}
