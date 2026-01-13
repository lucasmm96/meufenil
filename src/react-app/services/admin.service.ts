import { supabase } from "@/react-app/lib/supabase";
import { AppError } from "@/react-app/lib/errors";
import {
  UsuarioAdminDTO,
  EstatisticasAdminDTO,
  ResultadoImportacaoDTO,
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

export async function importarReferenciasCSV(
  csvText: string,
): Promise<ResultadoImportacaoDTO> {
  const erros: string[] = [];
  let houveAtualizacoes = false;

  const texto = csvText.replace(/^\uFEFF/, "").trim();
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim());

  if (linhas.length === 0) {
    return { importados: 0, erros: ["CSV vazio"], total: 0, houveAtualizacoes: false };
  }

  const separador = linhas[0].includes(";") ? ";" : ",";
  const inicio = linhas[0].toLowerCase().includes("nome") ? 1 : 0;

  const registros: any[] = [];

  for (let i = inicio; i < linhas.length; i++) {
    const [nomeRaw, fenilRaw] = linhas[i].split(separador);
    const nome = nomeRaw?.trim();
    const fenil = Number(fenilRaw?.replace(",", "."));

    if (!nome || isNaN(fenil) || fenil < 0) {
      erros.push(`Linha ${i + 1}: inválida`);
      continue;
    }

    const nomeNormalizado = nome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

    registros.push({
      nome,
      fenil_mg_por_100g: fenil,
      is_global: true,
      nome_normalizado: nomeNormalizado,
    });
  }

  if (registros.length === 0) {
    return {
      importados: 0,
      erros,
      total: linhas.length - inicio,
      houveAtualizacoes: false,
    };
  }

  const { data: existentes, error: existentesError } = await supabase
    .from("referencias")
    .select("nome_normalizado")
    .in(
      "nome_normalizado",
      registros.map((r) => r.nome_normalizado),
    );

  if (existentesError) {
    throw new AppError(
      "ADMIN_IMPORT_CHECK_ERROR",
      "Erro ao verificar referências existentes",
      existentesError,
    );
  }

  if (existentes && existentes.length > 0) {
    houveAtualizacoes = true;
  }

  const { error: upsertError } = await supabase
    .from("referencias")
    .upsert(registros, { onConflict: "nome_normalizado" });

  if (upsertError) {
    throw new AppError(
      "ADMIN_IMPORT_ERROR",
      "Erro ao importar referências",
      upsertError,
    );
  }

  return {
    importados: registros.length,
    erros,
    total: linhas.length - inicio,
    houveAtualizacoes,
  };
}
