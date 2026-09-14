-- Migration 20260914000000 — reverter_sync_referencias: sync sem alterações
-- COM pendências open passa a cancelar as pendências e marcar a sync como
-- reverted (revisão 2026-09-14, decisão do usuário).
--
-- Contexto: o guard no-op original ("Sync sem alterações aplicadas — nada a
-- reverter") ignorava o caso bootstrap — syncs de bootstrap POR DEFINIÇÃO não
-- aplicam operações (zero alteracoes), então jamais poderiam ser revertidas
-- e suas pendências (ex.: retrato truncado por teto de paginação do
-- PostgREST, corrigido em 2026-09-14) não podiam ser descartadas em lote.
-- Além disso, a sync bugada seguia contando como confiável (pending_review)
-- na derivação de modo, fazendo a sync seguinte rodar em pós-bootstrap com
-- auto-aplicação.
--
-- Comportamento revisado:
--   - sem alterações E sem pendências open → no-op informativo (inalterado);
--   - sem alterações COM pendências open → cancela as pendências (evento
--     `pendencia_cancelada` por pendência, motivo 'rollback da sync') e marca
--     a sync 'reverted' com "0 operação(ões) revertida(s), 0 preservada(s),
--     N pendência(s) cancelada(s)".
--
-- Demais seções da função inalteradas (guarda de autorização, serialização
-- B10c, locks, inversas, GUC, contadores).

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

  -- No-op (revisado 2026-09-14): sync sem alterações aplicadas E sem
  -- pendências open — nada a desfazer nem a cancelar (retorno informativo,
  -- design §10.1). Com pendências open, o fluxo segue: as pendências são
  -- canceladas e a sync marcada como reverted (bootstrap por definição não
  -- aplica operações — sem esta revisão suas pendências jamais poderiam ser
  -- descartadas em lote, e a sync seguiria contando como confiável para a
  -- derivação de modo).
  if v_total = 0 and cardinality(v_pen_ids) = 0 then
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
  -- rastreáveis à sync original, sem nova decisão possível. Inclui o caso sem
  -- alterações (revisão 2026-09-14).
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
