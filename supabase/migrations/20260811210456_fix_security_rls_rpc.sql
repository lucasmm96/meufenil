-- ============================================================================
-- Migration: Correção de 3 vulnerabilidades de segurança
-- Referência: docs/analises/04-plano-correcao-seguranca.md
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Correção 1: Substituir debug_allow_all por política admin-only na tabela usuarios
-- Problema:  debug_allow_all com USING (true) permitia SELECT irrestrito
-- Solução:   Remover debug_allow_all e criar política restrita a admins
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "debug_allow_all" ON "public"."usuarios";

CREATE POLICY "admin_can_select_all_usuarios"
  ON "public"."usuarios"
  FOR SELECT
  TO "authenticated"
  USING (public.is_admin_user(auth.uid()));

-- ----------------------------------------------------------------------------
-- Correção 2: Adicionar verificação de autorização em ativar_referencia
-- Problema:  Função SECURITY DEFINER sem verificação de permissão
-- Solução:   Verificar se o chamador é dono, delegado ou admin
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ativar_referencia(p_referencia_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.referencias
  SET
    is_ativa = true,
    updated_at = now()
  WHERE id = p_referencia_id
    AND (
      -- Dono da referência
      criado_por = auth.uid()
      -- OU delegado pelo dono
      OR EXISTS (
        SELECT 1 FROM public.delegacoes_acesso da
        WHERE da.concedente_id = referencias.criado_por
          AND da.delegado_id = auth.uid()
          AND da.revoked_at IS NULL
      )
      -- OU administrador
      OR public.is_admin_user(auth.uid())
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referência não encontrada ou permissão negada';
  END IF;

  RETURN 'activated';
END;
$$;

-- ----------------------------------------------------------------------------
-- Correção 3: Adicionar verificação de autorização em remover_ou_desativar_referencia
-- Problema:  Função SECURITY DEFINER sem verificação de permissão
-- Solução:   Verificar se o chamador é dono, delegado ou admin;
--            além disso, referências globais só podem ser removidas por admins
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remover_ou_desativar_referencia(p_referencia_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_tem_vinculo boolean;
  v_is_global  boolean;
  v_autorizado boolean;
BEGIN
  -- 1. Verificar se a referência existe e obter is_global
  SELECT is_global INTO v_is_global
  FROM public.referencias
  WHERE id = p_referencia_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referência não encontrada';
  END IF;

  -- 2. Verificar autorização (dono, delegado ou admin)
  SELECT EXISTS (
    SELECT 1 FROM public.referencias r
    WHERE r.id = p_referencia_id
      AND (
        r.criado_por = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.delegacoes_acesso da
          WHERE da.concedente_id = r.criado_por
            AND da.delegado_id = auth.uid()
            AND da.revoked_at IS NULL
        )
        OR public.is_admin_user(auth.uid())
      )
  ) INTO v_autorizado;

  IF NOT v_autorizado THEN
    RAISE EXCEPTION 'Permissão negada: você não pode remover esta referência';
  END IF;

  -- 3. Referências globais só podem ser removidas por admins
  IF v_is_global AND NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Permissão negada: apenas administradores podem remover referências globais';
  END IF;

  -- 4. Verificar vínculo com registros
  SELECT EXISTS (
    SELECT 1 FROM public.registros
    WHERE referencia_id = p_referencia_id
  ) INTO v_tem_vinculo;

  -- 5. Desativar (soft delete) se houver registros; remover permanentemente se não
  IF v_tem_vinculo THEN
    UPDATE public.referencias
    SET is_ativa = false, updated_at = now()
    WHERE id = p_referencia_id;
    RETURN 'deactivated';
  ELSE
    DELETE FROM public.referencias WHERE id = p_referencia_id;
    RETURN 'deleted';
  END IF;
END;
$$;
