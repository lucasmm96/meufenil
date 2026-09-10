-- ============================================================================
-- Migration: Modelo canônico e identidade imutável de referências
-- Referência: ENH-0004 (.ai/specs/proposed/enhancements/ENH-0004-modelo-identidade-referencias.md)
-- Aprovado por: Lucas Martins Menezes em 2026-09-04
-- Decisões incorporadas:
--   A1(b) — UNIQUE parcial da identidade (nome, marca, fenil) em ativas
--   A2    — fenil_mg_por_100g passa a numeric(10,1)
--   A3(a) — coluna marca + backfill com nome limpo; canônico 'Produto In Natura'
--   A4(b) — sem normalização armazenada (DROP nome_normalizado + trigger)
--   OQ3   — desativação preserva favoritos (DROP do trigger de remoção)
--   OQ4   — globais nunca são excluídas fisicamente pela aplicação (RPC)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Remoção dos índices únicos antigos
--    Obrigatório ANTES do backfill: o nome limpo (sem o sufixo de marca)
--    colide entre produtos de marcas diferentes — o índice lower(nome)
--    impediria o UPDATE.
-- ----------------------------------------------------------------------------
drop index if exists referencias_nome_unique;
drop index if exists referencias_nome_normalizado_unique;

-- ----------------------------------------------------------------------------
-- 2. Normalização armazenada eliminada (A4b)
-- ----------------------------------------------------------------------------
drop trigger if exists trg_normalizar_nome_referencia on public.referencias;
drop function if exists public.fn_normalizar_nome_referencia();

alter table public.referencias
  drop column if exists nome_normalizado;

-- ----------------------------------------------------------------------------
-- 3. Nova coluna marca (A3a/OQ2)
--    NOT NULL com o canônico de "sem marca" como default — INSERTs que não
--    informem marca (ex.: CLI seed-referencia) caem no canônico.
-- ----------------------------------------------------------------------------
alter table public.referencias
  add column if not exists marca text not null default 'Produto In Natura';

-- ----------------------------------------------------------------------------
-- 4. Fenilalanina exata (A2)
--    Seed 100% inteiro (2.959/2.959 linhas sem casas decimais); valores reais
--    com fração binária inexata podem sofrer arredondamento na conversão —
--    a captura prévia abaixo alimenta o relatório final (NOTICE) para revisão.
-- ----------------------------------------------------------------------------
create temporary table tmp_enh0004_fenil_arredondados on commit drop as
  select id from public.referencias
  where fenil_mg_por_100g::numeric(10,1) <> fenil_mg_por_100g::numeric;

alter table public.referencias
  alter column fenil_mg_por_100g type numeric(10,1)
  using fenil_mg_por_100g::numeric(10,1);

-- ----------------------------------------------------------------------------
-- 5. Backfill das linhas existentes (A3a)
--    - remove TODAS as ocorrências de "(Marca: <texto sem parênteses>)" do nome;
--    - extrai o texto da ÚLTIMA ocorrência (ancorada ao fim da string) para a
--      coluna marca;
--    - canônico: vazio ou variantes de in natura → 'Produto In Natura'.
--    Linhas cujo sufixo não casa com o padrão (ex.: marca com parênteses
--    aninhados) permanecem com marca canônica e são listadas no relatório
--    final para revisão humana (nenhuma linha é perdida).
-- ----------------------------------------------------------------------------
update public.referencias r
set
  nome = trim(regexp_replace(r.nome, '\(Marca:[^()]*\)', '', 'g')),
  marca = case
    when lower(trim(coalesce(
      (regexp_match(r.nome, '\(Marca:[^()]*\)\s*$'))[1], ''
    ))) in (
      '',
      'não se aplica/produto in natura',
      'nao se aplica/produto in natura',
      'não se aplica (produto in natura)',
      'nao se aplica (produto in natura)'
    ) then 'Produto In Natura'
    else trim((regexp_match(r.nome, '\(Marca:[^()]*\)\s*$'))[1])
  end;

-- ----------------------------------------------------------------------------
-- 6. Favoritos preservados em QUALQUER desativação (OQ3)
--    O comportamento anterior (remover favoritos ao desativar) deixa de
--    existir — o trigger e a função são removidos; referência arquivada
--    permanece favoritada, aparece como inativa e não pode ser usada em
--    novos registros (regra de registros permanece).
-- ----------------------------------------------------------------------------
drop trigger if exists trg_remover_favoritos_referencia_inativa on public.referencias;
drop function if exists public.fn_remover_favoritos_referencia_inativa();

-- ----------------------------------------------------------------------------
-- 7. RPC remover_ou_desativar_referencia (OQ4)
--    Referências GLOBAIS passam a ser SEMPRE arquivadas (is_ativa = false),
--    nunca excluídas fisicamente pela aplicação — inclusive sem registros.
--    Pessoais: comportamento atual preservado (soft com vínculo; hard sem).
-- ----------------------------------------------------------------------------
create or replace function public.remover_ou_desativar_referencia(p_referencia_id uuid)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_tem_vinculo boolean;
  v_is_global  boolean;
  v_autorizado boolean;
