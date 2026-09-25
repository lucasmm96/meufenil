-- ==========================================================================
-- ENH-0009 — Correção da função aplicar_sync_referencias
-- 4 bugs introduzidos na migration 20260923000000:
--   A. identidade_snapshot → detalhes (coluna inexistente na tabela)
--   B. registros_refeicao  → registros (tabela inexistente)
--   C. handler unique_violation ausente no loop de criações
--   D. guard auth.role() ausente (REVOKE/GRANT sozinhos são insuficientes)
-- Autorizado: Lucas Martins Menezes, 2026-09-24
-- ==========================================================================

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
  -- Bug D: guard de role — REVOKE/GRANT sozinhos são insuficientes
  -- (authenticator pode alcançar a função via SET ROLE; a verificação
  --  interna garante que apenas o service_role chama este caminho)
  -- ------------------------------------------------------------------
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Permissão negada: apenas service_role pode aplicar o plano de sync';
  END IF;

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

    -- Bug C: handler unique_violation para idempotência parcial
    BEGIN
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

    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION
        'Referência com identidade % % % já existe (constraint referencias_identidade_ativa_unique)',
        v_nome, v_marca, v_fenil
        USING ERRCODE = '23505';
    END;

    -- Bug A: coluna correta é 'detalhes', não 'identidade_snapshot'
    INSERT INTO public.referencia_eventos (
      referencia_id,
      tipo,
      sync_id,
      actor_id,
      detalhes,
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
      -- Bug A: coluna correta é 'detalhes'
      INSERT INTO public.referencia_eventos (
        referencia_id,
        tipo,
        sync_id,
        actor_id,
        detalhes,
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
      -- Bug B: tabela correta é 'registros', não 'registros_refeicao'
      SELECT EXISTS(
        SELECT 1 FROM public.registros rr
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
        -- Bug A: coluna correta é 'detalhes'
        INSERT INTO public.referencia_eventos (
          referencia_id,
          tipo,
          sync_id,
          actor_id,
          detalhes,
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
          -- Bug A: coluna correta é 'detalhes'
          INSERT INTO public.referencia_eventos (
            referencia_id,
            tipo,
            sync_id,
            actor_id,
            detalhes,
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
            -- Bug A: coluna correta é 'detalhes'
            INSERT INTO public.referencia_eventos (
              referencia_id,
              tipo,
              sync_id,
              actor_id,
              detalhes,
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
             -- Bug B: tabela correta é 'registros'
             SELECT 1 FROM public.registros rr
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

      -- Bug A: coluna correta é 'detalhes'
      INSERT INTO public.referencia_eventos (
        referencia_id,
        tipo,
        sync_id,
        actor_id,
        detalhes,
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
