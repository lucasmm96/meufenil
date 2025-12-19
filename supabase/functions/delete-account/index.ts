// supabase/functions/delete-account/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    /* =========================
       AUTH HEADER
    ========================= */
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const accessToken = authHeader.replace("Bearer ", "");

    /* =========================
       VALIDAR USUÁRIO (anon)
    ========================= */
    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { data: authData, error: authError } =
      await supabaseAnon.auth.getUser(accessToken);

    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const userId = authData.user.id;

    /* =========================
       ADMIN CLIENT
    ========================= */
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    /* =========================
       1️⃣ APAGAR REGISTROS
    ========================= */
    const { error: registrosError } = await supabaseAdmin
      .from("registros")
      .delete()
      .eq("usuario_id", userId);

    if (registrosError) throw registrosError;

    /* =========================
       2️⃣ APAGAR USUÁRIO
       (referencias serão apagadas
        automaticamente via CASCADE)
    ========================= */
    const { error: usuarioError } = await supabaseAdmin
      .from("usuarios")
      .delete()
      .eq("id", userId);

    if (usuarioError) throw usuarioError;

    /* =========================
       3️⃣ APAGAR AUTH
    ========================= */
    const { error: authDeleteError } =
      await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authDeleteError) throw authDeleteError;

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    console.error("DELETE ACCOUNT ERROR:", err);
    return new Response(
      JSON.stringify({
        error: "Erro ao excluir conta",
        details: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
