create table public.exames_pku (
  id uuid not null default gen_random_uuid (),
  usuario_id uuid not null,
  data_exame date not null,
  resultado_mg_dl real not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint exames_pku_pkey primary key (id),
  constraint exames_pku_usuario_id_fkey foreign KEY (usuario_id) references usuarios (id) on delete CASCADE
) TABLESPACE pg_default;