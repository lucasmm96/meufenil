-- ============================================================================
-- Migration: FEAT-0017 M4 — RPCs de aplicação da sync e curadoria
-- Referência: FEAT-0017 (.ai/specs/proposed/features/FEAT-0017-sincronizacao-referencias-anvisa.md)
-- Design:     .ai/.temp/feat0017-fase1-design-2026-09-04.md — §7.5 (RPC aplicar,
--             transação única), §8 (RPC decidir), §11.3 (GUC app.audit_origin,
--             D-7), §12 (ator Sistema), §16 (M4)
-- Aprovado por: Lucas Martins Menezes em 2026-09-04 (B1–B10 R1–R3; rodada R4);
--             plano de marcos M4 aprovado em 2026-09-06
-- Escopo M4:  RPCs SECURITY DEFINER padrão ADR-0010:
--             - aplicar_sync_referencias (service_role only) — aplica o plano
--               do motor (p_plano jsonb, M3) numa transação única: ops
--               automáticas (criar global/arquivar ausente), pendências open,
--               eventos referencia_criada/referencia_arquivada (actor
--               Sistema), contadores e alteracoes da sync;
--             - decidir_pendencia_referencia (admin) — curadoria de pendência
--               open: aprovar (por tipo: substitution = arquivar atual + criar
--               proposta; absence = arquivar; new_item = criar proposta) ou
--               rejeitar (motivo obrigatório, nenhuma alteração de dados).
--             Nunca: reativa, toca is_global=false, DELETE, decide fora de
--             pendência, aplica sync fora de running.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. public.aplicar_sync_referencias(uuid, jsonb) (§7.5) — service_role only
--    SECURITY DEFINER + set search_path (ADR-0010). Guarda de role interna +
--    REVOKE/GRANT (sem EXECUTE para anon/authenticated). Statement atômico
--    via postgREST: qualquer exceção desfaz ops, pendências, eventos e
--    contadores (design §6.7/§7.5 — nada parcial).
--    O ator Sistema (B5/§12) é resolvido por email fixo e é obrigatório apenas
--    quando o plano cria linhas (criado_por NOT NULL sob service_role);
--    ausente → exceção clara de provisionamento (fail-high).
-- ----------------------------------------------------------------------------
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

  -- 7. Contadores e log de alterações da sync (a rota finaliza o status no
  --    estágio 8 com base no resumo retornado). equivalentes vem do resumo do
  --    plano — não é rederivável no SQL (matching é do motor).
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

