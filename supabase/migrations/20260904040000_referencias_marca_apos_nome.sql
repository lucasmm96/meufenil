-- ============================================================================
-- Migration: Reordenação FÍSICA das colunas — `marca` imediatamente após `nome`
-- Referência: ENH-0004 (arquivada em .ai/specs/archive/implemented/enhancements/)
-- Decisão humana: Lucas Martins Menezes em 2026-09-04
--
-- Motivação: o usuário pediu que a coluna `marca` fique "logo após a coluna
-- nome" também no SCHEMA do banco (ordem física das colunas). Embora a ordem
-- de colunas NÃO tenha significado funcional no Postgres (quem decide a ordem
-- visual é o frontend), a solicitação foi explícita — e registrada aqui para
-- que a release (trem 000000 → 040000) entregue a PRODUÇÃO já com o layout
-- final: `id, nome, marca, fenil_mg_por_100g, criado_por, ...`.
--
-- O Postgres não suporta "ALTER TABLE ... ADD COLUMN ... AFTER" — a ordem
-- física só muda recriando a tabela. Sequência (transacional — supabase db
-- push aplica cada migration em transação única):
--   1. renomeia a tabela atual para referencias_old (libera o nome);
--   2. remove as FKs dos filhos (apontariam para a tabela antiga e impediriam
--      o drop sem CASCADE);
--   3. recria public.referencias com a ordem desejada e defaults IDÊNTICOS
--      aos atuais (aferidos no catálogo dev 2026-09-04);
--   4. copia os dados com lista explícita de colunas (a ordem nova não
--      interfere — 3.164 linhas em dev);
--   5. remove as 4 políticas de TABELAS-FILHAS que dependem de referencias por
--      OID (descoberta na 1ª aplicação: SQLSTATE 2BP01 — "Inserir registro
--      apenas com referencia ativa" em registros e Ver/Favoritar/Desfavoritar
--      em referencias_favoritas; pg_policies resolve o nome no momento do
--      create e fixa o OID — com a tabela renomeada, o drop sem CASCADE é
--      bloqueado por elas); recriadas no passo 9;
--   6. dropa referencias_old (libera os nomes de índice, que são únicos por
--      schema: referencias_pkey e referencias_identidade_ativa_unique);
--   7. recria PK, FK → usuarios e o índice único parcial;
--   8. reponta as FKs dos filhos (registros sem CASCADE; referencias_favoritas
--      com ON DELETE CASCADE — nomes exatos do catálogo dev);
--   9. recria RLS (enable), as 10 políticas da própria tabela e as 4
--      políticas cross-tabela — reprodução literal do catálogo dev;
--  10. recria os grants (ALL para anon/authenticated/service_role);
--  11. asserções (total > 0, posição de marca = nome + 1, 10 políticas na
--      tabela + 4 nas filhas, 0 triggers, 0 duplicatas ativas).
--
-- Produção: pré-ENH-0004 (sem coluna marca) — esta migration roda no fim do
-- trem de release e entrega o mesmo layout final; o canônico revogado e o
-- bug do invólucro nunca são expostos lá.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabela atual sai de cena (libera o nome public.referencias)
-- ----------------------------------------------------------------------------
alter table public.referencias rename to referencias_old;

-- ----------------------------------------------------------------------------
-- 2. FKs dos filhos removidas (serão repontadas no passo 8)
-- ----------------------------------------------------------------------------
alter table public.registros
  drop constraint registros_referencia_id_fkey;
alter table public.referencias_favoritas
  drop constraint referencias_favoritas_referencia_fk;

-- ----------------------------------------------------------------------------
-- 3. Nova tabela: marca logo após nome — defaults idênticos aos atuais
-- ----------------------------------------------------------------------------
create table public.referencias (
  id uuid not null default gen_random_uuid(),
  nome text not null,
  marca text not null default ''::text,
  fenil_mg_por_100g numeric(10, 1) not null,
  criado_por uuid not null default auth.uid(),
  is_global boolean not null default false,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  is_ativa boolean not null default true
);

-- ----------------------------------------------------------------------------
-- 4. Cópia dos dados (lista explícita de colunas — ordem não interfere)
-- ----------------------------------------------------------------------------
insert into public.referencias (
  id, nome, marca, fenil_mg_por_100g, criado_por, is_global,
  created_at, updated_at, is_ativa
)
select
  id, nome, marca, fenil_mg_por_100g, criado_por, is_global,
  created_at, updated_at, is_ativa
from public.referencias_old;

-- ----------------------------------------------------------------------------
-- 5. Políticas de TABELAS-FILHAS removidas — dependem de referencias por OID e
--    bloqueariam o drop da tabela antiga (2BP01 na 1ª aplicação). A referência
--    é resolvida e fixada no CREATE POLICY; recriadas no passo 9.
-- ----------------------------------------------------------------------------
drop policy "Inserir registro apenas com referencia ativa"
  on public.registros;

drop policy "Ver favoritos como dono delegado ou global"
  on public.referencias_favoritas;

