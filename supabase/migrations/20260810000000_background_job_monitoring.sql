create or replace function public.is_admin_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to public
as $$
  select exists (
    select 1
    from public.usuarios u
    where u.id = p_user_id
      and u.role = 'admin'
  );
$$;

revoke all on function public.is_admin_user(uuid) from public;
grant execute on function public.is_admin_user(uuid) to authenticated;
grant execute on function public.is_admin_user(uuid) to service_role;

drop policy if exists admin_can_select_background_job_executions on public.background_job_executions;

create policy admin_can_select_background_job_executions
on public.background_job_executions
for select
to authenticated
using (public.is_admin_user(auth.uid()));

grant select on table public.background_job_executions to authenticated;
grant select on table public.background_job_executions to service_role;
