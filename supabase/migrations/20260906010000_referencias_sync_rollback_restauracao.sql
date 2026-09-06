-- ============================================================================
-- Migration: FEAT-0017 M5 — rollback seletivo de sync e restauração excepcional
-- Referência: FEAT-0017 (.ai/specs/proposed/features/FEAT-0017-sincronizacao-referencias-anvisa.md)
-- Design:     .ai/.temp/feat0017-fase1-design-2026-09-04.md — §5.5 (coluna
--             usuarios.pode_recuperacao), §10.1 (RPC reverter, inversas em
--             ordem reversa com guarda de estado), §10.2 (RPC restaurar,
--             volta a refletir o backup), §11.3 (GUC app.audit_origin),
--             §12.4 (helper pode_operar_recuperacao), §16 (M5)
-- Aprovado por: Lucas Martins Menezes em 2026-09-04 (B1–B10 R1–R3; rodada R4);
--             plano de marcos M1–M7 aprovado em 2026-09-06 (M5 em andamento
--             na mesma data, retomado por handoff). Decisões pontuais de
--             2026-09-06 na conversa: (1) reativação com colisão 23505 no
--             índice de identidade ativa → skip por operação ("alteração
--             posterior preservada"), nunca aborta o rollback inteiro;
--             (2) restauração cancela TODAS as pendências open (qualquer
--             sync), não apenas as da sync do backup; (3) guarda B10c "nenhuma
--             sync running" restrita ao environment do alvo (espelha o
--             single-flight por environment do B10a — em produção, onde só
--             existe o environment 'prod', é idêntica à global).
-- Escopo M5:  RPCs SECURITY DEFINER padrão ADR-0010:
--             - reverter_sync_referencias (admin + pode_recuperacao) —
--               desfaz somente as alterações da sync escolhida (B4a): para
--               cada op de `alteracoes` (create/archive, shape do M4) em
--               ordem reversa, aplica a inversa com guarda de estado
--               ("preservar alterações posteriores" — draft §29). Reativação
--               de arquivada é a exceção auditada à regra "arquivada não
--               reativa": eventos tipo `rollback` (nunca `ativar`), GUC
--               suprime is_ativa_manual. Pendências open da sync → cancelled
--               (evento pendencia_cancelada); decididas permanecem
--               (histórico — draft §32). Status da sync → `reverted` com
--               message-resumo. Sync sem alterações → no-op (nada aplicado).
--             - restaurar_referencias_de_backup (admin + pode_recuperacao) —
--               recuperação excepcional (draft §30): o conjunto global
--               sincronizado volta a refletir o backup (payload completo de
--               referencias, sha256 verificado antes — design §9); nunca
--               toca pessoais (is_global = false), nunca DELETE; pendências
--               open (todas) → cancelled; syncs anteriores/posteriores
--               permanecem intactas como eventos históricos (D-5: não cria
--               linha de sync; evento único `restore` com contagens + ids).
--             Nunca: DELETE, reativa/bloqueia fora de sync success/
--             pending_review (reverter), escrita fora da guarda de
--             integridade (restaurar), decisão em pendência cancelada.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. public.usuarios.pode_recuperacao (§5.5/§12.4) + helper
--    Permissão específica para rollback/recuperação (draft §31): NÃO é
--    operação administrativa comum. Coluna nova default false, concedida
--    manualmente pelo dono do projeto (nenhum fluxo de app auto-concede).
--    Helper no formato de is_admin_user (20260810000000): admin E flag.
-- ----------------------------------------------------------------------------
alter table public.usuarios
  add column if not exists pode_recuperacao boolean not null default false;

