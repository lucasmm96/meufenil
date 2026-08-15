-- ============================================================================
-- Migration: Baseline dos objetos sem DDL versionado (DEBT-0001)
-- Referência: .ai/specs/proposed/technical-debt/DEBT-0001-ddl-nao-versionado.md
-- ----------------------------------------------------------------------------
-- Objetos presentes de forma IDÊNTICA nos bancos development e production,
-- mas ausentes de todas as migrations (aplicados por canal não-versionado,
-- origem UNKNOWN). Escopo: tabelas delegacoes_acesso e referencias_favoritas,
-- coluna referencias.is_ativa, função/trigger de limpeza de favoritos e a
-- consolidação das políticas RLS (27 políticas vigentes + remoção das
-- políticas obsoletas do baseline).
--
-- Conteúdo conferido contra o catálogo dos dois ambientes em 2026-08-14
-- (pg_policies / pg_constraint / pg_indexes / pg_get_functiondef /
-- pg_get_triggerdef — dev e prod idênticos no escopo).
--
-- IDEMPOTENTE: em dev/prod, onde os objetos já existem, a aplicação é um
-- no-op (CREATE ... IF NOT EXISTS / DROP ... IF EXISTS + CREATE). Em ambiente
-- reconstruído do zero, reproduz o estado real do catálogo.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabela public.delegacoes_acesso
-- ----------------------------------------------------------------------------
create table if not exists public.delegacoes_acesso (
  id uuid default gen_random_uuid() not null,
  concedente_id uuid not null,
  delegado_id uuid not null,
  created_at timestamp with time zone default now() not null,
  revoked_at timestamp with time zone
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'delegacoes_acesso_pkey') then
    alter table public.delegacoes_acesso
      add constraint delegacoes_acesso_pkey primary key (id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'delegacoes_acesso_concedente_fk') then
    alter table public.delegacoes_acesso
      add constraint delegacoes_acesso_concedente_fk
      foreign key (concedente_id) references public.usuarios (id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'delegacoes_acesso_delegado_fk') then
    alter table public.delegacoes_acesso
      add constraint delegacoes_acesso_delegado_fk
      foreign key (delegado_id) references public.usuarios (id) on delete cascade;
  end if;
end
$$;

-- No máximo UMA delegação ativa por par (concedente, delegado)
create unique index if not exists delegacoes_acesso_unique_ativo
  on public.delegacoes_acesso using btree (concedente_id, delegado_id)
  where (revoked_at is null);

alter table public.delegacoes_acesso enable row level security;

grant all on table public.delegacoes_acesso to anon;
grant all on table public.delegacoes_acesso to authenticated;
grant all on table public.delegacoes_acesso to service_role;

-- ----------------------------------------------------------------------------
-- 2. Tabela public.referencias_favoritas
-- ----------------------------------------------------------------------------
create table if not exists public.referencias_favoritas (
  id uuid default gen_random_uuid() not null,
  usuario_id uuid not null,
  referencia_id uuid not null,
  created_at timestamp with time zone default now() not null
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'referencias_favoritas_pkey') then
    alter table public.referencias_favoritas
      add constraint referencias_favoritas_pkey primary key (id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'referencias_favoritas_usuario_fk') then
    alter table public.referencias_favoritas
      add constraint referencias_favoritas_usuario_fk
      foreign key (usuario_id) references public.usuarios (id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'referencias_favoritas_referencia_fk') then
    alter table public.referencias_favoritas
      add constraint referencias_favoritas_referencia_fk
      foreign key (referencia_id) references public.referencias (id) on delete cascade;
  end if;
end
$$;

-- Um favorito por par (usuario, referencia)
create unique index if not exists referencias_favoritas_unique
  on public.referencias_favoritas using btree (usuario_id, referencia_id);

alter table public.referencias_favoritas enable row level security;

grant all on table public.referencias_favoritas to anon;
grant all on table public.referencias_favoritas to authenticated;
grant all on table public.referencias_favoritas to service_role;

-- ----------------------------------------------------------------------------
-- 3. Coluna public.referencias.is_ativa (soft delete de referências)
-- ----------------------------------------------------------------------------
alter table public.referencias
  add column if not exists is_ativa boolean not null default true;

-- ----------------------------------------------------------------------------
-- 4. Função de limpeza de favoritos de referência desativada
-- ----------------------------------------------------------------------------
create or replace function public.fn_remover_favoritos_referencia_inativa()
 returns trigger
 language plpgsql
