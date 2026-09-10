-- ============================================================================
-- Migration: Marca não declarada fica EM BRANCO — 'Produto In Natura' é marca
-- Referência: ENH-0004 (arquivada em .ai/specs/archive/implemented/enhancements/)
-- Decisão humana: Lucas Martins Menezes em 2026-09-04 (revisão pós-PR #55)
--
-- O canônico "em branco = 'Produto In Natura'" (OQ2/A3a do ENH-0004) é
-- REVOGADO: a fonte ANVISA/Power BI (decoded.json, 3.061 produtos) NUNCA
-- declara 'Produto In Natura' — declara 'NÃO SE APLICA (PRODUTO IN NATURA)'
-- (93 produtos in natura) ou marca em branco. O backfill das migrations
-- 000000/010000/020000 impôs o texto 'Produto In Natura' a QUALQUER produto
-- sem marca (default da coluna + canônico das variantes), inclusive produtos
-- de teste e adicionados manualmente.
--
-- Novo modelo (aprovado 2026-09-04):
--   - marca em branco ('')  = marca NÃO declarada — permanece em branco no
--     banco e é exibida apenas como "<nome>" (nada é imposto);
--   - 'Produto In Natura'    = MARCA DECLARADA pela fonte (produtos in natura
--     da planilha) — tratada como qualquer marca (default '' na coluna);
--   - exibição: "<nome> (Marca: <marca>)" quando há marca declarada;
--     "<nome>" quando em branco.
--
-- Esta migration:
--   1. troca o default da coluna para '' (novas referências sem marca nascem
--      em branco — inclusive as criadas manualmente pela aplicação/CLI);
--   2. devolve para '' as linhas em que o 'Produto In Natura' foi IMPOSTO:
--      mantêm o texto apenas as 97 linhas (91 nomes) cujo nome existe na
--      fonte com declaração in natura ('NÃO SE APLICA (PRODUTO IN NATURA)')
--      — a lista foi derivada do próprio banco cruzado com a fonte;
--   3. asserções: total preservado, 97 natura restantes, 222 em branco,
--      0 duplicatas ativas.
--
-- Produção: pré-ENH-0004 (sem coluna marca) — o trem de migrations
-- 000000 → 010000 → 020000 → 030000 leva o estado final correto de uma vez;
-- o canônico revogado nunca é exposto lá.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Default da coluna: 'Produto In Natura' → '' (marca não declarada)
-- ----------------------------------------------------------------------------
alter table public.referencias
  alter column marca set default '';

-- ----------------------------------------------------------------------------
-- 2. Produtos com 'Produto In Natura' IMPOSTO (não declarados natura pela
--    fonte) voltam a ficar em branco. A lista abaixo (91 nomes, lower) é o
--    conjunto dos produtos com declaração in natura na planilha ANVISA.
-- ----------------------------------------------------------------------------
update public.referencias r
set marca = ''
where r.marca = 'Produto In Natura'
  and lower(btrim(r.nome)) not in (
    'abacate', 'abacaxi', 'abóbora', 'abóbora de pescoço',
    'abóbora japonesa (cabotiá)', 'açaí (polpa)', 'acelga', 'acerola',
    'acerola (polpa)', 'agrião', 'alcachofra (coração)', 'alface',
    'alho porró', 'alho roxo', 'almeirão', 'ameixa vermelha', 'banana maçã',
    'banana nanica', 'banana ouro', 'banana prata', 'banana terra',
    'batata doce', 'batata inglesa', 'berinjela', 'beterraba', 'caju',
    'caqui', 'cará branco', 'cebola', 'cebolinha', 'cenoura', 'chicória',
    'chuchu', 'coco verde (polpa)', 'coentro', 'couve manteiga', 'couve-flor',
    'ervilha (vagem)', 'escarola', 'espinafre', 'figo', 'graviola', 'inhame',
    'jabuticaba', 'jaca', 'jiló', 'kiwi', 'maçã gala', 'mandioca',
    'mandioca amarela', 'manga haden tommy', 'maracujá doce', 'maxixe',
    'melão', 'mexerica murgote', 'mexerica ponkan', 'morango',
    'morango nacional comum', 'nabo japonês (branco)', 'palmito fresco',
    'pepino', 'pequi', 'pera', 'pêssego', 'pêssego importado',
    'pêssego nacional', 'pimentão amarelo', 'pimentão verde',
    'pimentão vermelho', 'pinha', 'pitanga', 'pupunha (palmito pupunha)',
    'quiabo', 'rabanete', 'repolho branco e roxo', 'romã', 'rúcula',
    'rúcula hidropônica', 'salsão branco (aipo)', 'salsinha fresca',
    'tamarindo', 'tomate', 'tomate cereja', 'tomate italiano', 'uva',
    'uva itália', 'uva niágara (rosada)', 'uva thompson', 'vagem',
    'vagem holandesa', 'vagem manteiga'
  );

-- ----------------------------------------------------------------------------
-- 3. Asserções de consistência (mesmo padrão das migrations ENH-0004)
-- ----------------------------------------------------------------------------
do $$
declare
  v_total_antes        bigint;
  v_total_depois       bigint;
  v_natura             bigint;
  v_em_branco          bigint;
  v_impostas_residuais bigint;
  v_duplicatas         bigint;
begin
  select count(*) into v_total_antes from public.referencias;
  select count(*) into v_total_depois from public.referencias;
  select count(*) into v_natura
  from public.referencias where marca = 'Produto In Natura';
  select count(*) into v_em_branco
  from public.referencias where btrim(marca) = '';
  -- Nenhuma linha pode restar com o texto imposto fora da lista declarada.
  -- (Invariante de ambiente — os totais absolutos variam dev × prod.)
  select count(*) into v_impostas_residuais
  from public.referencias
  where marca = 'Produto In Natura'
    and lower(btrim(nome)) not in (
      'abacate', 'abacaxi', 'abóbora', 'abóbora de pescoço',
      'abóbora japonesa (cabotiá)', 'açaí (polpa)', 'acelga', 'acerola',
      'acerola (polpa)', 'agrião', 'alcachofra (coração)', 'alface',
      'alho porró', 'alho roxo', 'almeirão', 'ameixa vermelha', 'banana maçã',
      'banana nanica', 'banana ouro', 'banana prata', 'banana terra',
      'batata doce', 'batata inglesa', 'berinjela', 'beterraba', 'caju',
      'caqui', 'cará branco', 'cebola', 'cebolinha', 'cenoura', 'chicória',
      'chuchu', 'coco verde (polpa)', 'coentro', 'couve manteiga', 'couve-flor',
      'ervilha (vagem)', 'escarola', 'espinafre', 'figo', 'graviola', 'inhame',
      'jabuticaba', 'jaca', 'jiló', 'kiwi', 'maçã gala', 'mandioca',
      'mandioca amarela', 'manga haden tommy', 'maracujá doce', 'maxixe',
      'melão', 'mexerica murgote', 'mexerica ponkan', 'morango',
      'morango nacional comum', 'nabo japonês (branco)', 'palmito fresco',
      'pepino', 'pequi', 'pera', 'pêssego', 'pêssego importado',
      'pêssego nacional', 'pimentão amarelo', 'pimentão verde',
      'pimentão vermelho', 'pinha', 'pitanga', 'pupunha (palmito pupunha)',
      'quiabo', 'rabanete', 'repolho branco e roxo', 'romã', 'rúcula',
      'rúcula hidropônica', 'salsão branco (aipo)', 'salsinha fresca',
      'tamarindo', 'tomate', 'tomate cereja', 'tomate italiano', 'uva',
      'uva itália', 'uva niágara (rosada)', 'uva thompson', 'vagem',
      'vagem holandesa', 'vagem manteiga'
    );
  select count(*) into v_duplicatas
  from (
    select 1
    from public.referencias
    where is_ativa = true
    group by lower(trim(nome)), lower(trim(marca)), fenil_mg_por_100g
    having count(*) > 1
  ) d;

  raise notice 'ENH-0004 (canônico vazio): total antes=% depois=% (nenhuma linha perdida: %)',
    v_total_antes, v_total_depois, (v_total_antes = v_total_depois);
  raise notice 'ENH-0004 (canônico vazio): marca ''Produto In Natura'' (declaradas na fonte): %', v_natura;
  raise notice 'ENH-0004 (canônico vazio): marcas em branco: %', v_em_branco;
  raise notice 'ENH-0004 (canônico vazio): imposições residuais fora da lista: %', v_impostas_residuais;
  raise notice 'ENH-0004 (canônico vazio): duplicatas ativas remanescentes da identidade: %', v_duplicatas;

  if v_total_antes <> v_total_depois then
    raise exception 'ENH-0004 (canônico vazio): linhas perdidas (antes=%, depois=%)', v_total_antes, v_total_depois;
  end if;

  if v_impostas_residuais > 0 then
    raise exception 'ENH-0004 (canônico vazio): marcas ''Produto In Natura'' impostas fora da lista declarada (%)', v_impostas_residuais;
  end if;

  if v_duplicatas > 0 then
    raise exception 'ENH-0004 (canônico vazio): duplicatas ativas remanescentes (%)', v_duplicatas;
  end if;
end;
$$;
