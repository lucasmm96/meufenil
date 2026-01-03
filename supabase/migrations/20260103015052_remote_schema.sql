


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."dashboard_hoje"("uid" "uuid") RETURNS TABLE("total" numeric, "limite" numeric, "data" "date")
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  select
    coalesce(sum(r.fenil_mg), 0) as total,
    u.limite_diario_mg as limite,
    current_date as data
  from usuarios u
  left join registros r
    on r.usuario_id = u.id
   and r.data = current_date
  where u.id = uid
  group by u.limite_diario_mg;
$$;


ALTER FUNCTION "public"."dashboard_hoje"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dashboard_ultimos_dias"("uid" "uuid", "dias" integer) RETURNS TABLE("data" "date", "total" numeric)
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  select
    r.data,
    sum(r.fenil_mg) as total
  from registros r
  where r.usuario_id = uid
    and r.data >= current_date - dias
  group by r.data
  order by r.data asc;
$$;


ALTER FUNCTION "public"."dashboard_ultimos_dias"("uid" "uuid", "dias" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_normalizar_nome_referencia"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.nome_normalizado := lower(trim(new.nome));
  return new;
end;
$$;


ALTER FUNCTION "public"."fn_normalizar_nome_referencia"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_estatisticas_admin"() RETURNS TABLE("tamanho_db_mb" integer, "registros_totais" bigint, "referencias_total" bigint, "referencias_globais" bigint, "referencias_personalizadas" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    (pg_database_size(current_database()) / 1024 / 1024)::int as tamanho_db_mb,
    (select count(*) from public.registros),
    (select count(*) from public.referencias),
    (select count(*) from public.referencias where is_global = true),
    (select count(*) from public.referencias where is_global = false);
$$;


ALTER FUNCTION "public"."get_estatisticas_admin"() OWNER TO "postgres";


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
    limite_diario_mg,
    created_at,
    updated_at
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    'user',
    'America/Sao_Paulo',
    150,
    now(),
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."exames_pku" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "data_exame" "date" NOT NULL,
    "resultado_mg_dl" real NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."exames_pku" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."referencias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nome" "text" NOT NULL,
    "fenil_mg_por_100g" real NOT NULL,
    "criado_por" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "is_global" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "nome_normalizado" "text" NOT NULL
);


ALTER TABLE "public"."referencias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."registros" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "data" "date" NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "referencia_id" "uuid" NOT NULL,
    "peso_g" real NOT NULL,
    "fenil_mg" real NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."registros" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usuarios" (
    "id" "uuid" NOT NULL,
    "nome" "text",
    "email" "text",
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    "limite_diario_mg" real DEFAULT 500 NOT NULL,
    "timezone" "text" DEFAULT 'America/Sao_Paulo'::"text" NOT NULL,
    "consentimento_lgpd_em" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."usuarios" OWNER TO "postgres";


ALTER TABLE ONLY "public"."exames_pku"
    ADD CONSTRAINT "exames_pku_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referencias"
    ADD CONSTRAINT "referencias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."registros"
    ADD CONSTRAINT "registros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usuarios"
    ADD CONSTRAINT "usuarios_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."usuarios"
    ADD CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "referencias_nome_normalizado_unique" ON "public"."referencias" USING "btree" ("nome_normalizado");



CREATE UNIQUE INDEX "referencias_nome_unique" ON "public"."referencias" USING "btree" ("lower"("nome"));



CREATE OR REPLACE TRIGGER "trg_normalizar_nome_referencia" BEFORE INSERT OR UPDATE ON "public"."referencias" FOR EACH ROW EXECUTE FUNCTION "public"."fn_normalizar_nome_referencia"();



ALTER TABLE ONLY "public"."exames_pku"
    ADD CONSTRAINT "exames_pku_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."referencias"
    ADD CONSTRAINT "referencias_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."registros"
    ADD CONSTRAINT "registros_referencia_id_fkey" FOREIGN KEY ("referencia_id") REFERENCES "public"."referencias"("id");



ALTER TABLE ONLY "public"."registros"
    ADD CONSTRAINT "registros_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id");



