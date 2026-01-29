import { supabase } from "@/react-app/lib/supabase";
import { AppError } from "@/react-app/lib/errors";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delegar-acesso`;

type DelegarAcessoRequest =
  | { acao: "listar" }
  | { acao: "conceder"; email: string }
  | { acao: "revogar"; delegacao_id: string }
  | { acao: "assumir"; delegacao_id: string }
  | { acao: "sair" };

export type AssumirPerfilResponse = {
  usuario_assumido_id: string;
  owner: {
    id: string;
    nome: string | null;
    email: string | null;
  };
};

async function callDelegarAcesso<T>(
  payload: DelegarAcessoRequest
): Promise<T> {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError || !sessionData?.session?.access_token) {
    throw new Error("Usuário não autenticado");
  }

  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionData.session.access_token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error ?? "Erro ao processar delegação de acesso");
  }

  return data as T;
}

/* =========================
 * API pública do service
 * ========================= */

export async function listarDelegacoes(usuarioId: string) {
  const [concedidos, recebidos] = await Promise.all([
    supabase
      .from("delegacoes_acesso")
      .select(`
        id,
        created_at,
        usuario_destino:usuarios!delegacoes_acesso_delegado_fk (
          id,
          nome,
          email
        )
      `)
      .eq("concedente_id", usuarioId)
      .is("revoked_at", null),

    supabase
      .from("delegacoes_acesso")
      .select(`
        id,
        created_at,
        usuario_origem:usuarios!delegacoes_acesso_concedente_fk (
          id,
          nome,
          email
        )
      `)
      .eq("delegado_id", usuarioId)
      .is("revoked_at", null),
  ]);

  if (concedidos.error || recebidos.error) {
    throw new AppError(
      "DELEGACOES_LIST_ERROR",
      "Erro ao listar delegações",
      concedidos.error || recebidos.error
    );
  }

  return {
    concedidos: concedidos.data ?? [],
    recebidos: recebidos.data ?? [],
  };
}

export async function concederAcesso(email: string) {
  return callDelegarAcesso<{ success: true }>({
    acao: "conceder",
    email,
  });
}

export async function revogarAcesso(delegacaoId: string) {
  return callDelegarAcesso<{ success: true }>({
    acao: "revogar",
    delegacao_id: delegacaoId,
  });
}

export async function assumirPerfil(
  delegacaoId: string,
): Promise<AssumirPerfilResponse> {
  const { data, error } = await supabase.functions.invoke(
    "delegar-acesso",
    {
      body: {
        acao: "assumir",
        delegacao_id: delegacaoId,
      },
    },
  );

  if (error) throw error;

  return data;
}

export async function sairDoPerfilAssumido() {
  return callDelegarAcesso<{ success: true }>({
    acao: "sair",
  });
}
