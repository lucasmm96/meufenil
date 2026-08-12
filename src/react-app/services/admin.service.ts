import { supabase } from "@/react-app/lib/supabase";
import { AppError } from "@/react-app/lib/errors";
import {
  UsuarioAdminDTO,
  EstatisticasAdminDTO,
} from "./dtos/admin.dto";

type EstatisticasAdminRPC = {
  tamanho_db_mb: number;
  registros_totais: number;
  referencias_total: number;
  referencias_globais: number;
  referencias_personalizadas: number;
};

const LIMITE_MB = 500;

export async function getPerfilAdmin(usuarioId: string): Promise<UsuarioAdminDTO> {
  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .eq("id", usuarioId)
    .single();

  if (error || !data) {
    throw new AppError(
      "ADMIN_PROFILE_ERROR",
      "Erro ao carregar perfil do usuário",
      error,
    );
  }

  return data;
}

export async function getUsuariosAdmin(): Promise<UsuarioAdminDTO[]> {
  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) {
    throw new AppError(
      "ADMIN_USERS_ERROR",
      "Erro ao carregar usuários",
      error,
    );
  }

  return data;
}

export async function toggleRoleUsuario(
  usuarioId: string,
  novoRole: "admin" | "user",
): Promise<void> {
  const { error } = await supabase
    .from("usuarios")
    .update({ role: novoRole })
    .eq("id", usuarioId);

  if (error) {
    throw new AppError(
      "ADMIN_TOGGLE_ROLE_ERROR",
      "Erro ao alterar papel do usuário",
      error,
    );
  }
}

export async function getEstatisticasAdmin(
  totalUsuarios: number,
): Promise<EstatisticasAdminDTO> {
  const { data, error } = await supabase
    .rpc("get_estatisticas_admin")
    .single<EstatisticasAdminRPC>();

  if (error || !data) {
    throw new AppError(
      "ADMIN_STATS_ERROR",
      "Erro ao carregar estatísticas do sistema",
      error,
    );
  }

  const percentual = Math.min((data.tamanho_db_mb / LIMITE_MB) * 100, 100);

  return {
    usuarios: totalUsuarios,
    registros: data.registros_totais,
    referencias: {
      total: data.referencias_total,
      globais: data.referencias_globais,
      personalizadas: data.referencias_personalizadas,
    },
    armazenamento: {
      estimado_mb: data.tamanho_db_mb,
      limite_gratuito_mb: LIMITE_MB,
      percentual_usado: percentual,
    },
  };
}