drop policy "Favoritar referencia como dono delegado ou global"
  on public.referencias_favoritas;

drop policy "Desfavoritar referencia como dono delegado ou global"
  on public.referencias_favoritas;

-- ----------------------------------------------------------------------------
-- 6. Tabela antiga removida (libera os nomes de índice, únicos por schema)
-- ----------------------------------------------------------------------------
drop table public.referencias_old;

-- ----------------------------------------------------------------------------
-- 7. PK, FK → usuarios e índice único parcial recriados
-- ----------------------------------------------------------------------------
alter table public.referencias
  add constraint referencias_pkey primary key (id);

alter table public.referencias
  add constraint referencias_criado_por_fkey
  foreign key (criado_por) references public.usuarios (id) on delete cascade;

create unique index referencias_identidade_ativa_unique
  on public.referencias using btree (
    lower(trim(both from nome)),
    lower(trim(both from marca)),
    fenil_mg_por_100g
  )
  where is_ativa;

-- ----------------------------------------------------------------------------
-- 8. FKs dos filhos repontadas para a nova tabela (regras do catálogo dev)
-- ----------------------------------------------------------------------------
alter table public.registros
  add constraint registros_referencia_id_fkey
  foreign key (referencia_id) references public.referencias (id);

alter table public.referencias_favoritas
  add constraint referencias_favoritas_referencia_fk
  foreign key (referencia_id) references public.referencias (id)
  on delete cascade;

-- ----------------------------------------------------------------------------
-- 9. RLS + políticas (reprodução literal do catálogo dev — 2026-09-04):
--    9a. 10 políticas da própria tabela; 9b. as 4 políticas cross-tabela que
--    foram removidas no passo 5 — agora resolvidas para o NOVO OID de
--    public.referencias.
-- ----------------------------------------------------------------------------
alter table public.referencias enable row level security;

create policy "Usuário lista referências"
  on public.referencias for select to public
  using ((is_global = true) or (criado_por = auth.uid()));

create policy "Usuário lista referências globais ou próprias"
  on public.referencias for select to public
  using ((is_global = true) or (criado_por = auth.uid()));

create policy "Listar referencia como dono ou delegado"
  on public.referencias for select to public
  using (
    (criado_por = auth.uid())
    or exists (
      select 1 from public.delegacoes_acesso da
      where da.concedente_id = referencias.criado_por
        and da.delegado_id = auth.uid()
        and da.revoked_at is null
    )
  );

create policy "Usuário cria própria referencia"
  on public.referencias for insert to public
  with check (criado_por = auth.uid());

create policy "Adicionar referencia como dono ou delegado"
  on public.referencias for insert to public
  with check (
    (criado_por = auth.uid())
    or exists (
      select 1 from public.delegacoes_acesso da
      where da.concedente_id = referencias.criado_por
        and da.delegado_id = auth.uid()
        and da.revoked_at is null
    )
  );

create policy "Atualizar referencia como dono ou delegado"
  on public.referencias for update to public
  using (
    (criado_por = auth.uid())
    or exists (
      select 1 from public.delegacoes_acesso da
      where da.concedente_id = referencias.criado_por
        and da.delegado_id = auth.uid()
        and da.revoked_at is null
    )
    or ((auth.jwt() ->> 'role'::text) = 'admin'::text)
  )
  with check (is_ativa = any (array[true, false]));

create policy "Remover referencia como dono ou delegado"
  on public.referencias for delete to public
  using (
    (
      (criado_por = auth.uid())
      or exists (
        select 1 from public.delegacoes_acesso da
        where da.concedente_id = referencias.criado_por
          and da.delegado_id = auth.uid()
          and da.revoked_at is null
      )
      or ((auth.jwt() ->> 'role'::text) = 'admin'::text)
    )
    and ((is_global = false) or ((auth.jwt() ->> 'role'::text) = 'admin'::text))
    and (
      not exists (
        select 1 from public.registros r
        where r.referencia_id = referencias.id
      )
    )
  );

create policy "Admin lista referencias"
  on public.referencias for select to authenticated
  using (
    exists (
      select 1 from public.usuarios
      where usuarios.id = auth.uid()
        and usuarios.role = 'admin'::text
    )
  );

create policy "Admin adiciona referencias"
  on public.referencias for insert to authenticated
  with check (
    exists (
      select 1 from public.usuarios
      where usuarios.id = auth.uid()
        and usuarios.role = 'admin'::text
    )
  );

create policy "Admin atualiza referencias"
  on public.referencias for update to authenticated
  using (
    exists (
      select 1 from public.usuarios
      where usuarios.id = auth.uid()
        and usuarios.role = 'admin'::text
    )
  );

-- 9b. Políticas cross-tabela recriadas (qual/with_check literais do pg_policies
--     dev; agora resolvidas para o novo OID de public.referencias)
create policy "Inserir registro apenas com referencia ativa"
  on public.registros for insert to public
  with check (
    exists (
      select 1 from public.referencias r
      where r.id = registros.referencia_id
        and r.is_ativa = true
    )
  );

