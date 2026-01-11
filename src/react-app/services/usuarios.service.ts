import { supabase } from "@/react-app/lib/supabase";
import { AppError } from "@/react-app/lib/errors";

export interface PerfilUsuario {
  timezone: string;
}

export async function getPerfilUsuario(
  usuarioId: string
): Promise<PerfilUsuario> {
  const { data, error } = await supabase
    .from("usuarios")
    .select("timezone")
    .eq("id", usuarioId)
    .single();

  if (error || !data) {
    throw new AppError(
      "USER_PROFILE_ERROR",
      "Erro ao carregar perfil do usuário",
      error,
    );
  }

  return data;
}