create or replace function public.pode_operar_recuperacao(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to public
as $$
  select exists (
    select 1
    from public.usuarios u
    where u.id = p_user_id
      and u.role = 'admin'
      and u.pode_recuperacao
  );
$$;

revoke all on function public.pode_operar_recuperacao(uuid) from public;
grant execute on function public.pode_operar_recuperacao(uuid) to authenticated;
grant execute on function public.pode_operar_recuperacao(uuid) to service_role;

-- ----------------------------------------------------------------------------
-- 2. public.reverter_sync_referencias(uuid) (§10.1) — admin + pode_recuperacao
--    SECURITY DEFINER + search_path; guarda pode_operar_recuperacao(auth.uid()).
--    Serialização (B10c, por environment — decisão humana 2026-09-06):
--    nenhuma sync running no environment do alvo (espelha o single-flight por
--    environment do B10a); locks das pendências open do alvo ANTES do lock da
--    sync (ordem pendências → syncs espelha decidir_pendencia_referencia e
--    evita deadlock com decisão concorrente).
--    Reversão (B4a, decisão R3): ops de `alteracoes` em ORDEM REVERSA com
--    guarda de estado por op ("preservar alterações posteriores" — §29):
--      inversa de archive (A): reativar A somente se ainda inativa E com a
--        mesma identidade pós-sync; já alterada por fluxo posterior → skip
--        (evento com motivo); colisão 23505 no índice de identidade ativa
--        (identidade recriada ativa depois) → skip por op (decisão
--        2026-09-06) — nunca DELETE físico (draft §34).
--      inversa de create (C): arquivar C; já arquivada → skip.
--      inversa de reactivate (rollback de rollback — raro, defensivo):
--        arquivar.
--    Pendências open do alvo → cancelled (draft §32); decididas permanecem.
--    Evento `rollback` POR OPERAÇÃO (detalhes: operacao/inversa/resultado/
--    motivo); evento `pendencia_cancelada` por pendência. GUC
--    app.audit_origin = 'curadoria' (local à transação, D-7/§11.3) suprime o
--    trigger is_ativa_manual nos flips — as reativações do rollback são a
--    exceção auditada registrada com tipo `rollback`, nunca `ativar`.
--    Status → `reverted` + message com resumo; contadores permanecem
--    (histórico da execução original). Sync sem alterações (no-op) → retorno
--    informativo sem mudança de status (design §10.1 "nada foi aplicado").
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
          and r.fenil_mg_por_100g = coalesce((v_op->'antes'->>'fenil_mg_por_100g')::numeric(10,1), -1)
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
-- 3. public.restaurar_referencias_de_backup(uuid) (§10.2) — admin + pode_recuperacao
--    SECURITY DEFINER + search_path; guarda idêntica ao rollback (nenhuma sync
--    running). Recuperação EXCEPCIONAL (draft §30): o conjunto global
--    sincronizado volta a refletir o backup escolhido.
--    Semântica por chave de identidade (nome+marca+fenil normalizada como o
--    índice referencias_identidade_ativa_unique):
--      1. cada global ATIVA no backup sem global ativa de mesma chave hoje →
--         reativa a arquivada de mesmo id (guarda de identidade) ou cria do
--         backup (id original preservado; actor Sistema — B5, criado_por
--         NOT NULL sob definer com sessão admin);
--      2. globais ativas hoje sem chave ativa no backup → arquivadas (nunca
--         excluir — draft §34); linhas PESSOAIS nunca são tocadas (D-4);
--      3. pendências open (TODAS — decisão 2026-09-06: restauração é
--         autoritária sobre o catálogo global; nenhuma decisão aberta
--         permanece sobre estado reescrito) → cancelled com evento;
--      4. integridade verificada ANTES (design §9): payload é string scalar
--         jsonb com o texto exato hasheado no produtor (M2 — confirmado no
--         dev: payload #>> '{}' reproduz o texto) → digest comparável;
--      5. syncs anteriores/posteriores permanecem INTACTAS como eventos
--         históricos; NÃO cria linha de sync (D-5); evento único `restore`
--         com contagens e ids das linhas tocadas (rastreabilidade).
--    Restauração é excepcional: conflito 23505/integridade ABORTA a
--    transação inteira (diferente do rollback, que preserva por op) — o
--    humano decide e repete; nunca estado parcial.
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
  v_fenil         numeric(10,1);
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
    fenil_mg_por_100g numeric(10,1) not null
  ) on commit drop;

  insert into _restore_backup_ativos (id, nome, marca, fenil_mg_por_100g)
  select
    (l->>'id')::uuid,
    l->>'nome',
    coalesce(l->>'marca', ''),
    (l->>'fenil_mg_por_100g')::numeric(10,1)
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
-- 4. REVOKE/GRANT de EXECUTE (§10.1/§10.2)
--    Reverter/restaurar são ações HUMANAS de admin com permissão específica
--    (sessão authenticated; guarda pode_operar_recuperacao decide) — service_
--    role fora (espelha decidir_pendencia_referencia: nada de chamada
--    automatizada de recuperação).
-- ----------------------------------------------------------------------------
revoke all on function public.reverter_sync_referencias(uuid) from public;
grant execute on function public.reverter_sync_referencias(uuid) to authenticated;

revoke all on function public.restaurar_referencias_de_backup(uuid) from public;
grant execute on function public.restaurar_referencias_de_backup(uuid) to authenticated;
