-- ============================================================================
-- Migration: FEAT-0017 M6 — seed `pre_sync_inativa` na 1ª sync confiável
-- Referência: FEAT-0017 (.ai/specs/proposed/features/FEAT-0017-sincronizacao-referencias-anvisa.md)
-- Design:     .ai/.temp/feat0017-fase1-design-2026-09-04.md — §14.5 (R4-2a: seed
--             de globais inativas legadas), §6.4 (derivação B8 — bloqueio
--             manual), §11.1 (catálogo de eventos), §16 (M6)
-- Aprovado por: Lucas Martins Menezes em 2026-09-04 (rodada R4 — R4-2a);
--             decisão do local do seed (dentro de aplicar_sync_referencias,
--             transação única) em 2026-09-07
-- Escopo M6:  CREATE OR REPLACE de public.aplicar_sync_referencias com passo de
--             seed condicionado a p_plano.modo = 'bootstrap' (1ª sync
--             confiável do ambiente): grava 1 evento `pre_sync_inativa` por
--             global inativa SEM evento de auditoria — histórico honesto
--             (pré-FEAT todo arquivamento era manual; derivação B8 correta
--             desde o início; volume limitado a globais).
--             Actor NULL: arquivamento pré-auditoria — não é ação do Sistema
--             nem de admin (eventos de migração têm actor NULL; §5.3).
--             Na MESMA transação da aplicação: falha → rollback total, retry
--             limpo na próxima sync (que ainda será bootstrap).
--             Nenhum contador/alteracoes da sync é tocado pelo seed (não é
--             operação de domínio — evento de auditoria apenas).
-- ============================================================================

create or replace function public.aplicar_sync_referencias(p_sync_id uuid, p_plano jsonb)
returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_status       public.sync_status;
  v_sistema_id   uuid;
  v_op           jsonb;
  v_identidade   jsonb;
  v_nome         text;
  v_marca        text;
  v_fenil        numeric(10,1);
  v_novo_id      uuid;
  v_legada_id    uuid;
  v_seed         integer := 0;
  v_criadas      integer := 0;
  v_arquivadas   integer := 0;
  v_divergencias integer := 0;
  v_equivalentes integer := 0;
  v_alteracoes   jsonb := '[]'::jsonb;
