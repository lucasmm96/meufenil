-- ============================================================================
-- Migration: FEAT-0017 M1 — endurecimento de ativar_referencia (R4-3)
-- Referência: FEAT-0017 · design .ai/.temp/feat0017-fase1-design-2026-09-04.md
--             §18 R4-3(a); BR-024/BR-037 (regras vigentes)
-- Aprovado por: Lucas Martins Menezes em 2026-09-04 (rodada R4 — recomendação
--             R4-3(a): reativação de global exige is_admin_user)
-- Contexto:   a Fase 0 (design §5.2) encontrou lacuna de autorização — o RPC
--             permitia dono/delegado reativar referência GLOBAL (is_global=true)
--             via branch de pessoal; as regras BR-024/BR-037 já documentam
--             "global por admin". Definição original: 20260811210456
--             (fix_security_rls_rpc). Par verificado: remover_ou_desativar_
--             referencia já restringe global a admin (20260904000000) — sem
--             mudança no par; pessoais seguem dono/delegado (inalterado).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Reescrita com guarda explícita de is_global (estrutura do par remover/
-- desativar): referência global só reativa por admin; pessoal segue
-- dono/delegado/admin. Mensagem de não-encontrada preservada.
-- ----------------------------------------------------------------------------
create or replace function public.ativar_referencia(p_referencia_id uuid)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $$
declare
  v_is_global boolean;
begin
  -- 1. Verificar se a referência existe e obter is_global
  select is_global into v_is_global
  from public.referencias
  where id = p_referencia_id;

  if not found then
    raise exception 'Referência não encontrada ou permissão negada';
  end if;

  -- 2. Referências globais só podem ser reativadas por admins (R4-3; BR-024/BR-037)
  if v_is_global and not public.is_admin_user(auth.uid()) then
    raise exception 'Permissão negada: apenas administradores podem reativar referências globais';
  end if;

  -- 3. Reativar — pessoais: dono, delegado pelo dono ou admin; globais: admin
  update public.referencias
  set
    is_ativa = true,
    updated_at = now()
  where id = p_referencia_id
    and (
      -- Dono da referência
      criado_por = auth.uid()
      -- OU delegado pelo dono
      or exists (
        select 1 from public.delegacoes_acesso da
        where da.concedente_id = referencias.criado_por
          and da.delegado_id = auth.uid()
          and da.revoked_at is null
      )
      -- OU administrador
      or public.is_admin_user(auth.uid())
    );

  if not found then
    raise exception 'Referência não encontrada ou permissão negada';
  end if;

  return 'activated';
end;
$$;