as $$
begin
  if old.is_ativa = true and new.is_ativa = false then
    delete from public.referencias_favoritas
    where referencia_id = new.id;
  end if;

  return new;
end;
$$;

grant all on function public.fn_remover_favoritos_referencia_inativa() to anon;
grant all on function public.fn_remover_favoritos_referencia_inativa() to authenticated;
grant all on function public.fn_remover_favoritos_referencia_inativa() to service_role;

-- ----------------------------------------------------------------------------
-- 5. Trigger de limpeza de favoritos (apenas em desativação de referência)
-- ----------------------------------------------------------------------------
drop trigger if exists trg_remover_favoritos_referencia_inativa on public.referencias;

create trigger trg_remover_favoritos_referencia_inativa
  after update of is_ativa on public.referencias
  for each row
  execute function public.fn_remover_favoritos_referencia_inativa();

-- ----------------------------------------------------------------------------
-- 6. Consolidação das políticas RLS
--    a) Remover as políticas obsoletas do baseline (não existem no banco real;
--       `debug_allow_all` já foi removida pela migration 20260811210456).
--    b) Recriar as 27 políticas vigentes (DROP + CREATE para idempotência).
-- ----------------------------------------------------------------------------

-- 6.a Políticas obsoletas do baseline

drop policy if exists "Usuarios podem ler seu próprio perfil" on public.usuarios;
drop policy if exists "usuario atualiza seu perfil" on public.usuarios;
drop policy if exists "usuario cria seu perfil" on public.usuarios;
drop policy if exists "usuario ve seu perfil" on public.usuarios;
drop policy if exists "usuarios_insert_self" on public.usuarios;
drop policy if exists "usuarios_select_own" on public.usuarios;
drop policy if exists "usuarios_update_own" on public.usuarios;

drop policy if exists "usuario cria registro" on public.registros;
drop policy if exists "usuario ve registros" on public.registros;

drop policy if exists "Usuário pode ler referências" on public.referencias;
drop policy if exists "Usuário pode ver referências globais ou próprias" on public.referencias;
drop policy if exists "admin_can_insert_referencias" on public.referencias;
drop policy if exists "admin_can_select_referencias" on public.referencias;
drop policy if exists "admin_can_update_referencias" on public.referencias;
drop policy if exists "usuario cria referencia" on public.referencias;
drop policy if exists "usuario ve referencias" on public.referencias;

drop policy if exists "delete own exames" on public.exames_pku;
drop policy if exists "insert own exames" on public.exames_pku;
drop policy if exists "select own exames" on public.exames_pku;

-- 6.b Políticas vigentes (recriação idempotente)

-- public.usuarios

drop policy if exists "Usuário vê próprio perfil" on public.usuarios;
create policy "Usuário vê próprio perfil"
  on public.usuarios
  for select
  to public
  using (id = auth.uid());

drop policy if exists "Usuário atualiza próprio perfil" on public.usuarios;
create policy "Usuário atualiza próprio perfil"
  on public.usuarios
  for update
  to public
  using (id = auth.uid());

drop policy if exists "Usuário cria próprio perfil" on public.usuarios;
create policy "Usuário cria próprio perfil"
  on public.usuarios
  for insert
  to public
  with check (id = auth.uid());

-- public.registros

drop policy if exists "Listar registro como dono ou delegado" on public.registros;
create policy "Listar registro como dono ou delegado"
  on public.registros
  for select
  to public
  using (
    (usuario_id = auth.uid())
    or exists (
      select 1
      from public.delegacoes_acesso da
      where da.concedente_id = registros.usuario_id
        and da.delegado_id = auth.uid()
        and da.revoked_at is null
    )
  );

drop policy if exists "Adicionar registro como dono ou delegado" on public.registros;
create policy "Adicionar registro como dono ou delegado"
  on public.registros
  for insert
  to public
  with check (
    (usuario_id = auth.uid())
    or exists (
      select 1
      from public.delegacoes_acesso da
      where da.concedente_id = registros.usuario_id
        and da.delegado_id = auth.uid()
        and da.revoked_at is null
    )
  );

drop policy if exists "Inserir registro apenas com referencia ativa" on public.registros;
create policy "Inserir registro apenas com referencia ativa"
  on public.registros
  for insert
  to public
  with check (
    exists (
      select 1
      from public.referencias r
      where r.id = registros.referencia_id
        and r.is_ativa = true
    )
  );

