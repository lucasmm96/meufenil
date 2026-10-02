-- REF-0002: remover RPCs órfãs SECURITY DEFINER sem verificação interna de autorização e sem chamadores
-- dashboard_hoje e dashboard_ultimos_dias aceitavam qualquer uid sem checar auth.uid()
DROP FUNCTION IF EXISTS public.dashboard_hoje(uuid);
DROP FUNCTION IF EXISTS public.dashboard_ultimos_dias(uuid, integer);