create policy "Ver favoritos como dono delegado ou global"
  on public.referencias_favoritas for select to public
  using (
    (usuario_id = auth.uid())
    and exists (
      select 1 from public.referencias r
      where r.id = referencias_favoritas.referencia_id
        and (
          r.is_global = true
          or r.criado_por = auth.uid()
          or exists (
            select 1 from public.delegacoes_acesso da
            where da.concedente_id = r.criado_por
              and da.delegado_id = auth.uid()
              and da.revoked_at is null
          )
        )
    )
  );

create policy "Favoritar referencia como dono delegado ou global"
  on public.referencias_favoritas for insert to public
  with check (
    (usuario_id = auth.uid())
    and exists (
      select 1 from public.referencias r
      where r.id = referencias_favoritas.referencia_id
        and (
          r.is_global = true
          or r.criado_por = auth.uid()
          or exists (
            select 1 from public.delegacoes_acesso da
            where da.concedente_id = r.criado_por
              and da.delegado_id = auth.uid()
              and da.revoked_at is null
          )
        )
    )
  );

create policy "Desfavoritar referencia como dono delegado ou global"
  on public.referencias_favoritas for delete to public
  using (
    (usuario_id = auth.uid())
    and exists (
      select 1 from public.referencias r
      where r.id = referencias_favoritas.referencia_id
        and (
          r.is_global = true
          or r.criado_por = auth.uid()
          or exists (
            select 1 from public.delegacoes_acesso da
            where da.concedente_id = r.criado_por
              and da.delegado_id = auth.uid()
              and da.revoked_at is null
          )
        )
    )
  );

-- ----------------------------------------------------------------------------
-- 10. Grants (ALL — mesmo padrão do catálogo dev para anon/authenticated/
--     service_role; owner postgres é implícito)
-- ----------------------------------------------------------------------------
grant all on table public.referencias to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 11. Asserções de consistência
-- ----------------------------------------------------------------------------
do $$
declare
  v_total           bigint;
  v_pos_nome        int;
  v_pos_marca       int;
  v_policies        int;
  v_policies_filhas int;
  v_triggers        int;
  v_duplicatas      bigint;
begin
  select count(*) into v_total from public.referencias;
  if v_total < 1 then
    raise exception 'ENH-0004 (reordenação): tabela referencias ficou vazia (%)', v_total;
  end if;

  -- marca deve estar imediatamente após nome (pedido do usuário 2026-09-04)
  select ordinal_position into v_pos_nome
  from information_schema.columns
  where table_schema = 'public' and table_name = 'referencias'
    and column_name = 'nome';
  select ordinal_position into v_pos_marca
  from information_schema.columns
  where table_schema = 'public' and table_name = 'referencias'
    and column_name = 'marca';
  if v_pos_marca <> v_pos_nome + 1 then
    raise exception 'ENH-0004 (reordenação): marca deveria vir logo após nome (nome=%, marca=%)', v_pos_nome, v_pos_marca;
  end if;

  select count(*) into v_policies
  from pg_policies where schemaname = 'public' and tablename = 'referencias';
  if v_policies <> 10 then
    raise exception 'ENH-0004 (reordenação): esperadas 10 políticas RLS na tabela, encontradas %', v_policies;
  end if;

  -- 4 políticas cross-tabela (1 em registros + 3 em referencias_favoritas)
  -- devem apontar para o NOVO OID de public.referencias
  select count(*) into v_policies_filhas
  from pg_policies
  where schemaname = 'public'
    and (
      (tablename = 'registros' and policyname = 'Inserir registro apenas com referencia ativa')
      or (tablename = 'referencias_favoritas' and policyname in (
        'Ver favoritos como dono delegado ou global',
        'Favoritar referencia como dono delegado ou global',
        'Desfavoritar referencia como dono delegado ou global'
      ))
    );
  if v_policies_filhas <> 4 then
    raise exception 'ENH-0004 (reordenação): esperadas 4 políticas cross-tabela recriadas, encontradas %', v_policies_filhas;
  end if;

  select count(*) into v_triggers
  from information_schema.triggers
  where event_object_schema = 'public' and event_object_table = 'referencias';
  if v_triggers <> 0 then
    raise exception 'ENH-0004 (reordenação): triggers inesperados na nova tabela (%)', v_triggers;
  end if;

  select count(*) into v_duplicatas
  from (
    select 1
    from public.referencias
    where is_ativa = true
    group by lower(trim(nome)), lower(trim(marca)), fenil_mg_por_100g
    having count(*) > 1
  ) d;
  if v_duplicatas > 0 then
    raise exception 'ENH-0004 (reordenação): duplicatas ativas (%)', v_duplicatas;
  end if;

  raise notice 'ENH-0004 (reordenação): total de linhas preservado: %', v_total;
  raise notice 'ENH-0004 (reordenação): ordem física OK — marca na posição % (nome %)', v_pos_marca, v_pos_nome;
  raise notice 'ENH-0004 (reordenação): políticas RLS recriadas: % na tabela + % nas filhas; triggers: %', v_policies, v_policies_filhas, v_triggers;
end;
$$;
