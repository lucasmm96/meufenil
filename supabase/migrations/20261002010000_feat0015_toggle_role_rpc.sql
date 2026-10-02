-- FEAT-0015: Fluxo de atribuição de papel admin
-- Decisão: UI admin + RPC SECURITY DEFINER (único caminho de escrita para role)
-- 1. Restringe coluna role de ser atualizada por sessões authenticated
-- 2. Cria RPC toggle_role_usuario: valida admin, anti-self, valida role

-- 1. Revogar UPDATE da coluna role para authenticated
--    (service_role e SECURITY DEFINER functions continuam podendo atualizar)
REVOKE UPDATE (role) ON TABLE public.usuarios FROM authenticated;

-- 2. RPC toggle_role_usuario
CREATE OR REPLACE FUNCTION public.toggle_role_usuario(
  alvo_id uuid,
  novo_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF novo_role NOT IN ('admin', 'user') THEN
    RAISE EXCEPTION 'Papel inválido: %', novo_role;
  END IF;

  IF auth.uid() = alvo_id THEN
    RAISE EXCEPTION 'Não é permitido alterar o próprio papel';
  END IF;

  IF NOT is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Permissão negada: apenas administradores podem alterar papéis';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM usuarios WHERE id = alvo_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  UPDATE usuarios SET role = novo_role WHERE id = alvo_id;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_role_usuario(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_role_usuario(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_role_usuario(uuid, text) TO service_role;
