-- ============================================================================
-- Migration: Limite diário default único (500) para novos usuários
-- Referência: DEBT-0002 (.ai/specs/proposed/technical-debt/DEBT-0002-limite-diario-default-duplicado.md)
-- Decisão: B — padronizar em 500 (decidido pelo solicitante em 2026-08-15)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- handle_new_user deixa de definir limite_diario_mg no sign-up;
-- o default da coluna usuarios.limite_diario_mg (500) passa a valer.
-- Owner e grants são preservados por CREATE OR REPLACE.
-- Obs.: o corpo normaliza CRLF→LF (sem mudança semântica — ver ressalva DEBT-0001).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.usuarios (
    id,
    nome,
    email,
    role,
    timezone,
    created_at,
    updated_at
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    'user',
    'America/Sao_Paulo',
    now(),
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