begin
  -- Guarda de autorização (§7.5) — chamadas passam só via service_role
  -- (REVOKE/GRANT abaixo; a guarda interna cobre desvios de definer).
  if auth.role() <> 'service_role' then
    raise exception 'Permissão negada: apenas service_role pode aplicar o plano de sync';
  end if;

  -- 1. Plano: presença e versão (contrato com o motor, M3 — PLANO_VERSAO = 1)
  if p_plano is null or p_plano->>'versao' is null then
    raise exception 'Plano de sync ausente ou sem versão';
  end if;
  if p_plano->>'versao' <> '1' then
    raise exception 'Versão de plano não suportada (esperada 1, recebida %)', p_plano->>'versao';
  end if;

  -- 2. Sync deve estar running (a rota finaliza o status depois — estágio 8)
  select status into v_status
  from public.referencia_syncs
  where id = p_sync_id;

  if not found then
    raise exception 'Sync não encontrada: %', p_sync_id;
  end if;
  if v_status <> 'running' then
    raise exception 'Sync não está em execução (status = %)', v_status;
  end if;

  -- 3. Ator Sistema (§12): resolve por email fixo SOMENTE se houver criações
  --    (criado_por NOT NULL e auth.uid() é null sob service_role)
  if jsonb_typeof(p_plano->'criacoes') = 'array'
     and jsonb_array_length(p_plano->'criacoes') > 0 then
    select id into v_sistema_id
    from public.usuarios
    where email = 'sistema@meufenil.local'
    order by created_at
    limit 1;

    if not found then
      raise exception 'Ator Sistema não provisionado (sistema@meufenil.local) — execute scripts/provisionar-ator-sistema.js';
    end if;
  end if;

  -- 4. Criações automáticas (auto-apply pós-bootstrap; nunca reativa, nunca
  --    UPDATE substantivo — identidade nova, is_global = true)
  for v_op in select value from jsonb_array_elements(coalesce(p_plano->'criacoes', '[]'::jsonb)) loop
    if v_op->>'op' <> 'create' then
      raise exception 'Operação desconhecida no plano: %', v_op->>'op';
    end if;

    v_identidade := v_op->'identidade';
    begin
      insert into public.referencias (nome, marca, fenil_mg_por_100g, is_global, is_ativa, criado_por)
      values (
        v_identidade->>'nome',
        coalesce(v_identidade->>'marca', ''),
        (v_identidade->>'fenil_mg_por_100g')::numeric(10,1),
        true,
        true,
        v_sistema_id
      )
      returning id into v_novo_id;
    exception
      when unique_violation then
        -- Estado mudou entre a comparação e a aplicação (design §6.6/§6.7):
        -- identidade já existe ativa → aborta tudo como falha técnica.
        raise exception 'Estado mudou durante a sync: identidade já ativa (%)', v_identidade->>'nome'
          using errcode = '23505';
    end;

    v_criadas := v_criadas + 1;
    v_alteracoes := v_alteracoes || jsonb_build_array(jsonb_build_object(
      'op', 'create',
      'referencia_id', v_novo_id,
      'antes', null::jsonb,
      'depois', v_identidade
    ));

    insert into public.referencia_eventos (sync_id, referencia_id, tipo, actor_id, detalhes)
    values (
      p_sync_id, v_novo_id, 'referencia_criada', v_sistema_id,
      jsonb_build_object('identidade', v_identidade)
    );
  end loop;

  -- 5. Arquivamentos automáticos por ausência (is_ativa = false; nunca DELETE).
  --    Guarda de estado por op: UPDATE ... AND is_ativa + RETURNING — se a
  --    linha mudou entre comparação e aplicação, 0 linhas → exceção (ROLLBACK).
  for v_op in select value from jsonb_array_elements(coalesce(p_plano->'arquivamentos', '[]'::jsonb)) loop
    if v_op->>'op' <> 'archive' then
      raise exception 'Operação desconhecida no plano: %', v_op->>'op';
    end if;

    update public.referencias
    set is_ativa = false, updated_at = now()
    where id = (v_op->>'referencia_id')::uuid
      and is_ativa
    returning nome, marca, fenil_mg_por_100g into v_nome, v_marca, v_fenil;

    if not found then
      raise exception 'Estado mudou durante a sync: referência % não encontrada ou já inativa', v_op->>'referencia_id';
    end if;

    v_arquivadas := v_arquivadas + 1;
    v_identidade := jsonb_build_object('nome', v_nome, 'marca', v_marca, 'fenil_mg_por_100g', v_fenil);
    v_alteracoes := v_alteracoes || jsonb_build_array(jsonb_build_object(
      'op', 'archive',
      'referencia_id', (v_op->>'referencia_id')::uuid,
      'antes', v_identidade,
      'depois', null::jsonb
    ));

    insert into public.referencia_eventos (sync_id, referencia_id, tipo, actor_id, detalhes)
    values (
      p_sync_id, (v_op->>'referencia_id')::uuid, 'referencia_arquivada', v_sistema_id,
      jsonb_build_object('identidade', v_identidade)
    );
  end loop;

  -- 6. Pendências open (curadoria) — 1:1 do plano, com diff estruturado (§8)
  for v_op in select value from jsonb_array_elements(coalesce(p_plano->'pendencias', '[]'::jsonb)) loop
    insert into public.referencia_sync_pendencias (sync_id, tipo, referencia_id, proposta, diff)
    values (
      p_sync_id,
      (v_op->>'tipo')::public.sync_pendencia_tipo,
      (v_op->>'referencia_id')::uuid,
      v_op->'proposta',
      v_op->'diff'
    );

    v_divergencias := v_divergencias + 1;
  end loop;

  -- 7. Seed de globais inativas legadas (R4-2a/§14.5) — SOMENTE na 1ª sync
  --    confiável do ambiente (modo bootstrap do plano; o motor nunca emite
  --    bootstrap com efeito automático): 1 evento `pre_sync_inativa` por global
  --    inativa sem NENHUM evento de auditoria (arquivamento manual pré-FEAT,
  --    anterior à auditoria — actor NULL, §5.3). Evento idempotente por
  --    construção: uma vez gravado, a global deixa de ser candidata. Mesma
  --    transação da aplicação: qualquer falha desfaz ops, pendências e seed.
  if p_plano->>'modo' = 'bootstrap' then
    for v_legada_id in
      select r.id
      from public.referencias r
      where r.is_global
        and not r.is_ativa
        and not exists (
          select 1 from public.referencia_eventos e
          where e.referencia_id = r.id
        )
    loop
      insert into public.referencia_eventos (sync_id, referencia_id, tipo, detalhes)
      values (p_sync_id, v_legada_id, 'pre_sync_inativa', '{}'::jsonb);

      v_seed := v_seed + 1;
    end loop;
  end if;

  -- 8. Contadores e log de alterações da sync (a rota finaliza o status no
  --    estágio 8 com base no resumo retornado). equivalentes vem do resumo do
  --    plano — não é rederivável no SQL (matching é do motor). O seed não
  --    altera contadores (evento de auditoria; não é operação de domínio).
  v_equivalentes := coalesce((p_plano->'resumo'->>'equivalentes')::integer, 0);

  update public.referencia_syncs
  set
    equivalentes = v_equivalentes,
    criadas      = v_criadas,
    arquivadas   = v_arquivadas,
    divergencias = v_divergencias,
    alteracoes   = v_alteracoes
  where id = p_sync_id;

  return jsonb_build_object(
    'sync_id', p_sync_id,
    'equivalentes', v_equivalentes,
    'criadas', v_criadas,
    'arquivadas', v_arquivadas,
    'divergencias', v_divergencias
  );
end;
$$;

-- REVOKE/GRANT inalterados (aplicar: exclusivo service_role — §7.5/M4)
revoke all on function public.aplicar_sync_referencias(uuid, jsonb) from public;
grant execute on function public.aplicar_sync_referencias(uuid, jsonb) to service_role;
