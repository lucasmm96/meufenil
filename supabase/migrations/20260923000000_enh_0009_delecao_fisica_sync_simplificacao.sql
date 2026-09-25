-- ==========================================================================
-- ENH-0009 — Deleção física integrada ao sync + simplificação do FEAT-0017
-- Spec: .ai/specs/proposed/enhancements/ENH-0009-delecao-fisica-integrada-sync-simplificacao.md
-- Aprovado: Lucas Martins Menezes, 2026-09-23
-- ==========================================================================
--
-- Ordem de operações:
--   1. Pré-deploy: migrar syncs pending_review → success, zerar alteracoes
--   2. DROP das funções de curadoria/rollback (antes da tabela, evita FK checks)
--   3. DROP TABLE referencia_sync_pendencias CASCADE (inclui FKs dependentes)
--   4. DROP dos enums órfãos (sync_pendencia_tipo, sync_pendencia_status)
--   5. ALTER TABLE referencia_eventos: DROP FK de referencia_id
--   6. ALTER TABLE referencia_syncs: DROP bootstrap/divergencias, ADD deletadas
--   7. ALTER TYPE sync_evento_tipo: ADD VALUE 'referencia_deletada'
--   8. CREATE OR REPLACE aplicar_sync_referencias (nova lógica com deleção)
--   9. REVOKE/GRANT (mesmos que antes: service_role only)
-- ==========================================================================

-- ----------------------------------------------------------------------------
-- 1. Pré-deploy: normalizar estado histórico
-- ----------------------------------------------------------------------------

-- Syncs pending_review existentes viram success (curadoria encerrada).
UPDATE public.referencia_syncs
SET    status = 'success'
WHERE  status = 'pending_review';

-- Limpar campo alteracoes (não será mais usado para rollback).
UPDATE public.referencia_syncs
SET    alteracoes = '[]'::jsonb
WHERE  alteracoes IS DISTINCT FROM '[]'::jsonb
  AND  alteracoes IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. DROP funções de curadoria/rollback
-- ----------------------------------------------------------------------------

-- decidir_pendencia_referencia: aprovação/rejeição de curadoria (FEAT-0017 M5)
DROP FUNCTION IF EXISTS public.decidir_pendencia_referencia(uuid, boolean, text);

-- reverter_sync_referencias: rollback seletivo por sync_id (FEAT-0017 M5)
DROP FUNCTION IF EXISTS public.reverter_sync_referencias(uuid);

-- ----------------------------------------------------------------------------
-- 3. DROP tabela de pendências de curadoria (CASCADE remove FKs dependentes)
--    Isso inclui referencia_eventos.pendencia_id FK automaticamente.
-- ----------------------------------------------------------------------------

DROP TABLE IF EXISTS public.referencia_sync_pendencias CASCADE;

-- ----------------------------------------------------------------------------
-- 4. DROP enums órfãos (nenhuma coluna os usa após o DROP TABLE)
-- ----------------------------------------------------------------------------

DROP TYPE IF EXISTS public.sync_pendencia_tipo;
DROP TYPE IF EXISTS public.sync_pendencia_status;

-- ----------------------------------------------------------------------------
-- 5. ALTER TABLE referencia_eventos: remover FK de referencia_id
--    A coluna permanece (uuid nullable) para preservar rastreabilidade no
--    audit trail mesmo após deleção física da referência.
-- ----------------------------------------------------------------------------

ALTER TABLE public.referencia_eventos
  DROP CONSTRAINT IF EXISTS referencia_eventos_referencia_id_fkey;

-- ----------------------------------------------------------------------------
-- 6. ALTER TABLE referencia_syncs: ajustar colunas
-- ----------------------------------------------------------------------------

ALTER TABLE public.referencia_syncs
  DROP COLUMN IF EXISTS bootstrap,
  DROP COLUMN IF EXISTS divergencias,
  ADD  COLUMN IF NOT EXISTS deletadas integer;