drop policy if exists "Remover registro como dono ou delegado" on public.registros;
create policy "Remover registro como dono ou delegado"
  on public.registros
  for delete
  to public
  using (
    (usuario_id = auth.uid())
    or exists (
      select 1
      from public.delegacoes_acesso da
      where da.concedente_id = registros.usuario_id
        and da.delegado_id = auth.uid()
        and da.revoked_at is null
    )
  );

-- public.exames_pku

drop policy if exists "Listar exame como dono ou delegado" on public.exames_pku;
create policy "Listar exame como dono ou delegado"
  on public.exames_pku
  for select
  to public
  using (
    (usuario_id = auth.uid())
    or exists (
      select 1
      from public.delegacoes_acesso da
      where da.concedente_id = exames_pku.usuario_id
        and da.delegado_id = auth.uid()
        and da.revoked_at is null
    )
  );

drop policy if exists "Adicionar exame como dono ou delegado" on public.exames_pku;
create policy "Adicionar exame como dono ou delegado"
  on public.exames_pku
  for insert
  to public
  with check (
    (usuario_id = auth.uid())
    or exists (
      select 1
      from public.delegacoes_acesso da
      where da.concedente_id = exames_pku.usuario_id
        and da.delegado_id = auth.uid()
        and da.revoked_at is null
    )
  );

drop policy if exists "Atualizar exame como dono ou delegado" on public.exames_pku;
create policy "Atualizar exame como dono ou delegado"
  on public.exames_pku
  for update
  to public
  using (
    (usuario_id = auth.uid())
    or exists (
      select 1
      from public.delegacoes_acesso da
      where da.concedente_id = exames_pku.usuario_id
        and da.delegado_id = auth.uid()
        and da.revoked_at is null
    )
  );

drop policy if exists "Remover exame como dono ou delegado" on public.exames_pku;
create policy "Remover exame como dono ou delegado"
  on public.exames_pku
  for delete
  to public
  using (
    (usuario_id = auth.uid())
    or exists (
      select 1
      from public.delegacoes_acesso da
      where da.concedente_id = exames_pku.usuario_id
        and da.delegado_id = auth.uid()
        and da.revoked_at is null
    )
  );

-- public.referencias

drop policy if exists "Usuário lista referências" on public.referencias;
create policy "Usuário lista referências"
  on public.referencias
  for select
  to public
  using ((is_global = true) or (criado_por = auth.uid()));

drop policy if exists "Usuário lista referências globais ou próprias" on public.referencias;
create policy "Usuário lista referências globais ou próprias"
  on public.referencias
  for select
  to public
  using ((is_global = true) or (criado_por = auth.uid()));

drop policy if exists "Listar referencia como dono ou delegado" on public.referencias;
create policy "Listar referencia como dono ou delegado"
  on public.referencias
  for select
  to public
  using (
    (criado_por = auth.uid())
    or exists (
      select 1
      from public.delegacoes_acesso da
      where da.concedente_id = referencias.criado_por
        and da.delegado_id = auth.uid()
        and da.revoked_at is null
    )
  );

drop policy if exists "Usuário cria própria referencia" on public.referencias;
create policy "Usuário cria própria referencia"
  on public.referencias
  for insert
  to public
  with check (criado_por = auth.uid());

drop policy if exists "Adicionar referencia como dono ou delegado" on public.referencias;
create policy "Adicionar referencia como dono ou delegado"
  on public.referencias
  for insert
  to public
  with check (
    (criado_por = auth.uid())
    or exists (
      select 1
      from public.delegacoes_acesso da
      where da.concedente_id = referencias.criado_por
        and da.delegado_id = auth.uid()
        and da.revoked_at is null
    )
  );

drop policy if exists "Atualizar referencia como dono ou delegado" on public.referencias;
create policy "Atualizar referencia como dono ou delegado"
  on public.referencias
  for update
  to public
  using (
    (criado_por = auth.uid())
    or exists (
      select 1
      from public.delegacoes_acesso da
      where da.concedente_id = referencias.criado_por
        and da.delegado_id = auth.uid()
        and da.revoked_at is null
    )
    or ((auth.jwt() ->> 'role'::text) = 'admin'::text)
  )
  with check (is_ativa = any (array[true, false]));