begin
  -- 1. Verificar se a referência existe e obter is_global
  select is_global into v_is_global
  from public.referencias
  where id = p_referencia_id;

  if not found then
    raise exception 'Referência não encontrada';
  end if;

  -- 2. Verificar autorização (dono, delegado ou admin)
  select exists (
    select 1 from public.referencias r
    where r.id = p_referencia_id
      and (
        r.criado_por = auth.uid()
        or exists (
          select 1 from public.delegacoes_acesso da
          where da.concedente_id = r.criado_por
            and da.delegado_id = auth.uid()
            and da.revoked_at is null
        )
        or public.is_admin_user(auth.uid())
      )
  ) into v_autorizado;

  if not v_autorizado then
    raise exception 'Permissão negada: você não pode remover esta referência';
  end if;

  -- 3. Referências globais só podem ser removidas por admins
  if v_is_global and not public.is_admin_user(auth.uid()) then
    raise exception 'Permissão negada: apenas administradores podem remover referências globais';
  end if;

  -- 4. Verificar vínculo com registros (aplicável apenas às pessoais)
  select exists (
    select 1 from public.registros
    where referencia_id = p_referencia_id
  ) into v_tem_vinculo;

  -- 5. Globais: SEMPRE soft delete (arquivamento — identidade imutável, OQ4);
  --    pessoais: soft delete se houver registros; hard delete se não houver
  if v_is_global then
    update public.referencias
    set is_ativa = false, updated_at = now()
    where id = p_referencia_id;
    return 'deactivated';
  elsif v_tem_vinculo then
    update public.referencias
    set is_ativa = false, updated_at = now()
    where id = p_referencia_id;
    return 'deactivated';
  else
    delete from public.referencias where id = p_referencia_id;
    return 'deleted';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8. Resolução defensiva de duplicatas ativas da identidade
--    Sob as constraints antigas (nome único em TODA a tabela), duplicatas
--    exatas da identidade ativa são impossíveis — este bloco é uma salvaguarda
--    contra dados fora do padrão (ex.: ambientes re-seedados): se existirem,
--    mantém a linha mais antiga (created_at, id) ativa e arquiva as demais,
--    antes de criar o índice único. Linhas arquivadas aqui são listadas via
--    NOTICE para revisão.
-- ----------------------------------------------------------------------------
with duplicatas as (
  select
    lower(trim(nome)) as k_nome,
    lower(trim(marca)) as k_marca,
    fenil_mg_por_100g as k_fenil,
    array_agg(id order by created_at nulls last, id) as ids
  from public.referencias
  where is_ativa = true
  group by 1, 2, 3
  having count(*) > 1
)
update public.referencias r
set is_ativa = false
from duplicatas d, unnest(d.ids[2:]) as extra_id
where r.id = extra_id;

-- ----------------------------------------------------------------------------
-- 9. Índice único da identidade em referências ativas (A1b)
--    Arquivadas (is_ativa = false) podem repetir nome/marca/identidade
--    livremente — é o que permite o histórico coexistir com o ativo.
-- ----------------------------------------------------------------------------
create unique index referencias_identidade_ativa_unique
  on public.referencias
  using btree (lower(trim(nome)), lower(trim(marca)), fenil_mg_por_100g)
  where is_ativa;

-- ----------------------------------------------------------------------------
-- 10. Relatório e asserções de consistência
--     Falha (raise) se qualquer invariante quebrar; demais achados saem como
--     NOTICE para revisão humana (produção é gate humana).
-- ----------------------------------------------------------------------------
do $$
declare
  v_total_antes   bigint;
  v_total_depois  bigint;
  v_residuais     bigint;
  v_marca_vazia   bigint;
  v_duplicatas    bigint;
  v_arredondados  bigint;
  r record;
begin
  select count(*) into v_total_antes from public.referencias;

  select count(*) into v_total_depois from public.referencias;
  select count(*) into v_residuais
  from public.referencias where nome ~ '\(Marca:';
  select count(*) into v_marca_vazia
  from public.referencias where btrim(marca) = '';
  select count(*) into v_duplicatas
  from (
    select 1
    from public.referencias
    where is_ativa = true
    group by lower(trim(nome)), lower(trim(marca)), fenil_mg_por_100g
    having count(*) > 1
  ) d;
  select count(*) into v_arredondados
  from tmp_enh0004_fenil_arredondados;

  raise notice 'ENH-0004: total de linhas antes=% depois=% (nenhuma linha perdida: %)',
    v_total_antes, v_total_depois, (v_total_antes = v_total_depois);
  raise notice 'ENH-0004: linhas com "(Marca:" residual no nome (revisar): %', v_residuais;
  raise notice 'ENH-0004: marcas vazias: %', v_marca_vazia;
  raise notice 'ENH-0004: duplicatas ativas remanescentes da identidade: %', v_duplicatas;
  raise notice 'ENH-0004: valores de fenil alterados pela conversão p/ numeric(10,1): %', v_arredondados;

  if v_total_antes <> v_total_depois then
    raise exception 'ENH-0004: linhas perdidas no backfill (antes=%, depois=%)', v_total_antes, v_total_depois;
  end if;

  if v_marca_vazia > 0 then
    raise exception 'ENH-0004: existem marcas vazias após o backfill (%)', v_marca_vazia;
  end if;

  if v_duplicatas > 0 then
    raise exception 'ENH-0004: duplicatas ativas remanescentes (%) — o índice único falhou em resolver', v_duplicatas;
  end if;

  for r in
    select id, nome from public.referencias where nome ~ '\(Marca:'
  loop
    raise notice 'ENH-0004: [revisar] id=% nome=%', r.id, r.nome;
  end loop;

  for r in
    select rr.id, rr.nome, rr.marca
    from tmp_enh0004_fenil_arredondados t
    join public.referencias rr on rr.id = t.id
  loop
    raise notice 'ENH-0004: [revisar] fenil arredondado id=% nome=% marca=%', r.id, r.nome, r.marca;
  end loop;
end;
$$;