-- ----------------------------------------------------------------------------
-- 7. ALTER TYPE sync_evento_tipo: novo valor para deleção física
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE  enumtypid = 'public.sync_evento_tipo'::regtype
      AND  enumlabel = 'referencia_deletada'
  ) THEN
    ALTER TYPE public.sync_evento_tipo ADD VALUE 'referencia_deletada';
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. Nova função aplicar_sync_referencias
--
-- Mudanças vs. FEAT-0017:
--   • motivo ('ausencia'|'substituicao') guia a estratégia de arquivamento
--   • ausencia: tenta DELETE físico; degrada para soft-archive se FK viola
--   • substituicao: sempre soft-archive (is_global vira false would be wrong —
--     o alvo permanece global mas is_ativa=false; o novo item é criado)
--   • sweep retroativo: LIMIT 100 globais is_ativa=false sem vínculos
--   • retorna deletadas (contador de deleções físicas; arquivadas = só soft)
--   • sem pendencias, sem alteracoes (curadoria/rollback removidos)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.aplicar_sync_referencias(
  p_sync_id uuid,
  p_plano   jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Ator Sistema (para eventos, substituído por service_role token nos inserts)
  v_sistema_id uuid;

  -- Contadores de resultado
  v_equivalentes integer := 0;
  v_criadas      integer := 0;
  v_arquivadas   integer := 0;
  v_deletadas    integer := 0;

  -- Loops de criacao
  v_criacao      jsonb;
  v_nova_id      uuid;
  v_nome         text;
  v_marca        text;
  v_fenil        numeric(10,2);

  -- Loops de arquivamento / sweep
  v_op           jsonb;
  v_ref_id       uuid;
  v_motivo       text;
  v_identidade   jsonb;
  v_nome_ev      text;
  v_marca_ev     text;
  v_fenil_ev     numeric(10,2);

  -- Sweep
  v_sweep_id     uuid;

  -- Relacionamentos (guard antes de deletar)
  v_tem_registros  boolean;
  v_tem_favoritas  boolean;
BEGIN
  -- ------------------------------------------------------------------
  -- 0. Validação: versão do plano + sync ativa
  -- ------------------------------------------------------------------
  IF p_plano IS NULL OR (p_plano->>'versao') IS NULL THEN
    RAISE EXCEPTION 'Plano de sync ausente ou sem versão';
  END IF;

  IF (p_plano->>'versao')::integer <> 1 THEN
    RAISE EXCEPTION 'Versão de plano não suportada: %', (p_plano->>'versao');
  END IF;

  PERFORM FROM public.referencia_syncs WHERE id = p_sync_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sync não encontrada: %', p_sync_id;
  END IF;

  PERFORM FROM public.referencia_syncs WHERE id = p_sync_id AND status = 'running';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sync não está em execução: %', p_sync_id;
  END IF;

  -- ------------------------------------------------------------------
  -- Resolve ator Sistema (email fixo, provisioned via seed/script)
  -- Obrigatório somente se há criações (criado_por NOT NULL).
  -- ------------------------------------------------------------------
  SELECT id INTO v_sistema_id
  FROM   public.usuarios
  WHERE  email = 'sistema@meufenil.local'
  ORDER  BY created_at
  LIMIT  1;

  IF NOT FOUND
     AND jsonb_typeof(p_plano->'criacoes') = 'array'
     AND jsonb_array_length(p_plano->'criacoes') > 0
  THEN
    RAISE EXCEPTION
      'Ator Sistema não provisionado (sistema@meufenil.local) — execute scripts/provisionar-ator-sistema.js';
  END IF;

  -- ------------------------------------------------------------------
  -- A. Equivalentes: contados pelo resumo do plano
  -- ------------------------------------------------------------------
  v_equivalentes := COALESCE((p_plano->'resumo'->>'equivalentes')::integer, 0);

  -- ------------------------------------------------------------------
  -- B. Criações
  -- ------------------------------------------------------------------
  FOR v_criacao IN
    SELECT * FROM jsonb_array_elements(COALESCE(p_plano->'criacoes', '[]'::jsonb))
  LOOP
    IF (v_criacao->>'op') <> 'create' THEN
      RAISE EXCEPTION 'Operação desconhecida no plano: %', (v_criacao->>'op');
    END IF;

    v_nome  := v_criacao->'identidade'->>'nome';
    v_marca := COALESCE(v_criacao->'identidade'->>'marca', '');
    v_fenil := (v_criacao->'identidade'->>'fenil_mg_por_100g')::numeric(10,2);

    INSERT INTO public.referencias (
      nome,
      marca,
      fenil_mg_por_100g,
      is_global,
      is_ativa,
      criado_por,
      created_at,
      updated_at
    ) VALUES (
      v_nome,
      v_marca,
      v_fenil,
      true,
      true,
      v_sistema_id,
      now(),
      now()
    )
    RETURNING id INTO v_nova_id;

    INSERT INTO public.referencia_eventos (
      referencia_id,
      tipo,
      sync_id,
      actor_id,
      identidade_snapshot,
      created_at
    ) VALUES (
      v_nova_id,
      'referencia_criada',
      p_sync_id,
      v_sistema_id,
      jsonb_build_object('nome', v_nome, 'marca', v_marca, 'fenil_mg_por_100g', v_fenil),
      now()
    );

    v_criadas := v_criadas + 1;
  END LOOP;

  -- ------------------------------------------------------------------
  -- C. Arquivamentos (soft e/ou deleção física conforme motivo)
  -- ------------------------------------------------------------------
  FOR v_op IN
    SELECT * FROM jsonb_array_elements(COALESCE(p_plano->'arquivamentos', '[]'::jsonb))
  LOOP
    IF (v_op->>'op') <> 'archive' THEN
      RAISE EXCEPTION 'Operação desconhecida no plano: %', (v_op->>'op');
    END IF;

    v_ref_id  := (v_op->>'referencia_id')::uuid;
    v_motivo  := COALESCE(v_op->>'motivo', 'ausencia');

    -- Captura identidade e marca is_ativa=false (soft-archive sempre primeiro)
    UPDATE public.referencias
    SET    is_ativa   = false,
           updated_at = now()
    WHERE  id       = v_ref_id
      AND  is_global = true
      AND  is_ativa  = true
    RETURNING
      jsonb_build_object(
        'nome',              nome,
        'marca',             marca,
        'fenil_mg_por_100g', fenil_mg_por_100g
      ),
      nome, marca, fenil_mg_por_100g
    INTO v_identidade, v_nome_ev, v_marca_ev, v_fenil_ev;

    -- Linha não encontrada: já arquivada ou não é global (estado divergente)
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Referência % não encontrada ou já inativa', v_ref_id;
    END IF;

    IF v_motivo = 'substituicao' THEN
      -- Substituição: sempre soft-archive, sem tentativa de deleção
      INSERT INTO public.referencia_eventos (
        referencia_id,
        tipo,
        sync_id,
        actor_id,
        identidade_snapshot,
        created_at
      ) VALUES (
        v_ref_id,
        'referencia_arquivada',
        p_sync_id,
        v_sistema_id,
        v_identidade,
        now()
      );
      v_arquivadas := v_arquivadas + 1;

    ELSE
      -- Ausência: tentar deleção física se não houver vínculos
      SELECT EXISTS(
        SELECT 1 FROM public.registros_refeicao rr
        WHERE  rr.referencia_id = v_ref_id
        LIMIT  1
      ) INTO v_tem_registros;

      SELECT EXISTS(
        SELECT 1 FROM public.referencias_favoritas rf
        WHERE  rf.referencia_id = v_ref_id
        LIMIT  1
      ) INTO v_tem_favoritas;

      IF v_tem_registros OR v_tem_favoritas THEN
        -- Tem vínculos: permanece soft-archived, não deleta
        INSERT INTO public.referencia_eventos (
          referencia_id,
          tipo,
          sync_id,
          actor_id,
          identidade_snapshot,
          created_at
        ) VALUES (
          v_ref_id,
          'referencia_arquivada',
          p_sync_id,
          v_sistema_id,
          v_identidade,
          now()
        );
        v_arquivadas := v_arquivadas + 1;
      ELSE
        -- Sem vínculos diretos: tenta DELETE; degrada graciosamente em FK violation
        BEGIN
          DELETE FROM public.referencias WHERE id = v_ref_id;

          -- DELETE bem-sucedido: evento com UUID preservado (FK removida)
          INSERT INTO public.referencia_eventos (
            referencia_id,
            tipo,
            sync_id,
            actor_id,
            identidade_snapshot,
            created_at
          ) VALUES (
            v_ref_id,
            'referencia_deletada',
            p_sync_id,
            v_sistema_id,
            v_identidade,
            now()
          );
          v_deletadas := v_deletadas + 1;

        EXCEPTION
          WHEN foreign_key_violation THEN
            -- Race condition: outro vínculo surgiu entre o check e o DELETE
            -- Degrada para soft-archive (row já está is_ativa=false do UPDATE acima)
            INSERT INTO public.referencia_eventos (
              referencia_id,
              tipo,
              sync_id,
              actor_id,
              identidade_snapshot,
              created_at
            ) VALUES (
              v_ref_id,
              'referencia_arquivada',
              p_sync_id,
              v_sistema_id,
              v_identidade,
              now()
            );
            v_arquivadas := v_arquivadas + 1;
        END;
      END IF;
    END IF;
  END LOOP;

  -- ------------------------------------------------------------------
  -- D. Sweep retroativo: apaga globais is_ativa=false sem vínculos
  --    LIMIT 100 por execução (D-9: batch incremental).
  -- ------------------------------------------------------------------
  FOR v_sweep_id IN
    SELECT r.id
    FROM   public.referencias r
    WHERE  r.is_global = true
      AND  r.is_ativa  = false
      AND  NOT EXISTS (
             SELECT 1 FROM public.registros_refeicao rr
             WHERE  rr.referencia_id = r.id
             LIMIT  1
           )
      AND  NOT EXISTS (
             SELECT 1 FROM public.referencias_favoritas rf
             WHERE  rf.referencia_id = r.id
             LIMIT  1
           )
    LIMIT 100
  LOOP
    -- Captura identidade antes de deletar
    SELECT jsonb_build_object(
             'nome',              nome,
             'marca',             marca,
             'fenil_mg_por_100g', fenil_mg_por_100g
           ),
           nome, marca, fenil_mg_por_100g
    INTO   v_identidade, v_nome_ev, v_marca_ev, v_fenil_ev
    FROM   public.referencias
    WHERE  id = v_sweep_id;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    BEGIN
      DELETE FROM public.referencias WHERE id = v_sweep_id;

      INSERT INTO public.referencia_eventos (
        referencia_id,
        tipo,
        sync_id,
        actor_id,
        identidade_snapshot,
        created_at
      ) VALUES (
        v_sweep_id,
        'referencia_deletada',
        p_sync_id,
        v_sistema_id,
        v_identidade,
        now()
      );
      v_deletadas := v_deletadas + 1;

    EXCEPTION
      WHEN foreign_key_violation THEN
        -- Vínculo surgiu entre o SELECT e o DELETE: pula silenciosamente
        NULL;
    END;
  END LOOP;

  -- ------------------------------------------------------------------
  -- E. Atualizar referencia_syncs com resultado final
  -- ------------------------------------------------------------------
  UPDATE public.referencia_syncs
  SET    equivalentes = v_equivalentes,
         criadas      = v_criadas,
         arquivadas   = v_arquivadas,
         deletadas    = v_deletadas,
         alteracoes   = '[]'::jsonb
  WHERE  id = p_sync_id;

  -- ------------------------------------------------------------------
  -- F. Retornar resumo
  -- ------------------------------------------------------------------
  RETURN jsonb_build_object(
    'sync_id',      p_sync_id,
    'equivalentes', v_equivalentes,
    'criadas',      v_criadas,
    'arquivadas',   v_arquivadas,
    'deletadas',    v_deletadas
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. Permissões: service_role only (mesmo contrato de segurança de antes)
-- ----------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.aplicar_sync_referencias(uuid, jsonb) FROM public;
GRANT  EXECUTE ON FUNCTION public.aplicar_sync_referencias(uuid, jsonb) TO service_role;

-- ----------------------------------------------------------------------------
-- 10. restaurar_referencias_de_backup: remover passo de cancelar pendências
--     (referencia_sync_pendencias foi dropada no passo 3 acima).
--     Lógica de reativar / criar / arquivar intacta; pendencias_canceladas
--     retorna 0 constante para manter compatibilidade do contrato de retorno.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.restaurar_referencias_de_backup(p_backup_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
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
  v_reativadas_id uuid[] := '{}'::uuid[];
  v_criadas_id    uuid[] := '{}'::uuid[];
  v_arquivadas_id uuid[] := '{}'::uuid[];
BEGIN
  -- Guarda de autorização (§10.2/§12.4): admin E pode_recuperacao
  IF NOT public.pode_operar_recuperacao(auth.uid()) THEN
    RAISE EXCEPTION 'Permissão negada: apenas administradores com permissão de recuperação (usuarios.pode_recuperacao) podem restaurar backups';
  END IF;

  -- Alvo: leitura leve do environment do sync que gerou o backup (imutável)
  SELECT s.environment
  INTO   v_environment
  FROM   public.referencia_backups b
  JOIN   public.referencia_syncs   s ON s.id = b.sync_id
  WHERE  b.id = p_backup_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Backup não encontrado: %', p_backup_id;
  END IF;

  -- Guarda de serialização (B10c), por environment
  IF EXISTS (
    SELECT 1
    FROM   public.referencia_syncs s
    WHERE  s.environment = v_environment
      AND  s.status = 'running'
  ) THEN
    RAISE EXCEPTION 'Existe sync em execução neste environment — aguarde a conclusão antes de restaurar';
  END IF;

  -- Backup alvo com lock
  SELECT b.payload, b.payload_sha256, b.sync_id
  INTO   v_backup
  FROM   public.referencia_backups b
  WHERE  b.id = p_backup_id
  FOR UPDATE OF b;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Backup não encontrado: %', p_backup_id;
  END IF;

  -- Integridade (design §9)
  IF jsonb_typeof(v_backup.payload) <> 'string'
     OR encode(extensions.digest(v_backup.payload #>> '{}', 'sha256'), 'hex') <> v_backup.payload_sha256 THEN
    RAISE EXCEPTION 'Integridade do backup não verificada (payload_sha256 divergente do conteúdo)';
  END IF;

  -- GUC D-7/§11.3: flips de is_ativa da restauração sem is_ativa_manual duplicado
  PERFORM set_config('app.audit_origin', 'curadoria', true);

  -- Conjunto das chaves ativas no backup (apenas globais)
  CREATE TEMP TABLE _restore_backup_ativos (
    id               uuid        NOT NULL,
    nome             text        NOT NULL,
    marca            text        NOT NULL DEFAULT '',
    fenil_mg_por_100g numeric(10,1) NOT NULL
  ) ON COMMIT DROP;

  INSERT INTO _restore_backup_ativos (id, nome, marca, fenil_mg_por_100g)
  SELECT
    (l->>'id')::uuid,
    l->>'nome',
    COALESCE(l->>'marca', ''),
    (l->>'fenil_mg_por_100g')::numeric(10,1)
  FROM   jsonb_array_elements((v_backup.payload #>> '{}')::jsonb) AS l
  WHERE  (l->>'is_global')::boolean = true
    AND  (l->>'is_ativa')::boolean  = true;

  CREATE INDEX _restore_backup_ativos_identidade_idx
    ON _restore_backup_ativos (lower(trim(both FROM nome)), lower(trim(both FROM marca)), fenil_mg_por_100g);

  -- 1. Ativos do backup sem ativa de mesma chave hoje → reativa ou cria
  FOR v_linha IN
    SELECT b.id, b.nome, b.marca, b.fenil_mg_por_100g
    FROM   _restore_backup_ativos b
  LOOP
    v_ref_id := v_linha.id;
    v_nome   := v_linha.nome;
    v_marca  := v_linha.marca;
    v_fenil  := v_linha.fenil_mg_por_100g;

    IF EXISTS (
      SELECT 1
      FROM   public.referencias r
      WHERE  r.is_global
        AND  r.is_ativa
        AND  lower(trim(both FROM r.nome))  = lower(trim(both FROM v_nome))
        AND  lower(trim(both FROM r.marca)) = lower(trim(both FROM v_marca))
        AND  r.fenil_mg_por_100g = v_fenil
    ) THEN
      CONTINUE;
    END IF;

    UPDATE public.referencias r
    SET    is_ativa = true, updated_at = now()
    WHERE  r.id = v_ref_id
      AND  NOT r.is_ativa
      AND  lower(trim(both FROM r.nome))  = lower(trim(both FROM v_nome))
      AND  lower(trim(both FROM r.marca)) = lower(trim(both FROM v_marca))
      AND  r.fenil_mg_por_100g = v_fenil
    RETURNING r.id INTO v_algum_id;

    IF FOUND THEN
      v_reativadas    := v_reativadas + 1;
      v_reativadas_id := v_reativadas_id || v_ref_id;
    ELSIF EXISTS (SELECT 1 FROM public.referencias WHERE id = v_ref_id) THEN
      RAISE EXCEPTION 'Conflito na restauração: referência % existe com identidade divergente da do backup — intervenção manual necessária', v_ref_id;
    ELSE
      IF v_sistema_id IS NULL THEN
        SELECT u.id INTO v_sistema_id
        FROM   public.usuarios u
        WHERE  u.email = 'sistema@meufenil.local'
        ORDER  BY u.created_at
        LIMIT  1;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Ator Sistema não provisionado (sistema@meufenil.local) — execute scripts/provisionar-ator-sistema.js';
        END IF;
      END IF;

      INSERT INTO public.referencias (id, nome, marca, fenil_mg_por_100g, is_global, is_ativa, criado_por)
      VALUES (v_ref_id, v_nome, v_marca, v_fenil, true, true, v_sistema_id);

      v_criadas    := v_criadas + 1;
      v_criadas_id := v_criadas_id || v_ref_id;
    END IF;
  END LOOP;

  -- 2. Globais ativas HOJE sem chave ativa no backup → arquivadas (nunca DELETE)
  FOR v_linha IN
    SELECT r.id
    FROM   public.referencias r
    WHERE  r.is_global
      AND  r.is_ativa
      AND  NOT EXISTS (
             SELECT 1
             FROM   _restore_backup_ativos k
             WHERE  lower(trim(both FROM r.nome))  = lower(trim(both FROM k.nome))
               AND  lower(trim(both FROM r.marca)) = lower(trim(both FROM k.marca))
               AND  r.fenil_mg_por_100g = k.fenil_mg_por_100g
           )
  LOOP
    UPDATE public.referencias r
    SET    is_ativa = false, updated_at = now()
    WHERE  r.id = v_linha.id
      AND  r.is_ativa
    RETURNING r.id INTO v_algum_id;

    IF FOUND THEN
      v_arquivadas    := v_arquivadas + 1;
      v_arquivadas_id := v_arquivadas_id || v_linha.id;
    END IF;
  END LOOP;

  -- 3. Evento único `restore` (D-5/§10.2): pendencias_canceladas sempre 0 (ENH-0009)
  INSERT INTO public.referencia_eventos (sync_id, referencia_id, tipo, actor_id, detalhes)
  VALUES (
    null, null, 'restore', auth.uid(),
    jsonb_build_object(
      'backup_id',            p_backup_id,
      'reativadas',           v_reativadas,
      'criadas',              v_criadas,
      'arquivadas',           v_arquivadas,
      'pendencias_canceladas', 0,
      'reativadas_ids',       v_reativadas_id,
      'criadas_ids',          v_criadas_id,
      'arquivadas_ids',       v_arquivadas_id
    )
  );

  RETURN jsonb_build_object(
    'backup_id',            p_backup_id,
    'reativadas',           v_reativadas,
    'criadas',              v_criadas,
    'arquivadas',           v_arquivadas,
    'pendencias_canceladas', 0
  );
END;
$$;
