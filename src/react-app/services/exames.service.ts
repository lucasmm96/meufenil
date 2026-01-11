import { supabase } from "@/react-app/lib/supabase";
import { AppError } from "@/react-app/lib/errors";
import { ExameDTO } from "@/react-app/services/dtos/exames.dto";

type ExameRow = {
  id: string;
  usuario_id: string;
  data_exame: string;
  resultado_mg_dl: number;
  created_at: string;
}

function mapExameRowToDTO(row: ExameRow): ExameDTO {
  return {
    id: row.id,
    usuario_id: row.usuario_id,
    data_exame: row.data_exame,
    resultado_mg_dl: row.resultado_mg_dl,
    created_at: row.created_at,
  }
}

export async function getExamesPKU(usuarioId: string): Promise<ExameDTO[]> {
  const { data, error } = await supabase
    .from("exames_pku")
    .select("*")
    .eq("usuario_id", usuarioId)
    .order("data_exame", { ascending: false });

  if (error) {
    throw new AppError(
      "EXAMES_FETCH_ERROR",
      "Erro ao carregar exames PKU",
      error,
    );
  }

  return (data ?? []).map(mapExameRowToDTO);
}

export async function createExamePKU(params: {
  usuarioId: string;
  dataExameISO: string;
  resultadoMgDl: number;
}): Promise<void> {
  const { error } = await supabase.from("exames_pku").insert({
    usuario_id: params.usuarioId,
    data_exame: params.dataExameISO,
    resultado_mg_dl: params.resultadoMgDl,
  });

  if (error) {
    throw new AppError(
      "EXAMES_CREATE_ERROR",
      "Erro ao salvar exame PKU",
      error,
    );
  }
}

export async function deleteExamePKU(params: {
  exameId: string;
  usuarioId: string;
}): Promise<void> {
  const { error } = await supabase
    .from("exames_pku")
    .delete()
    .eq("id", params.exameId)
    .eq("usuario_id", params.usuarioId);

  if (error) {
    throw new AppError(
      "EXAMES_DELETE_ERROR",
      "Erro ao excluir exame PKU",
      error,
    );
  }
}
