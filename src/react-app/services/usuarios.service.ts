import { supabase } from "@/react-app/lib/supabase";
import { AppError } from "@/react-app/lib/errors";
import { UsuarioDTO } from "./dtos/usuarios.dto";

function mapUsuarioDTO(data: any): UsuarioDTO {
  return {
    id: data.id,
    nome: data.nome,
    email: data.email,
    role: data.role,
    limite_diario_mg: data.limite_diario_mg,
    timezone: data.timezone,
    consentimento_lgpd_em: data.consentimento_lgpd_em,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function getUsuarioPerfil(
  usuarioId: string
): Promise<UsuarioDTO> {
  const { data, error } = await supabase
    .from("usuarios")
    .select(`
      id,
      nome,
      email,
      role,
      limite_diario_mg,
      timezone,
      consentimento_lgpd_em,
      created_at,
      updated_at
    `)
    .eq("id", usuarioId)
    .single();

  if (error || !data) {
    throw new AppError(
      "USER_PROFILE_ERROR",
      "Erro ao carregar perfil do usuário",
      error
    );
  }

  return mapUsuarioDTO(data);
}

export async function atualizarUsuarioPerfil(
  usuarioId: string,
  payload: {
    nome: string;
    limite_diario_mg: number;
  }
): Promise<void> {
  const { error } = await supabase
    .from("usuarios")
    .update({
      nome: payload.nome,
      limite_diario_mg: payload.limite_diario_mg,
      updated_at: new Date().toISOString(),
    })
    .eq("id", usuarioId);

  if (error) {
    throw new AppError(
      "USER_PROFILE_UPDATE_ERROR",
      "Erro ao atualizar perfil do usuário",
      error
    );
  }
}

export async function getPerfilUsuarioTimezone(
  usuarioId: string
): Promise<string> {
  const perfil = await getUsuarioPerfil(usuarioId);
  return perfil.timezone;
}
