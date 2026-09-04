-- ============================================================================
-- Migration: Complemento do backfill ENH-0004 — marcas com parênteses internos
-- Referência: ENH-0004 (.ai/specs/proposed/enhancements/ENH-0004-modelo-identidade-referencias.md)
--
-- A migration 20260904000000 extrai marcas com '[^()]*' (sem parênteses
-- internos). Quatro linhas do seed usam parênteses aninhados dentro da marca —
-- ex.: '(Marca: Kit Kat (Vegan))', '(Marca: Nescau (Light))',
-- '(Marca: Nan Soy (Importado))', "(Marca: America Topping (Rich's))" — e
-- permaneceram com o sufixo no nome e marca canônica. Este complemento
-- (1) remove do nome a ocorrência FINAL de "(Marca: ...)" capturando até o
-- último ')' e (2) promove o conteúdo à coluna marca, com o mesmo
-- canônico de "sem marca" da migration original.
-- ============================================================================

update public.referencias r
set
  nome = trim(regexp_replace(
    regexp_replace(r.nome, '\(Marca:[^()]*\)', '', 'g'),
    '\(Marca:.*\)\s*$',
    '',
    'g'
  )),
  marca = case
    when lower(trim(coalesce(
      (regexp_match(r.nome, '\(Marca:\s*(.*)\)\s*$'))[1], ''
    ))) in (
      '',
      'não se aplica/produto in natura',
      'nao se aplica/produto in natura',
      'não se aplica (produto in natura)',
      'nao se aplica (produto in natura)'
    ) then 'Produto In Natura'
    else trim((regexp_match(r.nome, '\(Marca:\s*(.*)\)\s*$'))[1])
  end
where r.nome ~ '\(Marca:';

-- ----------------------------------------------------------------------------
-- Asserções de consistência (mesmo padrão da migration original)
-- ----------------------------------------------------------------------------
do $$
declare
  v_total_antes   bigint;
  v_total_depois  bigint;
  v_marca_vazia   bigint;
  r record;
begin
  select count(*) into v_total_antes from public.referencias;
  select count(*) into v_total_depois from public.referencias;
  select count(*) into v_marca_vazia
  from public.referencias where btrim(marca) = '';

  raise notice 'ENH-0004 (complemento): total de linhas antes=% depois=% (nenhuma linha perdida: %)',
    v_total_antes, v_total_depois, (v_total_antes = v_total_depois);
  raise notice 'ENH-0004 (complemento): marcas vazias: %', v_marca_vazia;
  raise notice 'ENH-0004 (complemento): linhas com "(Marca:" residual no nome (revisar): %',
    (select count(*) from public.referencias where nome ~ '\(Marca:');

  if v_total_antes <> v_total_depois then
    raise exception 'ENH-0004 (complemento): linhas perdidas (antes=%, depois=%)', v_total_antes, v_total_depois;
  end if;

  if v_marca_vazia > 0 then
    raise exception 'ENH-0004 (complemento): existem marcas vazias após o backfill (%)', v_marca_vazia;
  end if;

  for r in
    select id, nome from public.referencias where nome ~ '\(Marca:'
  loop
    raise notice 'ENH-0004 (complemento): [revisar] id=% nome=%', r.id, r.nome;
  end loop;
end;
$$;
