create table public.referencias (
  id uuid not null default gen_random_uuid (),
  nome text not null,
  fenil_mg_por_100g real not null,
  criado_por uuid not null default auth.uid (),
  is_global boolean null default false,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  nome_normalizado text not null,
  constraint referencias_pkey primary key (id),
  constraint referencias_criado_por_fkey foreign KEY (criado_por) references usuarios (id) on delete CASCADE
) TABLESPACE pg_default;

create unique INDEX IF not exists referencias_nome_unique on public.referencias using btree (lower(nome)) TABLESPACE pg_default;

create unique INDEX IF not exists referencias_nome_normalizado_unique on public.referencias using btree (nome_normalizado) TABLESPACE pg_default;

create trigger trg_normalizar_nome_referencia BEFORE INSERT
or
update on referencias for EACH row
execute FUNCTION fn_normalizar_nome_referencia ();