-- FEAT-0018: Central de Notificações ao Usuário
-- Migration: 20261005000000_feat0018_central_notificacoes.sql
--
-- Cria tabela notificacoes, RLS, RPCs e trigger health_alert.
-- NÃO aplique automaticamente — o usuário aplicará manualmente.

-- ============================================================
-- 1. TABELA notificacoes
-- ============================================================
CREATE TABLE IF NOT EXISTS "public"."notificacoes" (
    "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
    "user_id"    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "type"       TEXT        NOT NULL,
    "title"      TEXT        NOT NULL,
    "body"       TEXT        NOT NULL,
    "read_at"    TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "expires_at" TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
    "target"     TEXT        NOT NULL DEFAULT 'user',
    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "public"."notificacoes" OWNER TO "postgres";

CREATE INDEX IF NOT EXISTS "notificacoes_user_id_idx"
    ON "public"."notificacoes" ("user_id");

CREATE INDEX IF NOT EXISTS "notificacoes_expires_at_idx"
    ON "public"."notificacoes" ("expires_at");

-- ============================================================
-- 2. RLS
-- ============================================================
ALTER TABLE "public"."notificacoes" ENABLE ROW LEVEL SECURITY;

-- SELECT: usuário vê as próprias notificações (target='user') e todos os broadcasts
CREATE POLICY "notificacoes_select_proprias_e_broadcasts"
    ON "public"."notificacoes"
    FOR SELECT
    USING (
        user_id = auth.uid()
        OR target = 'broadcast'
    );

-- INSERT: somente admins (via RLS) ou service_role (bypassa RLS)
-- Usuários comuns NÃO podem inserir diretamente
CREATE POLICY "notificacoes_insert_admin_only"
    ON "public"."notificacoes"
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_admin_user(auth.uid())
    );

-- UPDATE: usuário pode atualizar apenas as próprias linhas (para marcar como lida)
CREATE POLICY "notificacoes_update_propria"
    ON "public"."notificacoes"
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- DELETE: sem política (deleção via service_role pelo job de limpeza ou cascade)

-- ============================================================
-- 3. RPC marcar_notificacao_lida
-- ============================================================
CREATE OR REPLACE FUNCTION "public"."marcar_notificacao_lida"(
    "notificacao_id" UUID
)
RETURNS VOID
LANGUAGE "plpgsql"
SECURITY INVOKER
SET "search_path" TO 'public'
AS $$
BEGIN
    UPDATE notificacoes
    SET read_at = now()
    WHERE id = notificacao_id
      AND user_id = auth.uid()
      AND read_at IS NULL;
END;
$$;

ALTER FUNCTION "public"."marcar_notificacao_lida"("notificacao_id" UUID) OWNER TO "postgres";
REVOKE EXECUTE ON FUNCTION "public"."marcar_notificacao_lida"("notificacao_id" UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."marcar_notificacao_lida"("notificacao_id" UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."marcar_notificacao_lida"("notificacao_id" UUID) TO service_role;

-- ============================================================
-- 4. RPC marcar_todas_notificacoes_lidas
-- ============================================================
CREATE OR REPLACE FUNCTION "public"."marcar_todas_notificacoes_lidas"()
RETURNS VOID
LANGUAGE "plpgsql"
SECURITY INVOKER
SET "search_path" TO 'public'
AS $$
BEGIN
    UPDATE notificacoes
    SET read_at = now()
    WHERE user_id = auth.uid()
      AND read_at IS NULL
      AND (expires_at IS NULL OR expires_at > now());
END;
$$;

ALTER FUNCTION "public"."marcar_todas_notificacoes_lidas"() OWNER TO "postgres";
REVOKE EXECUTE ON FUNCTION "public"."marcar_todas_notificacoes_lidas"() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."marcar_todas_notificacoes_lidas"() TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."marcar_todas_notificacoes_lidas"() TO service_role;

-- ============================================================
-- 5. Trigger health_alert
--    Dispara após INSERT/UPDATE na tabela registros.
--    Quando o total diário do usuário >= limite_diario_mg,
--    insere uma notificação health_alert, evitando duplicatas
--    nas últimas 24h.
--
--    A função é SECURITY DEFINER para poder inserir em
--    notificacoes (contornando RLS) e ler usuarios.
-- ============================================================
CREATE OR REPLACE FUNCTION "public"."fn_health_alert_notificacao"()
RETURNS TRIGGER
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
DECLARE
    v_total_diario NUMERIC;
    v_limite       NUMERIC;
    v_duplicata    BOOLEAN;
BEGIN
    -- Calcula o total de fenil_mg do usuário no dia do registro
    SELECT COALESCE(SUM(r.fenil_mg), 0)
      INTO v_total_diario
      FROM registros r
     WHERE r.usuario_id = NEW.usuario_id
       AND r.data = NEW.data;

    -- Busca o limite_diario_mg do usuário
    SELECT u.limite_diario_mg
      INTO v_limite
      FROM usuarios u
     WHERE u.id = NEW.usuario_id;

    -- Só age quando o limite é atingido/ultrapassado
    IF v_total_diario < v_limite THEN
        RETURN NEW;
    END IF;

    -- Verifica se já existe uma notificação health_alert não expirada
    -- nas últimas 24h para este usuário (evita duplicatas)
    SELECT EXISTS (
        SELECT 1
          FROM notificacoes n
         WHERE n.user_id = NEW.usuario_id
           AND n.type = 'health_alert'
           AND n.expires_at > now()
           AND n.created_at >= now() - INTERVAL '24 hours'
    ) INTO v_duplicata;

    IF v_duplicata THEN
        RETURN NEW;
    END IF;

    -- Insere a notificação de alerta de saúde
    INSERT INTO notificacoes (
        user_id,
        type,
        title,
        body,
        target
    ) VALUES (
        NEW.usuario_id,
        'health_alert',
        'Limite diário atingido',
        'Você atingiu ou ultrapassou seu limite diário de fenilalanina (' ||
            ROUND(v_limite::NUMERIC, 1) || ' mg). Atenção ao consumo de hoje.',
        'user'
    );

    RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."fn_health_alert_notificacao"() OWNER TO "postgres";

-- Trigger: dispara após INSERT ou UPDATE em registros
CREATE OR REPLACE TRIGGER "trg_health_alert_notificacao"
    AFTER INSERT OR UPDATE ON "public"."registros"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."fn_health_alert_notificacao"();
