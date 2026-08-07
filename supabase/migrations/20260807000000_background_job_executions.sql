do $$
begin
  create type public.background_job_status as enum ('success', 'failure', 'partial');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.background_job_executions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null default gen_random_uuid(),
  job_key text not null,
  environment text not null,
  status public.background_job_status not null,
  started_at timestamp with time zone not null,
  finished_at timestamp with time zone not null,
  duration_ms integer not null,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  constraint background_job_executions_duration_ms_check check (duration_ms >= 0),
  constraint background_job_executions_time_check check (finished_at >= started_at)
);

create index if not exists background_job_executions_job_key_environment_created_at_idx
  on public.background_job_executions using btree (job_key, environment, created_at desc);

create index if not exists background_job_executions_run_id_idx
  on public.background_job_executions using btree (run_id);

create index if not exists background_job_executions_created_at_idx
  on public.background_job_executions using btree (created_at desc);

alter table public.background_job_executions enable row level security;

create or replace function public.fn_trim_background_job_executions()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
begin
  delete from public.background_job_executions
  where created_at < now() - interval '365 days';

  return null;
end;
$$;

drop trigger if exists trg_trim_background_job_executions on public.background_job_executions;

create trigger trg_trim_background_job_executions
after insert on public.background_job_executions
for each statement
execute function public.fn_trim_background_job_executions();
