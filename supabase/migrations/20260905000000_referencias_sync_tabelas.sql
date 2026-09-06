-- ============================================================================
-- Migration: FEAT-0017 M1 — schema das tabelas de sincronização de referências
-- Referência: FEAT-0017 (.ai/specs/proposed/features/FEAT-0017-sincronizacao-referencias-anvisa.md)
-- Design:     .ai/.temp/feat0017-fase1-design-2026-09-04.md — §5 (modelo), §5.6
--             (RLS/grants), §5.7 (enums), §9 (backups/triggers), §16 (M1)
-- Aprovado por: Lucas Martins Menezes em 2026-09-04 (B1–B10 R1–R3; rodada R4)
-- Escopo M1:  enums; tabelas referencia_syncs, referencia_sync_pendencias,
--             referencia_eventos, referencia_snapshots, referencia_backups;
--             índices (incl. single-flight B10); RLS admin-only SELECT + grants;
--             trigger de retenção de backups (12 meses — BR-027/D-3).
--             Nenhuma escrita real de dados; nada alterado em `referencias`
--             (schema de referencias é do ENH-0004; B8 não usa coluna nova).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enums (§5.7) — blocos idempotentes no padrão de 20260807000000;
--    valores em inglês (precedente background_job_status)
-- ----------------------------------------------------------------------------
do $$
begin
  create type public.sync_status as enum (
    'running', 'success', 'pending_review', 'failure', 'origin_invalid', 'reverted'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.sync_pendencia_tipo as enum ('substitution', 'absence', 'new_item');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.sync_pendencia_status as enum ('open', 'approved', 'rejected', 'cancelled');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.sync_evento_tipo as enum (
    'sync_started', 'extraction', 'validation', 'snapshot_created', 'backup_created',
    'referencia_criada', 'referencia_arquivada', 'mudanca_aprovada', 'mudanca_rejeitada',
    'is_ativa_manual', 'rollback', 'restore', 'pendencia_cancelada', 'pre_sync_inativa'
  );
exception
  when duplicate_object then null;
end $$;

-- ----------------------------------------------------------------------------
-- 2. public.referencia_syncs (§5.1) — a sync como unidade
--    Transições de status somente via RPC/rota (nenhuma policy de escrita);
--    single-flight B10: no máximo uma sync running por environment.
-- ----------------------------------------------------------------------------
create table if not exists public.referencia_syncs (
  id uuid primary key default gen_random_uuid(),
  environment text not null,
  trigger_source text not null,
  requested_by uuid references public.usuarios(id) on delete set null,
  bootstrap boolean not null default false,
  status public.sync_status not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  total_origem integer,
  equivalentes integer,
  criadas integer,
  arquivadas integer,
  divergencias integer,
  message text,
  details jsonb not null default '{}'::jsonb,
  alteracoes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint referencia_syncs_finished_at_check check (finished_at >= started_at)
);

create index if not exists referencia_syncs_created_at_idx
  on public.referencia_syncs using btree (created_at desc);

create index if not exists referencia_syncs_status_idx
  on public.referencia_syncs using btree (status);

create index if not exists referencia_syncs_bootstrap_idx
  on public.referencia_syncs using btree (bootstrap);

-- Single-flight (B10, design §5.1/§6.7): segunda sync running simultânea
-- no mesmo environment viola 23505 → a rota responde 409 sem registrar linha.
create unique index if not exists referencia_syncs_single_flight_running_unique
  on public.referencia_syncs using btree (environment)
  where status = 'running';

-- ----------------------------------------------------------------------------
-- 3. public.referencia_sync_pendencias (§5.2) — curadoria
--    Dedupe de abertas (D-6) na comparação (M3+); CHECK: rejeição exige motivo.
-- ----------------------------------------------------------------------------
create table if not exists public.referencia_sync_pendencias (
  id uuid primary key default gen_random_uuid(),
  sync_id uuid not null references public.referencia_syncs(id) on delete restrict,
  tipo public.sync_pendencia_tipo not null,
  referencia_id uuid references public.referencias(id) on delete restrict,
  proposta jsonb,
  diff jsonb,
  status public.sync_pendencia_status not null default 'open',
  motivo text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.usuarios(id) on delete set null,
  constraint referencia_sync_pendencias_motivo_rejeicao_check
    check (status <> 'rejected' or motivo is not null)
);

create index if not exists referencia_sync_pendencias_sync_id_idx
  on public.referencia_sync_pendencias using btree (sync_id);

create index if not exists referencia_sync_pendencias_status_idx
  on public.referencia_sync_pendencias using btree (status);

create index if not exists referencia_sync_pendencias_referencia_id_idx
  on public.referencia_sync_pendencias using btree (referencia_id);

create index if not exists referencia_sync_pendencias_created_at_idx
  on public.referencia_sync_pendencias using btree (created_at desc);

-- ----------------------------------------------------------------------------
-- 4. public.referencia_eventos (§5.3) — auditoria única (B7)
--    FKs SET NULL: exclusão de conta (BR-026) e DELETE físico de pessoal não
--    órfã a trilha — identidade textual preservada em detalhes.
-- ----------------------------------------------------------------------------
create table if not exists public.referencia_eventos (
  id uuid primary key default gen_random_uuid(),
  sync_id uuid references public.referencia_syncs(id) on delete restrict,
  pendencia_id uuid references public.referencia_sync_pendencias(id) on delete restrict,
  referencia_id uuid references public.referencias(id) on delete set null,
  tipo public.sync_evento_tipo not null,
  actor_id uuid references public.usuarios(id) on delete set null,
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists referencia_eventos_sync_id_idx
  on public.referencia_eventos using btree (sync_id);

create index if not exists referencia_eventos_pendencia_id_idx
  on public.referencia_eventos using btree (pendencia_id);

create index if not exists referencia_eventos_referencia_id_idx
  on public.referencia_eventos using btree (referencia_id);

create index if not exists referencia_eventos_tipo_idx
  on public.referencia_eventos using btree (tipo);

create index if not exists referencia_eventos_created_at_idx
  on public.referencia_eventos using btree (created_at desc);

-- ----------------------------------------------------------------------------
-- 5. public.referencia_snapshots e public.referencia_backups (§5.4) — B3
--    Snapshot: payload decodificado exato da origem (sem retenção até R5).
--    Backup:   linhas completas de referencias pré-aplicação; retenção 12m.
-- ----------------------------------------------------------------------------
create table if not exists public.referencia_snapshots (
  id uuid primary key default gen_random_uuid(),
  sync_id uuid not null references public.referencia_syncs(id) on delete restrict,
  payload jsonb not null,
  payload_sha256 text not null,
  contagem integer not null,
  created_at timestamptz not null default now()
);

create index if not exists referencia_snapshots_sync_id_idx
  on public.referencia_snapshots using btree (sync_id);

create index if not exists referencia_snapshots_created_at_idx
  on public.referencia_snapshots using btree (created_at desc);

create table if not exists public.referencia_backups (
  id uuid primary key default gen_random_uuid(),
  sync_id uuid not null references public.referencia_syncs(id) on delete restrict,
  payload jsonb not null,
  payload_sha256 text not null,
  contagem integer not null,
  created_at timestamptz not null default now()
);

create index if not exists referencia_backups_sync_id_idx
  on public.referencia_backups using btree (sync_id);

create index if not exists referencia_backups_created_at_idx
  on public.referencia_backups using btree (created_at desc);

-- ----------------------------------------------------------------------------
-- 6. RLS e grants (§5.6) — padrão background_job_executions (20260807000000/
--    20260810000000): leitura apenas admin (is_admin_user); escrita exclusiva
--    de service_role (rota/scripts) e RPCs SECURITY DEFINER (M4+) — nenhuma
--    policy de escrita, nenhum grant destrutivo.
-- ----------------------------------------------------------------------------
alter table public.referencia_syncs enable row level security;
alter table public.referencia_sync_pendencias enable row level security;
alter table public.referencia_eventos enable row level security;
alter table public.referencia_snapshots enable row level security;
alter table public.referencia_backups enable row level security;

drop policy if exists admin_select_referencia_syncs on public.referencia_syncs;
create policy admin_select_referencia_syncs
  on public.referencia_syncs
  for select
  to authenticated
  using (public.is_admin_user(auth.uid()));

drop policy if exists admin_select_referencia_sync_pendencias on public.referencia_sync_pendencias;
create policy admin_select_referencia_sync_pendencias
  on public.referencia_sync_pendencias
  for select
  to authenticated
  using (public.is_admin_user(auth.uid()));

drop policy if exists admin_select_referencia_eventos on public.referencia_eventos;
create policy admin_select_referencia_eventos
  on public.referencia_eventos
  for select
  to authenticated
  using (public.is_admin_user(auth.uid()));

drop policy if exists admin_select_referencia_snapshots on public.referencia_snapshots;
create policy admin_select_referencia_snapshots
  on public.referencia_snapshots
  for select
  to authenticated
  using (public.is_admin_user(auth.uid()));

drop policy if exists admin_select_referencia_backups on public.referencia_backups;
create policy admin_select_referencia_backups
  on public.referencia_backups
  for select
  to authenticated
  using (public.is_admin_user(auth.uid()));

grant select on table public.referencia_syncs to authenticated;
grant select on table public.referencia_syncs to service_role;

grant select on table public.referencia_sync_pendencias to authenticated;
grant select on table public.referencia_sync_pendencias to service_role;

grant select on table public.referencia_eventos to authenticated;
grant select on table public.referencia_eventos to service_role;

grant select on table public.referencia_snapshots to authenticated;
grant select on table public.referencia_snapshots to service_role;

grant select on table public.referencia_backups to authenticated;
grant select on table public.referencia_backups to service_role;

-- ----------------------------------------------------------------------------
-- 7. Retenção de backups — 12 meses (B3 fixado; BR-027/D-3)
--    Trigger AFTER INSERT FOR EACH STATEMENT no padrão
--    trg_trim_background_job_executions (20260807000000), com o intervalo
--    próprio desta tabela — fora do trim 365d da BR-027.
-- ----------------------------------------------------------------------------
create or replace function public.fn_trim_referencia_backups()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
begin
  delete from public.referencia_backups
  where created_at < now() - interval '12 months';

  return null;
end;
$$;

drop trigger if exists trg_trim_referencia_backups on public.referencia_backups;

create trigger trg_trim_referencia_backups
after insert on public.referencia_backups
for each statement
execute function public.fn_trim_referencia_backups();
