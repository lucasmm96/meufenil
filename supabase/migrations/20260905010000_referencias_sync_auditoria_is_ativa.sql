-- ============================================================================
-- Migration: FEAT-0017 M1 — auditoria de alteração manual de is_ativa por admin
-- Referência: FEAT-0017 (spec prop.) · design .ai/.temp/feat0017-fase1-design-
--             2026-09-04.md §11.3 (trigger + GUC app.audit_origin, D-7)
-- Aprovado por: Lucas Martins Menezes em 2026-09-04 (B7/OQ4; rodada R4)
-- Escopo M1:  trigger trg_auditar_is_ativa_manual + função SECURITY DEFINER.
--             Cobre qualquer UPDATE autenticado de is_ativa por admin (RPCs de
--             remoção/ativação incluídos — o chamador admin é o actor), inclusive
--             bypass via policy dual-check (claim JWT).
--             Fronteira OQ4: escritas de owner/delegado em PESSOAIS não são
--             auditadas (não-admin). service_role/migração (auth.uid() null)
--             não dispara (WHEN). RPCs de sync/curadoria/rollback/restauração
--             (M4/M5) suprimem este evento com app.audit_origin='curadoria'
--             e registram eventos específicos (D-7).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Função do trigger
--    SECURITY DEFINER + set search_path (padrão ADR-0010/design §5.6): insere
--    o evento is_ativa_manual quando o autor do UPDATE é admin E o GUC de
--    origem não marca a escrita como curadoria (rollback/restauração reativam
--    com eventos próprios — sem duplicar is_ativa_manual).
--    current_setting(..., true): GUC ausente → NULL → coalesce '' → audita.
-- ----------------------------------------------------------------------------
create or replace function public.fn_auditar_is_ativa_manual()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
begin
  if public.is_admin_user(auth.uid())
     and coalesce(current_setting('app.audit_origin', true), '') <> 'curadoria' then
    insert into public.referencia_eventos (
      sync_id, pendencia_id, referencia_id, tipo, actor_id, detalhes
    ) values (
      null, null, new.id, 'is_ativa_manual', auth.uid(),
      jsonb_build_object('de', old.is_ativa, 'para', new.is_ativa)
    );
  end if;

  return null;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Trigger
--    AFTER UPDATE OF is_ativa FOR EACH ROW; WHEN (auth.uid() is not null) —
--    service_role (roteiro/scripts/migração) tem uid null → skip.
-- ----------------------------------------------------------------------------
drop trigger if exists trg_auditar_is_ativa_manual on public.referencias;

create trigger trg_auditar_is_ativa_manual
after update of is_ativa on public.referencias
for each row
when (auth.uid() is not null)
execute function public.fn_auditar_is_ativa_manual();
