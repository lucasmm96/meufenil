-- ============================================================================
-- Migration: Correção de dados — invólucro "(Marca: X)" persistido na coluna marca
-- Referência: ENH-0004 (arquivada em .ai/specs/archive/implemented/enhancements/)
-- Bug: PR #55 (merge 82bd0f3, 2026-09-04)
--
-- A migration 20260904000000 extraiu a marca do nome com
--   (regexp_match(r.nome, '\(Marca:[^()]*\)\s*$'))[1]
-- SEM grupo de captura: no Postgres, regexp_match devolve o match INTEIRO
-- quando o padrão não possui parênteses de captura — o invólucro "(Marca: X)"
-- foi persistido VERBATIM na coluna marca. Perfil observado em dev:
-- 2.955 linhas (todo o seed global com sufixo; 0 pessoais) com marca como
-- "(Marca: <conteúdo>)" — ex.: "(Marca: Nestlé Coco)" deveria ser "Nestlé Coco".
-- A migration complementar 20260904010000 usou grupo de captura — por isso
-- apenas as 4 linhas com parênteses aninhados saíram limpas.
--
-- Colateral de frontend: nomeComMarca() monta "Nome (Marca: <marca>)"; com o
-- invólucro persistido, o usuário viu "Alimento ... (Marca: (Marca: Sollys))".
--
-- Esta correção extrai o conteúdo do invólucro COM grupo de captura e aplica
-- o MESMO canônico de "sem marca" das migrations originais (vazio ou
-- variantes de in natura → 'Produto In Natura' — em dev: 93 linhas
-- "Não Se Aplica/Produto In Natura" + 21 vazias). O nome NÃO é tocado —
-- o backfill original já o deixou sem residuais (verificado: 0).
--
-- Colisões: zero após a limpeza + canonicalização no UNIQUE parcial
-- referencias_identidade_ativa_unique (verificado por análise dry-run em dev,
-- com e sem canonicalização) — correção é UPDATE puro, sem merge/desativação.
--
-- Produção: pré-ENH-0004 (sem a coluna marca) — esta correção chega a
-- produção na MESMA release que leva o ENH-0004; o bug nunca é exposto lá.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Correção: extrai o conteúdo interno do invólucro bem-formado
--    "(Marca: <conteúdo>)" (com grupo de captura, ancorado ao início E ao fim)
--    e aplica o canônico de "sem marca". Linhas com invólucro mal-formado
--    (sem o ')' final) NÃO casam com o padrão e permanecem intactas —
--    a seção 2 falha se sobrar qualquer "(Marca:".
-- ----------------------------------------------------------------------------
do $$
declare
  v_corrigidas bigint;
begin
  update public.referencias r
  set marca = case
    when lower(trim(coalesce(
      (regexp_match(r.marca, '^\(Marca:\s*(.*)\)\s*$'))[1], ''
    ))) in (
      '',
      'não se aplica/produto in natura',
      'nao se aplica/produto in natura',
      'não se aplica (produto in natura)',
      'nao se aplica (produto in natura)'
    ) then 'Produto In Natura'
    else trim((regexp_match(r.marca, '^\(Marca:\s*(.*)\)\s*$'))[1])
  end
  where r.marca like '(Marca:%'
    and r.marca like '%)';

  get diagnostics v_corrigidas = row_count;
  raise notice 'ENH-0004 (correção): linhas com invólucro removido da marca: %', v_corrigidas;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Asserções de consistência (mesmo padrão das migrations ENH-0004)
-- ----------------------------------------------------------------------------
do $$
declare
  v_total_antes   bigint;
  v_total_depois  bigint;
  v_residuais     bigint;
  v_marca_vazia   bigint;
  v_duplicatas    bigint;
  r record;
begin
  select count(*) into v_total_antes from public.referencias;
  select count(*) into v_total_depois from public.referencias;
  select count(*) into v_residuais
  from public.referencias where marca ~ '^\(Marca:';
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

  raise notice 'ENH-0004 (correção): total de linhas antes=% depois=% (nenhuma linha perdida: %)',
    v_total_antes, v_total_depois, (v_total_antes = v_total_depois);
  raise notice 'ENH-0004 (correção): marcas com invólucro "(Marca:" residual: %', v_residuais;
  raise notice 'ENH-0004 (correção): marcas vazias: %', v_marca_vazia;
  raise notice 'ENH-0004 (correção): duplicatas ativas remanescentes da identidade: %', v_duplicatas;

  if v_total_antes <> v_total_depois then
    raise exception 'ENH-0004 (correção): linhas perdidas (antes=%, depois=%)', v_total_antes, v_total_depois;
  end if;

  if v_residuais > 0 then
    raise exception 'ENH-0004 (correção): ainda existem marcas com invólucro "(Marca:" (%) — revisar padrões mal-formados', v_residuais;
  end if;

  if v_marca_vazia > 0 then
    raise exception 'ENH-0004 (correção): existem marcas vazias após a correção (%)', v_marca_vazia;
  end if;

  if v_duplicatas > 0 then
    raise exception 'ENH-0004 (correção): duplicatas ativas remanescentes (%)', v_duplicatas;
  end if;

  for r in
    select id, nome, marca from public.referencias where marca ~ '^\(Marca:'
  loop
    raise notice 'ENH-0004 (correção): [revisar] id=% nome=% marca=%', r.id, r.nome, r.marca;
  end loop;
end;
$$;
