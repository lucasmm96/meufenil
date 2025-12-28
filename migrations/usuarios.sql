create table public.usuarios (
  id uuid not null,
  nome text null,
  email text null,
  role text not null default 'user'::text,
  limite_diario_mg real not null default 500,
  timezone text not null default 'America/Sao_Paulo'::text,
  consentimento_lgpd_em timestamp with time zone null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint usuarios_pkey primary key (id),
  constraint usuarios_email_key unique (email),
  constraint usuarios_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;