drop policy if exists "Remover referencia como dono ou delegado" on public.referencias;
create policy "Remover referencia como dono ou delegado"
  on public.referencias
  for delete
  to public
  using (
    (
      (criado_por = auth.uid())
      or exists (
        select 1
        from public.delegacoes_acesso da
        where da.concedente_id = referencias.criado_por
          and da.delegado_id = auth.uid()
          and da.revoked_at is null
      )
      or ((auth.jwt() ->> 'role'::text) = 'admin'::text)
    )
    and ((is_global = false) or ((auth.jwt() ->> 'role'::text) = 'admin'::text))
    and (not exists (
      select 1
      from public.registros r
      where r.referencia_id = referencias.id
    ))
  );

drop policy if exists "Admin lista referencias" on public.referencias;
create policy "Admin lista referencias"
  on public.referencias
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.usuarios
      where usuarios.id = auth.uid()
        and usuarios.role = 'admin'::text
    )
  );

drop policy if exists "Admin adiciona referencias" on public.referencias;
create policy "Admin adiciona referencias"
  on public.referencias
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.usuarios
      where usuarios.id = auth.uid()
        and usuarios.role = 'admin'::text
    )
  );

drop policy if exists "Admin atualiza referencias" on public.referencias;
create policy "Admin atualiza referencias"
  on public.referencias
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.usuarios
      where usuarios.id = auth.uid()
        and usuarios.role = 'admin'::text
    )
  );

-- public.referencias_favoritas

drop policy if exists "Ver favoritos como dono delegado ou global" on public.referencias_favoritas;
create policy "Ver favoritos como dono delegado ou global"
  on public.referencias_favoritas
  for select
  to public
  using (
    (usuario_id = auth.uid())
    and exists (
      select 1
      from public.referencias r
      where r.id = referencias_favoritas.referencia_id
        and (
          r.is_global = true
          or r.criado_por = auth.uid()
          or exists (
            select 1
            from public.delegacoes_acesso da
            where da.concedente_id = r.criado_por
              and da.delegado_id = auth.uid()
              and da.revoked_at is null
          )
        )
    )
  );

drop policy if exists "Favoritar referencia como dono delegado ou global" on public.referencias_favoritas;
create policy "Favoritar referencia como dono delegado ou global"
  on public.referencias_favoritas
  for insert
  to public
  with check (
    (usuario_id = auth.uid())
    and exists (
      select 1
      from public.referencias r
      where r.id = referencias_favoritas.referencia_id
        and (
          r.is_global = true
          or r.criado_por = auth.uid()
          or exists (
            select 1
            from public.delegacoes_acesso da
            where da.concedente_id = r.criado_por
              and da.delegado_id = auth.uid()
              and da.revoked_at is null
          )
        )
    )
  );

drop policy if exists "Desfavoritar referencia como dono delegado ou global" on public.referencias_favoritas;
create policy "Desfavoritar referencia como dono delegado ou global"
  on public.referencias_favoritas
  for delete
  to public
  using (
    (usuario_id = auth.uid())
    and exists (
      select 1
      from public.referencias r
      where r.id = referencias_favoritas.referencia_id
        and (
          r.is_global = true
          or r.criado_por = auth.uid()
          or exists (
            select 1
            from public.delegacoes_acesso da
            where da.concedente_id = r.criado_por
              and da.delegado_id = auth.uid()
              and da.revoked_at is null
          )
        )
    )
  );

-- public.delegacoes_acesso

drop policy if exists "Listar Delegações" on public.delegacoes_acesso;
create policy "Listar Delegações"
  on public.delegacoes_acesso
  for select
  to public
  using ((concedente_id = auth.uid()) or (delegado_id = auth.uid()));

drop policy if exists "Usuário concede acesso ao proprio perfil" on public.delegacoes_acesso;
create policy "Usuário concede acesso ao proprio perfil"
  on public.delegacoes_acesso
  for insert
  to public
  with check ((concedente_id = auth.uid()) and (delegado_id <> auth.uid()));

drop policy if exists "Usuário revoga acessos concedidos ao proprio perfil" on public.delegacoes_acesso;
create policy "Usuário revoga acessos concedidos ao proprio perfil"
  on public.delegacoes_acesso
  for update
  to public
  using ((concedente_id = auth.uid()) and (revoked_at is null))
  with check (concedente_id = auth.uid());
