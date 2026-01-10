import { supabase } from "@/react-app/lib/supabase";
import { AppError } from "@/react-app/lib/errors";

export interface ReferenciaDTO {
  id: string;
  nome: string;
  fenil_mg_por_100g: number;
}

interface GetReferenciasParams {
  usuarioId: string;
  search?: string;
}

export async function getReferencias(
  params: GetReferenciasParams
): Promise<ReferenciaDTO[]> {
  const { usuarioId, search } = params;
  const filter = search ? `%${search}%` : `%`;

  const { data, error } = await supabase
    .from("referencias")
    .select("id, nome, fenil_mg_por_100g")
    .or(`is_global.eq.true,criado_por.eq.${usuarioId}`)
    .ilike("nome", filter)
    .order("nome");

  if (error) {
    throw new AppError(
      "REFERENCIAS_FETCH_ERROR",
      "Erro ao carregar referências",
      error
    );
  }

  return data ?? [];
}

interface CreateReferenciaParams {
  nome: string;
  fenil_mg_por_100g: number;
  usuarioId: string;
}

export async function createReferencia(
  params: CreateReferenciaParams
): Promise<ReferenciaDTO> {
  const { nome, fenil_mg_por_100g, usuarioId } = params;

  const { data, error } = await supabase
    .from("referencias")
    .insert({
      nome,
      fenil_mg_por_100g,
      criado_por: usuarioId,
      is_global: false,
    })
    .select()
    .single();

  if (error || !data) {
    throw new AppError(
      "REFERENCIA_CREATE_ERROR",
      "Erro ao criar referência",
      error
    );
  }

  return data;
}
