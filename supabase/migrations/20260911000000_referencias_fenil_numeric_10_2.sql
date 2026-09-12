-- ============================================================================
-- Migration: FEAT-0017 — fenil_mg_por_100g de numeric(10,1) para numeric(10,2)
-- Referência: FEAT-0017 (sincronização de referências ANVISA/Power BI)
-- Aprovado por: Lucas Martins Menezes em 2026-09-11 (requisito: fidelidade ao
--               valor da origem, que pode trazer até 2 casas decimais)
-- ============================================================================
-- Por que:
--   A ENH-0004 (A2, 2026-09-04) fixou `numeric(10,1)` sob a premissa de que o
--   seed era 100% inteiro (2.959/2.959). Com a FEAT-0017 a origem passou a
--   entregar valores com fração (ex.: 5.42 mg/100g) e `numeric(10,1)` os
--   arredondaria SILENCIOSAMENTE na escrita — perda do valor extraído,
--   incompatível com o requisito de fidelidade ao dado de origem.
--   A decisão de exatidão decimal (numeric em vez de real) permanece; muda
--   apenas a escala.
--
-- Conversão sem perda:
--   A ampliação 10,1 → 10,2 é exata: todo valor armazenado em escala 1 é
--   representável em escala 2 (nenhum arredondamento no ALTER). Não há
--   relatório de valores alterados porque nenhum valor é alterado.
--
-- RPCs:
--   As funções abaixo declaravam variável local `numeric(10,1)` e/ou faziam
--   cast explícito `::numeric(10,1)` na escrita/comparação — cada uma delas
--   reintroduziria o arredondamento e anularia o efeito do ALTER:
--     - aplicar_sync_referencias(uuid, jsonb)        — cast no INSERT
--     - decidir_pendencia_referencia(uuid, bool, text) — cast no INSERT
--     - reverter_sync_referencias(uuid)              — cast na comparação do
--       guard de "preservar alteração posterior" (compararia 5.4 com 5.42 e
--       daria skip indevido)
--     - restaurar_referencias_de_backup(uuid)        — escala da tabela temp e
--       cast do payload do backup
--   São recriadas via CREATE OR REPLACE (assinaturas inalteradas; ACLs
--   preservadas pela substituição in loco — os REVOKE/GRANT abaixo apenas
--   reafirmam a intenção original).
--
-- RISCO: ALTER TABLE (schema) — alto risco. Aplicar via
--   scripts/apply-supabase-migrations.sh --env development. Nunca automático.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Coluna: escala 1 → escala 2 (ampliação exata, sem perda)
--    O índice único referencias_identidade_ativa_unique usa a coluna e é
--    reconstruído pelo próprio ALTER.
-- ----------------------------------------------------------------------------
alter table public.referencias
  alter column fenil_mg_por_100g type numeric(10,2)
  using fenil_mg_por_100g::numeric(10,2);

-- ----------------------------------------------------------------------------
-- 2. aplicar_sync_referencias — corpo vigente da 20260907000000 (M6)
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
  v_fenil        numeric(10,2);
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
        (v_identidade->>'fenil_mg_por_100g')::numeric(10,2),
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