-- ----------------------------------------------------------------------------
-- 2. public.decidir_pendencia_referencia(uuid, boolean, text) (§8) — admin
--    SECURITY DEFINER + search_path; guarda is_admin_user(auth.uid()).
--    Pendência deve estar open (terminal não recebe nova decisão); não
--    encontrada/terminal → exceção PENDENCIA_NAO_ENCONTRADA.
--    Aprovar por tipo (transação única): substitution = arquivar a atual +
--    criar a proposta; absence = arquivar; new_item = criar a proposta.
--    Linhas criadas têm criado_por = Sistema (B5); eventos mudanca_aprovada +
--    referencia_* têm actor = admin que decidiu (auth.uid()). GUC
--    app.audit_origin = 'curadoria' (local à transação) suprime o trigger
--    trg_auditar_is_ativa_manual no arquivamento (D-7/§11.3) — o evento
--    específico já é registrado aqui.
--    Rejeitar: motivo obrigatório (CHECK do M1 reforçado aqui); nenhuma
--    alteração de dados; evento mudanca_rejeitada (motivo).
--    Última pendência open da sync decidida → sync status = 'success'
--    (divergências rejeitadas conhecidas = sincronizado, §6.1/§15).
-- ----------------------------------------------------------------------------
create or replace function public.decidir_pendencia_referencia(
  p_pendencia_id uuid,
  p_aprovar boolean,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_pendencia     record;
  v_sync_status   public.sync_status;
  v_sistema_id    uuid;
  v_proposta      jsonb;
  v_identidade    jsonb;
  v_detalhes      jsonb;
  v_nome          text;
  v_marca         text;
  v_fenil         numeric(10,1);
  v_novo_id       uuid;
  v_alteracoes    jsonb := '[]'::jsonb;
  v_criou         boolean := false;
  v_arquivou      boolean := false;
  v_abertas       integer;
begin
  -- Guarda de autorização (§8): decisão é ação de admin (is_admin_user)
  if not public.is_admin_user(auth.uid()) then
    raise exception 'Permissão negada: apenas administradores podem decidir pendências';
  end if;

  -- Pendência alvo com lock de linha (duas decisões concorrentes na mesma
  -- pendência: a segunda vê status ≠ open e falha)
  select p.sync_id, p.tipo, p.referencia_id, p.proposta, p.diff, p.status
  into v_pendencia
  from public.referencia_sync_pendencias p
  where p.id = p_pendencia_id
  for update of p;

  if not found then
    raise exception 'PENDENCIA_NAO_ENCONTRADA: pendência inexistente';
  end if;

  if v_pendencia.status <> 'open' then
    raise exception 'PENDENCIA_NAO_ENCONTRADA: pendência não está aberta para decisão (status = %)', v_pendencia.status;
  end if;

  -- Decisão só sobre sync concluída (pendências existem após a aplicação; a
  -- UI não expõe sync running — §6.7)
  select status into v_sync_status
  from public.referencia_syncs
  where id = v_pendencia.sync_id;

  if v_sync_status = 'running' then
    raise exception 'Sync ainda em execução — aguarde a conclusão antes de decidir';
  end if;

  if not p_aprovar then
    -- Rejeição: nenhuma alteração de dados; divergência vira conhecida (§15)
    if p_motivo is null or btrim(p_motivo) = '' then
      raise exception 'Rejeição exige motivo (p_motivo)';
    end if;

    update public.referencia_sync_pendencias
    set status = 'rejected', motivo = btrim(p_motivo), decided_at = now(), decided_by = auth.uid()
    where id = p_pendencia_id;

    insert into public.referencia_eventos (sync_id, pendencia_id, referencia_id, tipo, actor_id, detalhes)
    values (
      v_pendencia.sync_id, p_pendencia_id, v_pendencia.referencia_id,
      'mudanca_rejeitada', auth.uid(),
      jsonb_build_object('tipo', v_pendencia.tipo, 'motivo', btrim(p_motivo))
    );
  else
    -- Aprovação por tipo (§8): absence arquiva; new_item cria; substitution
    -- arquiva a atual e cria a proposta. Guardas de estado idênticas ao
    -- aplicar; 23505 (identidade já ativa) → exceção → ROLLBACK total.
    v_proposta := v_pendencia.proposta;
    v_arquivou := v_pendencia.tipo in ('absence', 'substitution');
    v_criou    := v_pendencia.tipo in ('new_item', 'substitution');

    if v_pendencia.tipo not in ('substitution', 'absence', 'new_item') then
      raise exception 'Tipo de pendência desconhecido: %', v_pendencia.tipo;
    end if;

    if v_arquivou and v_pendencia.referencia_id is null then
      raise exception 'Pendência % sem referência alvo para arquivar', v_pendencia.tipo;
    end if;

    if v_criou and (v_proposta is null or v_proposta->>'nome' is null) then
      raise exception 'Pendência % sem proposta válida para criar', v_pendencia.tipo;
    end if;

    -- GUC D-7: o arquivamento abaixo NÃO gera evento is_ativa_manual duplicado
    -- (o evento específico desta decisão é registrado aqui)
    perform set_config('app.audit_origin', 'curadoria', true);

    if v_arquivou then
      update public.referencias
      set is_ativa = false, updated_at = now()
      where id = v_pendencia.referencia_id
        and is_ativa
      returning nome, marca, fenil_mg_por_100g into v_nome, v_marca, v_fenil;

      if not found then
        raise exception 'Estado mudou: referência % não encontrada ou já inativa', v_pendencia.referencia_id;
      end if;

      v_identidade := jsonb_build_object('nome', v_nome, 'marca', v_marca, 'fenil_mg_por_100g', v_fenil);
      v_alteracoes := v_alteracoes || jsonb_build_array(jsonb_build_object(
        'op', 'archive',
        'referencia_id', v_pendencia.referencia_id,
        'antes', v_identidade,
        'depois', null::jsonb
      ));
    end if;

    if v_criou then
      select id into v_sistema_id
      from public.usuarios
      where email = 'sistema@meufenil.local'
      order by created_at
      limit 1;

      if not found then
        raise exception 'Ator Sistema não provisionado (sistema@meufenil.local) — execute scripts/provisionar-ator-sistema.js';
      end if;

      begin
        insert into public.referencias (nome, marca, fenil_mg_por_100g, is_global, is_ativa, criado_por)
        values (
          v_proposta->>'nome',
          coalesce(v_proposta->>'marca', ''),
          (v_proposta->>'fenil_mg_por_100g')::numeric(10,1),
          true,
          true,
          v_sistema_id
        )
        returning id into v_novo_id;
      exception
        when unique_violation then
          raise exception 'Estado mudou: identidade da proposta já está ativa (%)', v_proposta->>'nome'
            using errcode = '23505';
      end;

      v_alteracoes := v_alteracoes || jsonb_build_array(jsonb_build_object(
        'op', 'create',
        'referencia_id', v_novo_id,
        'antes', null::jsonb,
        'depois', v_proposta
      ));
    end if;

    -- Eventos da decisão (actor = admin que decidiu)
    v_detalhes := jsonb_build_object('tipo', v_pendencia.tipo, 'diff', v_pendencia.diff);
    if p_motivo is not null and btrim(p_motivo) <> '' then
      v_detalhes := v_detalhes || jsonb_build_object('motivo', btrim(p_motivo));
    end if;

    insert into public.referencia_eventos (sync_id, pendencia_id, referencia_id, tipo, actor_id, detalhes)
    values (
      v_pendencia.sync_id, p_pendencia_id, v_pendencia.referencia_id,
      'mudanca_aprovada', auth.uid(), v_detalhes
    );

    if v_arquivou then
      insert into public.referencia_eventos (sync_id, pendencia_id, referencia_id, tipo, actor_id, detalhes)
      values (
        v_pendencia.sync_id, p_pendencia_id, v_pendencia.referencia_id,
        'referencia_arquivada', auth.uid(),
        jsonb_build_object('identidade', v_identidade)
      );
    end if;

    if v_criou then
      insert into public.referencia_eventos (sync_id, pendencia_id, referencia_id, tipo, actor_id, detalhes)
      values (
        v_pendencia.sync_id, p_pendencia_id, v_novo_id,
        'referencia_criada', auth.uid(),
        jsonb_build_object('identidade', v_proposta)
      );
    end if;

    update public.referencia_sync_pendencias
    set status = 'approved', decided_at = now(), decided_by = auth.uid()
    where id = p_pendencia_id;

    -- Contadores e log de alterações da sync da pendência (incremento)
    if v_criou or v_arquivou then
      update public.referencia_syncs
      set
        criadas    = criadas + case when v_criou then 1 else 0 end,
        arquivadas = arquivadas + case when v_arquivou then 1 else 0 end,
        alteracoes = alteracoes || v_alteracoes
      where id = v_pendencia.sync_id;
    end if;
  end if;

  -- Última pendência open da sync decidida → success (§6.1/§8): divergências
  -- rejeitadas são conhecidas e válidas — a sync está concluída.
  select count(*) into v_abertas
  from public.referencia_sync_pendencias
  where sync_id = v_pendencia.sync_id
    and status = 'open';

  if v_abertas = 0 then
    update public.referencia_syncs
    set status = 'success',
        message = 'Curadoria concluída — todas as pendências foram decididas'
    where id = v_pendencia.sync_id
      and status = 'pending_review';
  end if;

  select status into v_sync_status
  from public.referencia_syncs
  where id = v_pendencia.sync_id;

  return jsonb_build_object(
    'pendencia_id', p_pendencia_id,
    'status', case when p_aprovar then 'approved' else 'rejected' end,
    'sync_id', v_pendencia.sync_id,
    'sync_status', v_sync_status
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. REVOKE/GRANT de EXECUTE (§7.5/§8)
--    aplicar: exclusivo service_role (rota Vercel/scripts) — nenhum papel de
--    cliente pode aplicar plano; guarda de role interna como segunda barreira.
--    decidir: authenticated (a guarda interna is_admin_user decide); service_
--    role fora (curadoria é ação humana de admin com sessão).
-- ----------------------------------------------------------------------------
revoke all on function public.aplicar_sync_referencias(uuid, jsonb) from public;
grant execute on function public.aplicar_sync_referencias(uuid, jsonb) to service_role;

revoke all on function public.decidir_pendencia_referencia(uuid, boolean, text) from public;
grant execute on function public.decidir_pendencia_referencia(uuid, boolean, text) to authenticated;
