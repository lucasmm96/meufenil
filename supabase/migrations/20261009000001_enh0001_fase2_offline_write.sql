-- ENH-0001 Fase 2: offline write support
-- Adds client_uuid to registros (idempotency key for offline sync)
-- Adds content JSONB to notificacoes (for archived-ref notification dedup)
-- Creates fn_upsert_consumo_offline SECURITY DEFINER RPC

-- 1. notificacoes: add content JSONB (for idempotency check on archived-ref notifications)
ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS content JSONB;

-- 2. registros: add client_uuid (offline idempotency key)
ALTER TABLE registros ADD COLUMN IF NOT EXISTS client_uuid UUID;

-- 3. Partial unique index: prevents duplicate creates (client sent twice mid-sync)
CREATE UNIQUE INDEX IF NOT EXISTS registros_client_uuid_idx
  ON registros(client_uuid)
  WHERE client_uuid IS NOT NULL;

-- 4. RPC fn_upsert_consumo_offline: SECURITY DEFINER
--    - user_id derived from auth.uid() internally (not a param)
--    - content fixed (no free-form field accepted from client)
--    - alimento verified against DB in same operation
--    - dual idempotency: client_uuid unique on registros + EXISTS check on notificacoes
--    - policy notificacoes_insert_admin_only UNCHANGED (INSERT via SECURITY DEFINER)
--    - returns: {status: 'ok', registro_id} | {status: 'archived_ref', client_uuid} | {status: 'error', code}
CREATE OR REPLACE FUNCTION fn_upsert_consumo_offline(
  p_client_uuid UUID,
  p_alimento_id UUID,
  p_quantidade NUMERIC,
  p_data_registro DATE,
  p_hora_registro TIME
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_fenil_mg NUMERIC;
  v_alimento_nome TEXT;
  v_alimento_ativo BOOLEAN;
  v_registro_id UUID;
  v_notif_exists BOOLEAN;
BEGIN
  -- Derive user_id from session (never trusted from client)
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'code', 'not_authenticated');
  END IF;

  -- Idempotency: if client_uuid already used, return ok (duplicate send)
  SELECT id INTO v_registro_id
  FROM registros
  WHERE client_uuid = p_client_uuid
    AND usuario_id = v_user_id;

  IF FOUND THEN
    RETURN jsonb_build_object('status', 'ok', 'registro_id', v_registro_id);
  END IF;

  -- Verify alimento exists and is active
  SELECT nome, is_ativa INTO v_alimento_nome, v_alimento_ativo
  FROM referencias
  WHERE id = p_alimento_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'error', 'code', 'alimento_not_found');
  END IF;

  IF NOT v_alimento_ativo THEN
    -- Alimento archived: emit notification (if not already emitted for this client_uuid)
    SELECT EXISTS (
      SELECT 1 FROM notificacoes
      WHERE usuario_id = v_user_id
        AND type = 'system_event'
        AND content->>'client_uuid' = p_client_uuid::TEXT
    ) INTO v_notif_exists;

    IF NOT v_notif_exists THEN
      INSERT INTO notificacoes (usuario_id, type, title, body, content)
      VALUES (
        v_user_id,
        'system_event',
        'Alimento indisponível',
        v_alimento_nome || ' não pôde ser sincronizado — o alimento não está mais disponível. Você pode registrar novamente usando outro alimento.',
        jsonb_build_object('client_uuid', p_client_uuid)
      );
    END IF;

    RETURN jsonb_build_object('status', 'archived_ref', 'client_uuid', p_client_uuid);
  END IF;

  -- Compute fenil_mg: (fenil_mg_por_100g / 100) * quantidade
  SELECT fenil_mg_por_100g INTO v_fenil_mg FROM referencias WHERE id = p_alimento_id;
  v_fenil_mg := (v_fenil_mg / 100.0) * p_quantidade;

  -- Insert registro
  INSERT INTO registros (usuario_id, referencia_id, data, peso_g, fenil_mg, client_uuid)
  VALUES (v_user_id, p_alimento_id, p_data_registro, p_quantidade, v_fenil_mg, p_client_uuid)
  RETURNING id INTO v_registro_id;

  RETURN jsonb_build_object('status', 'ok', 'registro_id', v_registro_id);

EXCEPTION WHEN unique_violation THEN
  -- Race condition: another process inserted same client_uuid concurrently
  SELECT id INTO v_registro_id FROM registros WHERE client_uuid = p_client_uuid AND usuario_id = v_user_id;
  RETURN jsonb_build_object('status', 'ok', 'registro_id', v_registro_id);
END;
$$;

-- Revoke from public, grant to authenticated only
REVOKE ALL ON FUNCTION fn_upsert_consumo_offline(UUID, UUID, NUMERIC, DATE, TIME) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_upsert_consumo_offline(UUID, UUID, NUMERIC, DATE, TIME) TO authenticated;