ALTER TABLE ONLY "public"."usuarios"
    ADD CONSTRAINT "usuarios_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Usuarios podem ler seu próprio perfil" ON "public"."usuarios" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "Usuário pode deletar seus próprios registros" ON "public"."registros" FOR DELETE USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "Usuário pode ler referências" ON "public"."referencias" FOR SELECT USING ((("is_global" = true) OR ("criado_por" = "auth"."uid"())));



CREATE POLICY "Usuário pode ver referências globais ou próprias" ON "public"."referencias" FOR SELECT USING ((("is_global" = true) OR ("criado_por" = "auth"."uid"())));



CREATE POLICY "admin_can_insert_referencias" ON "public"."referencias" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."usuarios"
  WHERE (("usuarios"."id" = "auth"."uid"()) AND ("usuarios"."role" = 'admin'::"text")))));



CREATE POLICY "admin_can_select_referencias" ON "public"."referencias" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."usuarios"
  WHERE (("usuarios"."id" = "auth"."uid"()) AND ("usuarios"."role" = 'admin'::"text")))));



CREATE POLICY "admin_can_update_referencias" ON "public"."referencias" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."usuarios"
  WHERE (("usuarios"."id" = "auth"."uid"()) AND ("usuarios"."role" = 'admin'::"text")))));



CREATE POLICY "admin_only" ON "public"."usuarios" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "debug_allow_all" ON "public"."usuarios" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "delete own exames" ON "public"."exames_pku" FOR DELETE USING (("usuario_id" = "auth"."uid"()));



ALTER TABLE "public"."exames_pku" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert own exames" ON "public"."exames_pku" FOR INSERT WITH CHECK (("usuario_id" = "auth"."uid"()));



ALTER TABLE "public"."referencias" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."registros" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "select own exames" ON "public"."exames_pku" FOR SELECT USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "usuario atualiza seu perfil" ON "public"."usuarios" FOR UPDATE USING (("id" = "auth"."uid"()));



CREATE POLICY "usuario cria referencia" ON "public"."referencias" FOR INSERT WITH CHECK (("criado_por" = "auth"."uid"()));



CREATE POLICY "usuario cria registro" ON "public"."registros" FOR INSERT WITH CHECK (("usuario_id" = "auth"."uid"()));



CREATE POLICY "usuario cria seu perfil" ON "public"."usuarios" FOR INSERT WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "usuario ve referencias" ON "public"."referencias" FOR SELECT USING ((("is_global" = true) OR ("criado_por" = "auth"."uid"())));



CREATE POLICY "usuario ve registros" ON "public"."registros" FOR SELECT USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "usuario ve seu perfil" ON "public"."usuarios" FOR SELECT USING (("id" = "auth"."uid"()));



ALTER TABLE "public"."usuarios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "usuarios_insert_self" ON "public"."usuarios" FOR INSERT WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "usuarios_select_own" ON "public"."usuarios" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "usuarios_update_own" ON "public"."usuarios" FOR UPDATE USING (("id" = "auth"."uid"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."dashboard_hoje"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."dashboard_hoje"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard_hoje"("uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."dashboard_ultimos_dias"("uid" "uuid", "dias" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."dashboard_ultimos_dias"("uid" "uuid", "dias" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard_ultimos_dias"("uid" "uuid", "dias" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_normalizar_nome_referencia"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_normalizar_nome_referencia"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_normalizar_nome_referencia"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_estatisticas_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_estatisticas_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_estatisticas_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_estatisticas_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";


















GRANT ALL ON TABLE "public"."exames_pku" TO "anon";
GRANT ALL ON TABLE "public"."exames_pku" TO "authenticated";
GRANT ALL ON TABLE "public"."exames_pku" TO "service_role";



GRANT ALL ON TABLE "public"."referencias" TO "anon";
GRANT ALL ON TABLE "public"."referencias" TO "authenticated";
GRANT ALL ON TABLE "public"."referencias" TO "service_role";



GRANT ALL ON TABLE "public"."registros" TO "anon";
GRANT ALL ON TABLE "public"."registros" TO "authenticated";
GRANT ALL ON TABLE "public"."registros" TO "service_role";



GRANT ALL ON TABLE "public"."usuarios" TO "anon";
GRANT ALL ON TABLE "public"."usuarios" TO "authenticated";
GRANT ALL ON TABLE "public"."usuarios" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


