import { supabase } from "@/react-app/lib/supabase";
import { AppError } from "@/react-app/lib/errors";

export interface RegistroDTO {
  id: string;
  data: string;
  peso_g: number;
  fenil_mg: number;
  created_at: string;
  nome_alimento: string;
}

interface CreateRegistroParams {
  usuarioId: string;
  referenciaId: string;
  data: string;
  peso_g: number;
  fenil_mg: number;
}

export async function createRegistro(
  params: CreateRegistroParams
): Promise<void> {
  const { usuarioId, referenciaId, data, peso_g, fenil_mg } = params;

  const { error } = await supabase.from("registros").insert({
    usuario_id: usuarioId,
    referencia_id: referenciaId,
    data,
    peso_g,
    fenil_mg,
  });

  if (error) {
    throw new AppError(
      "REGISTRO_CREATE_ERROR",
      "Erro ao criar registro",
      error
    );
  }
}

export async function getRegistros(
  usuarioId: string,
  dataInicio?: string,
  dataFim?: string
): Promise<RegistroDTO[]> {
  let query = supabase
    .from("registros")
    .select(`
      id,
      data,
      peso_g,
      fenil_mg,
      created_at,
      referencias!inner ( nome )
    `)
    .eq("usuario_id", usuarioId)
    .order("data", { ascending: false });

  if (dataInicio) query = query.gte("data", dataInicio);
  if (dataFim) query = query.lte("data", dataFim);

  const { data, error } = await query;

  if (error) {
    throw new AppError(
      "REGISTRO_LIST_ERROR",
      "Erro ao buscar registros",
      error
    );
  }

  return (data ?? []).map((r: any) => {
    const referencia = Array.isArray(r.referencias)
      ? r.referencias[0]
      : r.referencias;

    return {
      id: r.id,
      data: r.data,
      peso_g: r.peso_g,
      fenil_mg: r.fenil_mg,
      created_at: r.created_at,
      nome_alimento: referencia?.nome ?? "Alimento removido",
    };
  });
}

export async function deleteRegistro(registroId: string): Promise<void> {
  const { error } = await supabase
    .from("registros")
    .delete()
    .eq("id", registroId);

  if (error) {
    throw new AppError(
      "REGISTRO_DELETE_ERROR",
      "Erro ao excluir registro",
      error
    );
  }
}