-- ----------------------------------------------------------------------------
-- 3. decidir_pendencia_referencia — corpo vigente da 20260906000000 (§8)
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
  v_fenil         numeric(10,2);
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
          (v_proposta->>'fenil_mg_por_100g')::numeric(10,2),
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
-- 4. reverter_sync_referencias — corpo vigente da 20260906010000 (§10.1)
-- ----------------------------------------------------------------------------
create or replace function public.reverter_sync_referencias(p_sync_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_status       public.sync_status;
  v_alteracoes   jsonb;
  v_total        integer;
  v_environment  text;
  v_idx          integer;
  v_op           jsonb;
  v_inversa      text;
  v_ref_id       uuid;
  v_aplicadas    integer := 0;
  v_skips        integer := 0;
  v_canceladas   integer := 0;
  v_algum_id     uuid;
  v_motivo       text;
  v_pen          record;
  v_pen_ids      uuid[] := '{}'::uuid[];
begin
  -- Guarda de autorização (§10.1/§12.4): admin E pode_recuperacao
  if not public.pode_operar_recuperacao(auth.uid()) then
    raise exception 'Permissão negada: apenas administradores com permissão de recuperação (usuarios.pode_recuperacao) podem reverter syncs';
  end if;

  -- Alvo: leitura leve do environment (imutável — nenhum fluxo o altera) e da
  -- existência; o estado completo é revalidado sob lock abaixo.
  select s.environment
  into v_environment
  from public.referencia_syncs s
  where s.id = p_sync_id;

  if not found then
    raise exception 'Sync não encontrada: %', p_sync_id;
  end if;

  -- Guarda de serialização (B10c), por environment do alvo (decisão humana
  -- 2026-09-06): rollback × sync ativa no MESMO environment jamais em
  -- paralelo — espelha o single-flight por environment do B10a. Syncs running
  -- em outros environments não bloqueiam (não existe deployment com dois
  -- environments compartilhando o catálogo; no dev são fixtures isoladas). A
  -- própria sync alvo running cai na guarda de status abaixo (running ∉
  -- success/pending_review).
  if exists (
    select 1
    from public.referencia_syncs s
    where s.environment = v_environment
      and s.status = 'running'
      and s.id <> p_sync_id
  ) then
    raise exception 'Existe sync em execução neste environment — aguarde a conclusão antes de reverter';
  end if;

  -- Lock das pendências open do alvo (ordem pendências → syncs: uma decisão
  -- concorrente em pendência do alvo trava aqui e, ao prosseguir, vê o status
  -- final — cancelled/rollback — e recusa; o inverso trava nesta RPC).
  for v_pen in
    select p.id
    from public.referencia_sync_pendencias p
    where p.sync_id = p_sync_id
      and p.status = 'open'
    for update of p
  loop
    v_pen_ids := v_pen_ids || v_pen.id;
  end loop;

  -- Alvo com lock de linha (duas reversões concorrentes da mesma sync: a
  -- segunda espera e vê status ≠ success/pending_review → falha). Estado
  -- revalidado aqui — a leitura leve acima serviu só para o environment.
  select s.status, s.alteracoes
  into v_status, v_alteracoes
  from public.referencia_syncs s
  where s.id = p_sync_id
  for update of s;

  v_total := jsonb_array_length(coalesce(v_alteracoes, '[]'::jsonb));

  -- No-op: sync sem alterações aplicadas — nada a desfazer; pendências open
  -- PERMANECEM decidíveis (a divergência continua válida — nada mudou).
  if v_total = 0 then
    return jsonb_build_object(
      'sync_id', p_sync_id,
      'status', v_status,
      'revertida', false,
      'motivo', 'Sync sem alterações aplicadas — nada a reverter'
    );
  end if;

  if v_status not in ('success', 'pending_review') then
    raise exception 'Sync não pode ser revertida (status = % — apenas success/pending_review)', v_status;
  end if;

  -- GUC D-7/§11.3: os flips de is_ativa abaixo NÃO geram evento is_ativa_manual
  -- duplicado — cada um tem evento `rollback` próprio registrado aqui.
  perform set_config('app.audit_origin', 'curadoria', true);

  -- Inversas em ORDEM REVERSA (B4a): a mais recente primeiro — preserva o
  -- estado produzido por fluxos posteriores quando a op não pode mais ser
  -- desfeita (guarda de estado por op + 23505 → skip com motivo).
  for v_idx in reverse v_total..1 loop
    v_op     := v_alteracoes->(v_idx - 1);
    v_ref_id := (v_op->>'referencia_id')::uuid;

    case v_op->>'op'
      when 'create' then v_inversa := 'arquivar';
      when 'reactivate' then v_inversa := 'arquivar';
      when 'archive' then v_inversa := 'reativar';
      else raise exception 'Operação desconhecida em alteracoes: %', v_op->>'op';
    end case;

    v_motivo := null;

    if v_inversa = 'reativar' then
      -- Reativa somente se AINDA inativa E com a mesma identidade pós-sync
      -- (guarda "preservar alterações posteriores": reativação manual/rollback
      -- anterior/edição → skip registrado)
      begin
        update public.referencias r
        set is_ativa = true, updated_at = now()
        where r.id = v_ref_id
          and not r.is_ativa
          and lower(trim(both from r.nome)) = lower(trim(both from coalesce(v_op->'antes'->>'nome', '')))
          and lower(trim(both from r.marca)) = lower(trim(both from coalesce(v_op->'antes'->>'marca', '')))
          and r.fenil_mg_por_100g = coalesce((v_op->'antes'->>'fenil_mg_por_100g')::numeric(10,2), -1)
        returning r.id into v_algum_id;

        if not found then
          v_skips := v_skips + 1;
          v_motivo := 'alteração posterior preservada — referência já não está inativa com a identidade da sync';
        else
          v_aplicadas := v_aplicadas + 1;
        end if;
      exception
        when unique_violation then
          -- Índice referencias_identidade_ativa_unique: identidade idêntica
          -- foi criada ATIVA depois da sync (sync/curadoria posterior) —
          -- reativar A duplicaria a identidade; a criação posterior vence
          -- (decisão 2026-09-06: skip por operação).
          v_skips := v_skips + 1;
          v_motivo := 'alteração posterior preservada — identidade já ativa (recriada após a sync)';
      end;
    else
      -- Inversa de create/reactivate: arquivar (nunca DELETE — draft §34);
      -- já arquivada por fluxo posterior → skip.
      update public.referencias r
      set is_ativa = false, updated_at = now()
      where r.id = v_ref_id
        and r.is_ativa
      returning r.id into v_algum_id;

      if found then
        v_aplicadas := v_aplicadas + 1;
      else
        v_skips := v_skips + 1;
        v_motivo := 'alteração posterior preservada — referência já inativa';
      end if;
    end if;

    -- Evento `rollback` POR OPERAÇÃO (design §10.1 — actor = admin que
    -- reverteu; detalhes com inversa, resultado e motivo dos skips)
    insert into public.referencia_eventos (sync_id, referencia_id, tipo, actor_id, detalhes)
    values (
      p_sync_id, v_ref_id, 'rollback', auth.uid(),
      jsonb_build_object(
        'operacao', v_op->>'op',
        'inversa', v_inversa,
        'resultado', case when v_motivo is null then 'aplicada' else 'skip' end,
        'motivo', v_motivo
      )
    );
  end loop;

  -- Pendências open do alvo → cancelled (draft §32): permanecem no histórico,
  -- rastreáveis à sync original, sem nova decisão possível.
  if v_pen_ids is not null and cardinality(v_pen_ids) > 0 then
    update public.referencia_sync_pendencias p
    set status = 'cancelled'
    where p.id = any(v_pen_ids);

    for v_pen in
      select p.id, p.referencia_id
      from public.referencia_sync_pendencias p
      where p.id = any(v_pen_ids)
    loop
      v_canceladas := v_canceladas + 1;
      insert into public.referencia_eventos (sync_id, pendencia_id, referencia_id, tipo, actor_id, detalhes)
      values (
        p_sync_id, v_pen.id, v_pen.referencia_id, 'pendencia_cancelada', auth.uid(),
        jsonb_build_object('motivo', 'rollback da sync')
      );
    end loop;
  end if;

  -- Status → reverted + message com resumo; contadores/alteracoes permanecem
  -- como histórico da execução original (a trilha vive nos eventos).
  update public.referencia_syncs s
  set status = 'reverted',
      message = format(
        'Rollback executado: %s operação(ões) revertida(s), %s preservada(s) (alteração posterior), %s pendência(s) cancelada(s)',
        v_aplicadas, v_skips, v_canceladas
      )
  where s.id = p_sync_id;

  return jsonb_build_object(
    'sync_id', p_sync_id,
    'status', 'reverted',
    'revertidas', v_aplicadas,
    'preservadas', v_skips,
    'pendencias_canceladas', v_canceladas
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. restaurar_referencias_de_backup — corpo vigente da 20260906010000 (§10.2)
-- ----------------------------------------------------------------------------
create or replace function public.restaurar_referencias_de_backup(p_backup_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_backup        record;
  v_linha         record;
  v_nome          text;
  v_marca         text;
  v_fenil         numeric(10,2);
  v_ref_id        uuid;
  v_algum_id      uuid;
  v_sistema_id    uuid;
  v_environment   text;
  v_reativadas    integer := 0;
  v_criadas       integer := 0;
  v_arquivadas    integer := 0;
  v_canceladas    integer := 0;
  v_reativadas_id uuid[] := '{}'::uuid[];
  v_criadas_id    uuid[] := '{}'::uuid[];
  v_arquivadas_id uuid[] := '{}'::uuid[];
  v_pen           record;
  v_pen_ids       uuid[] := '{}'::uuid[];
begin
  -- Guarda de autorização (§10.2/§12.4): admin E pode_recuperacao
  if not public.pode_operar_recuperacao(auth.uid()) then
    raise exception 'Permissão negada: apenas administradores com permissão de recuperação (usuarios.pode_recuperacao) podem restaurar backups';
  end if;

  -- Alvo: leitura leve do environment do sync que gerou o backup (imutável;
  -- sync nunca é deletada no domínio) e da existência.
  select s.environment
  into v_environment
  from public.referencia_backups b
  join public.referencia_syncs s on s.id = b.sync_id
  where b.id = p_backup_id;

  if not found then
    raise exception 'Backup não encontrado: %', p_backup_id;
  end if;

  -- Guarda de serialização (B10c), por environment (decisão humana
  -- 2026-09-06): restauração × sync ativa no MESMO environment jamais em
  -- paralelo — espelha o single-flight por environment do B10a. O backup do
  -- próprio sync em execução também bloqueia (o estado que ele guarda ainda
  -- está em fluxo — restauração é daqui para frente, não reverter sync).
  if exists (
    select 1
    from public.referencia_syncs s
    where s.environment = v_environment
      and s.status = 'running'
  ) then
    raise exception 'Existe sync em execução neste environment — aguarde a conclusão antes de restaurar';
  end if;

  -- Lock de TODAS as pendências open (decisão 2026-09-06: todas são
  -- afetadas pela reescrita do catálogo) — serializa com decisões
  -- concorrentes (decidir trava na pendência e depois vê cancelled).
  for v_pen in
    select p.id
    from public.referencia_sync_pendencias p
    where p.status = 'open'
    for update of p
  loop
    v_pen_ids := v_pen_ids || v_pen.id;
  end loop;

  -- Backup alvo com lock (segunda restauração do mesmo backup: estado já
  -- reflete → no-op natural por contagens zero)
  select b.payload, b.payload_sha256, b.sync_id
  into v_backup
  from public.referencia_backups b
  where b.id = p_backup_id
  for update of b;

  if not found then
    raise exception 'Backup não encontrado: %', p_backup_id;
  end if;

  -- 1. Integridade (design §9): payload guarda o texto exato hasheado no
  --    produtor (jsonb string scalar — M2); verificação ANTES de qualquer
  --    efeito; payload fora do formato → recusa fail-high (corrupção/
  --    adulteração/linha de teste fora do formato). digest é chamado
  --    QUALIFICADO (extensions.digest): pgcrypto vive no schema `extensions`
  --    no Supabase hospedado, e o search_path forçado a public por esta
  --    função SECURITY DEFINER (ADR-0010) não o resolve — descoberto pelos
  --    testes REAL do M5 ("function digest(text, unknown) does not exist").
  if jsonb_typeof(v_backup.payload) <> 'string'
     or encode(extensions.digest(v_backup.payload #>> '{}', 'sha256'), 'hex') <> v_backup.payload_sha256 then
    raise exception 'Integridade do backup não verificada (payload_sha256 divergente do conteúdo)';
  end if;

  -- GUC D-7/§11.3: flips de is_ativa da restauração têm evento `restore`
  -- próprio — sem is_ativa_manual duplicado.
  perform set_config('app.audit_origin', 'curadoria', true);

  -- Conjunto das chaves ativas no backup (apenas globais): tabela temporária
  -- para os anti-joins do passo de arquivamento (pg_temp é resolvido antes do
  -- search_path nesta função — criada antes de qualquer uso).
  create temp table _restore_backup_ativos (
    id uuid not null,
    nome text not null,
    marca text not null default '',
    fenil_mg_por_100g numeric(10,2) not null
  ) on commit drop;

  insert into _restore_backup_ativos (id, nome, marca, fenil_mg_por_100g)
  select
    (l->>'id')::uuid,
    l->>'nome',
    coalesce(l->>'marca', ''),
    (l->>'fenil_mg_por_100g')::numeric(10,2)
  from jsonb_array_elements((v_backup.payload #>> '{}')::jsonb) as l
  where (l->>'is_global')::boolean = true
    and (l->>'is_ativa')::boolean = true;

  create index _restore_backup_ativos_identidade_idx
    on _restore_backup_ativos (lower(trim(both from nome)), lower(trim(both from marca)), fenil_mg_por_100g);

  -- 2. Ativos do backup sem ativa de mesma chave hoje → reativa a arquivada
  --    de mesmo id (guarda de identidade) ou cria do backup (id original,
  --    actor Sistema — B5). Falha de consistência → aborta (excepcional).
  for v_linha in
    select b.id, b.nome, b.marca, b.fenil_mg_por_100g
    from _restore_backup_ativos b
  loop
    v_ref_id := v_linha.id;
    v_nome   := v_linha.nome;
    v_marca  := v_linha.marca;
    v_fenil  := v_linha.fenil_mg_por_100g;

    -- Já existe global ativa com a mesma chave hoje? (probe no índice único
    -- de identidade ativa de referencias)
    if exists (
      select 1
      from public.referencias r
      where r.is_global
        and r.is_ativa
        and lower(trim(both from r.nome)) = lower(trim(both from v_nome))
        and lower(trim(both from r.marca)) = lower(trim(both from v_marca))
        and r.fenil_mg_por_100g = v_fenil
    ) then
      continue;
    end if;

    -- Reativa a arquivada de MESMO id se ainda inativa e com a identidade do
    -- backup (linha editada depois → ramo elsif: conflito real, aborta).
    update public.referencias r
    set is_ativa = true, updated_at = now()
    where r.id = v_ref_id
      and not r.is_ativa
      and lower(trim(both from r.nome)) = lower(trim(both from v_nome))
      and lower(trim(both from r.marca)) = lower(trim(both from v_marca))
      and r.fenil_mg_por_100g = v_fenil
    returning r.id into v_algum_id;

    if found then
      v_reativadas := v_reativadas + 1;
      v_reativadas_id := v_reativadas_id || v_ref_id;
    elsif exists (select 1 from public.referencias where id = v_ref_id) then
      -- Linha de MESMO id existe com identidade divergente do backup (editada
      -- depois do backup) — reativar exigiria sobrescrever a edição e recriar
      -- violaria a PK: conflito real → aborta a restauração inteira (operação
      -- excepcional: o humano corrige e repete; nunca estado parcial).
      raise exception 'Conflito na restauração: referência % existe com identidade divergente da do backup — intervenção manual necessária', v_ref_id;
    else
      -- Linha ausente (remoção técnica/cascade) → recria do backup com o id
      -- original e actor Sistema (B5); PK livre garantida pelo ramo acima.
      if v_sistema_id is null then
        select u.id into v_sistema_id
        from public.usuarios u
        where u.email = 'sistema@meufenil.local'
        order by u.created_at
        limit 1;

        if not found then
          raise exception 'Ator Sistema não provisionado (sistema@meufenil.local) — execute scripts/provisionar-ator-sistema.js';
        end if;
      end if;

      insert into public.referencias (id, nome, marca, fenil_mg_por_100g, is_global, is_ativa, criado_por)
      values (v_ref_id, v_nome, v_marca, v_fenil, true, true, v_sistema_id);

      v_criadas := v_criadas + 1;
      v_criadas_id := v_criadas_id || v_ref_id;
    end if;
  end loop;

  -- 3. Globais ativas HOJE sem chave ativa no backup → arquivadas (nunca
  --    DELETE; pessoais nunca tocadas). Snapshot dos ids primeiro (o UPDATE
  --    posterior não altera o cursor).
  for v_linha in
    select r.id
    from public.referencias r
    where r.is_global
      and r.is_ativa
      and not exists (
        select 1
        from _restore_backup_ativos k
        where lower(trim(both from r.nome)) = lower(trim(both from k.nome))
          and lower(trim(both from r.marca)) = lower(trim(both from k.marca))
          and r.fenil_mg_por_100g = k.fenil_mg_por_100g
      )
  loop
    update public.referencias r
    set is_ativa = false, updated_at = now()
    where r.id = v_linha.id
      and r.is_ativa
    returning r.id into v_algum_id;

    if found then
      v_arquivadas := v_arquivadas + 1;
      v_arquivadas_id := v_arquivadas_id || v_linha.id;
    end if;
  end loop;

  -- 4. Pendências open (TODAS) → cancelled (draft §32; decisão 2026-09-06).
  if v_pen_ids is not null and cardinality(v_pen_ids) > 0 then
    update public.referencia_sync_pendencias p
    set status = 'cancelled'
    where p.id = any(v_pen_ids);

    for v_pen in
      select p.id, p.sync_id, p.referencia_id
      from public.referencia_sync_pendencias p
      where p.id = any(v_pen_ids)
    loop
      v_canceladas := v_canceladas + 1;
      insert into public.referencia_eventos (sync_id, pendencia_id, referencia_id, tipo, actor_id, detalhes)
      values (
        v_pen.sync_id, v_pen.id, v_pen.referencia_id, 'pendencia_cancelada', auth.uid(),
        jsonb_build_object('motivo', 'restauração de backup', 'backup_id', p_backup_id)
      );
    end loop;
  end if;

  -- 5. Evento único `restore` (D-5/§10.2): detalhes com contagens + ids das
  --    linhas tocadas — rastreabilidade completa sem linha de sync nova.
  insert into public.referencia_eventos (sync_id, referencia_id, tipo, actor_id, detalhes)
  values (
    null, null, 'restore', auth.uid(),
    jsonb_build_object(
      'backup_id', p_backup_id,
      'reativadas', v_reativadas,
      'criadas', v_criadas,
      'arquivadas', v_arquivadas,
      'pendencias_canceladas', v_canceladas,
      'reativadas_ids', v_reativadas_id,
      'criadas_ids', v_criadas_id,
      'arquivadas_ids', v_arquivadas_id
    )
  );

  return jsonb_build_object(
    'backup_id', p_backup_id,
    'reativadas', v_reativadas,
    'criadas', v_criadas,
    'arquivadas', v_arquivadas,
    'pendencias_canceladas', v_canceladas
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. REVOKE/GRANT reafirmados (idempotentes — as ACLs já vêm do CREATE OR
--    REPLACE in loco; explicitados para manter a intenção visível no arquivo)
-- ----------------------------------------------------------------------------
revoke all on function public.aplicar_sync_referencias(uuid, jsonb) from public;
grant execute on function public.aplicar_sync_referencias(uuid, jsonb) to service_role;

revoke all on function public.decidir_pendencia_referencia(uuid, boolean, text) from public;
grant execute on function public.decidir_pendencia_referencia(uuid, boolean, text) to authenticated;

revoke all on function public.reverter_sync_referencias(uuid) from public;
grant execute on function public.reverter_sync_referencias(uuid) to authenticated;

revoke all on function public.restaurar_referencias_de_backup(uuid) from public;
grant execute on function public.restaurar_referencias_de_backup(uuid) to authenticated;
