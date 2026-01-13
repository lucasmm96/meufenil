import { supabase } from "@/react-app/lib/supabase";
import { AppError } from "@/react-app/lib/errors";

export interface PerfilLayoutDTO {
  role: string;
  nome?: string;
}

export async function getPerfilLayout(
  usuarioId: string,
): Promise<PerfilLayoutDTO> {
  const { data, error } = await supabase
    .from("usuarios")
    .select("role, nome")
    .eq("id", usuarioId)
    .single();

  if (error || !data) {
    throw new AppError(
      "LAYOUT_PROFILE_ERROR",
      "Erro ao carregar perfil do usuário",
      error,
    );
  }

  return data;
}
