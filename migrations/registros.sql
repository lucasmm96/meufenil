create table public.registros (
  id uuid not null default gen_random_uuid (),
  data date not null,
  usuario_id uuid not null,
  referencia_id uuid not null,
  peso_g real not null,
  fenil_mg real not null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint registros_pkey primary key (id),
  constraint registros_referencia_id_fkey foreign KEY (referencia_id) references referencias (id),
  constraint registros_usuario_id_fkey foreign KEY (usuario_id) references usuarios (id)
) TABLESPACE pg_default;