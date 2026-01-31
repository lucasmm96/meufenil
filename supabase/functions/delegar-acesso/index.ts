import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* =========================
 * CORS
 * ========================= */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  /* =========================
   * Preflight
   * ========================= */
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: corsHeaders }
      );
    }

    /* =========================
     * Auth
     * ========================= */
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Token ausente" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const accessToken = authHeader.replace("Bearer ", "");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const userId = user.id;

    /* =========================
     * Body
     * ========================= */
    const body = await req.json().catch(() => null);
    const acao = body?.acao;

    if (!acao || typeof acao !== "string") {
      return new Response(
        JSON.stringify({ error: "acao inválida" }),
        { status: 400, headers: corsHeaders }
      );
    }

    /* ======================================================
     * LISTAR
     * ====================================================== */
    if (acao === "listar") {
      const [concedidos, recebidos] = await Promise.all([
        supabaseAdmin
          .from("delegacoes_acesso")
          .select(`
            id,
            created_at,
            usuario_destino:usuarios!delegacoes_acesso_delegado_id_fkey (
              id, nome, email
            )
          `)
          .eq("concedente_id", userId)
          .is("revoked_at", null),

        supabaseAdmin
          .from("delegacoes_acesso")
          .select(`
            id,
            created_at,
            usuario_origem:usuarios!delegacoes_acesso_concedente_id_fkey (
              id, nome, email
            )
          `)
          .eq("delegado_id", userId)
          .is("revoked_at", null),
      ]);

      return new Response(
        JSON.stringify({
          concedidos: concedidos.data ?? [],
          recebidos: recebidos.data ?? [],
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    /* ======================================================
     * CONCEDER
     * ====================================================== */
    if (acao === "conceder") {
      const email = body?.email;

      if (!email || typeof email !== "string") {
        return new Response(
          JSON.stringify({ error: "email inválido" }),
          { status: 400, headers: corsHeaders }
        );
      }

      const { data: usuarioAlvo } = await supabaseAdmin
        .from("usuarios")
        .select("id")
        .eq("email", email)
        .single();

      if (!usuarioAlvo) {
        return new Response(
          JSON.stringify({ error: "Usuário não encontrado" }),
          { status: 404, headers: corsHeaders }
        );
      }

      if (usuarioAlvo.id === userId) {
        return new Response(
          JSON.stringify({ error: "Acesso a si mesmo não é permitido" }),
          { status: 400, headers: corsHeaders }
        );
      }

      await supabaseAdmin.from("delegacoes_acesso").insert({
        concedente_id: userId,
        delegado_id: usuarioAlvo.id,
      });

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: corsHeaders }
      );
    }

    /* ======================================================
     * REVOGAR
     * ====================================================== */
    if (acao === "revogar") {
      const delegacaoId = body?.delegacao_id;

      if (!delegacaoId) {
        return new Response(
          JSON.stringify({ error: "delegacao_id inválido" }),
          { status: 400, headers: corsHeaders }
        );
      }

      await supabaseAdmin
        .from("delegacoes_acesso")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", delegacaoId)
        .eq("concedente_id", userId);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: corsHeaders }
      );
    }

    /* ======================================================
     * ASSUMIR
     * ====================================================== */
    if (acao === "assumir") {
      const delegacaoId = body?.delegacao_id;

      if (!delegacaoId) {
        return new Response(
          JSON.stringify({ error: "delegacao_id inválido" }),
          { status: 400, headers: corsHeaders }
        );
      }

      const { data: delegacao } = await supabaseAdmin
        .from("delegacoes_acesso")
        .select("concedente_id")
        .eq("id", delegacaoId)
        .eq("delegado_id", userId)
        .is("revoked_at", null)
        .single();

      if (!delegacao) {
        return new Response(
          JSON.stringify({ error: "Acesso não autorizado" }),
          { status: 403, headers: corsHeaders }
        );
      }

      const { data: owner } = await supabaseAdmin
        .from("usuarios")
        .select("id, nome, email")
        .eq("id", delegacao.concedente_id)
        .single();

      return new Response(
        JSON.stringify({
          usuario_assumido_id: delegacao.concedente_id,
          owner,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    /* ======================================================
     * SAIR
     * ====================================================== */
    if (acao === "sair") {
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação não suportada" }),
      { status: 400, headers: corsHeaders }
    );
  } catch (err) {
    console.error("Erro delegar-acesso:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
