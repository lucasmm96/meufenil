import { supabase } from "@/react-app/lib/supabase";
import { AppError } from "@/react-app/lib/errors";

export interface ReferenciaDTO {
  id: string;
  nome: string;
  fenil_mg_por_100g: number;
  is_global?: boolean;
  is_ativa?: boolean;
  is_favorita?: boolean;
  criado_por?: string;
}

interface GetReferenciasParams {
  usuarioId: string;
  search?: string;
  orderBy?: "nome" | "nome_desc" | "fenil" | "fenil_desc";
  showInativas?: boolean;
  onlyFavoritas?: boolean;
  onlyCustomizadas?: boolean;
}

export async function getReferencias(
  params: GetReferenciasParams
): Promise<ReferenciaDTO[]> {
  const {
    usuarioId,
    search,
    orderBy = "nome",
    showInativas = false,
    onlyFavoritas = false,
    onlyCustomizadas = false,
  } = params;

  try {
    const { data: favoritos, error: favError } = await supabase
      .from("referencias_favoritas")
      .select("referencia_id")
      .eq("usuario_id", usuarioId);

    if (favError) throw favError;

    const favoritosIds = (favoritos ?? []).map(f => f.referencia_id);
    const favoritosSet = new Set(favoritosIds);

    let baseQuery = supabase
      .from("referencias")
      .select(`
        id,
        nome,
        fenil_mg_por_100g,
        is_global,
        is_ativa,
        criado_por
      `);

    if (onlyFavoritas) {
      if (favoritosIds.length === 0) return [];
      baseQuery = baseQuery.in("id", favoritosIds);
    } else {
      baseQuery = baseQuery.or(`is_global.eq.true,criado_por.eq.${usuarioId}`);
    }

    if (onlyCustomizadas) {
      baseQuery = baseQuery.eq("is_global", false);
    }

    if (search?.trim()) {
      baseQuery = baseQuery.ilike("nome", `%${search}%`);
    }

    if (!showInativas) {
      baseQuery = baseQuery.eq("is_ativa", true);
    }

    switch (orderBy) {
      case "nome_desc":
        baseQuery = baseQuery.order("nome", { ascending: false });
        break;
      case "fenil":
        baseQuery = baseQuery.order("fenil_mg_por_100g", { ascending: true });
        break;
      case "fenil_desc":
        baseQuery = baseQuery.order("fenil_mg_por_100g", { ascending: false });
        break;
      default:
        baseQuery = baseQuery.order("nome", { ascending: true });
    }

    const PAGE_SIZE = 1000;
    let from = 0;
    let allData: any[] = [];

    while (true) {
      const { data, error } = await baseQuery.range(from, from + PAGE_SIZE - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allData = [...allData, ...data];

      if (data.length < PAGE_SIZE) break;

      from += PAGE_SIZE;
    }

    if (!allData.length) return [];

    let result = allData.map(r => ({
      ...r,
      is_favorita: favoritosSet.has(r.id),
    }));

    if (!onlyFavoritas) {
      result = result.sort((a, b) => {
        if (a.is_favorita !== b.is_favorita) {
          return a.is_favorita ? -1 : 1;
        }
        return 0;
      });
    }

    return result;

  } catch (err) {
    throw new AppError(
      "REFERENCIAS_FETCH_ERROR",
      "Erro ao carregar referências",
      err
    );
  }
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
    if ((error as any)?.code === "23505") {
      throw new AppError(
        "REFERENCIA_DUPLICADA",
        "Já existe uma referência com esse nome."
      );
    }

    throw new AppError(
      "REFERENCIA_CREATE_ERROR",
      "Erro ao criar referência",
      error
    );
  }

  return {
    id: data.id,
    nome: data.nome,
    fenil_mg_por_100g: data.fenil_mg_por_100g,
    is_global: data.is_global,
    criado_por: data.criado_por,
    is_favorita: false,
    is_ativa: true,
  };
}

export async function toggleFavoritoReferencia(referenciaId: string, usuarioId: string): Promise<void> {
  try {
    const { data: exists, error: checkError } = await supabase
      .from("referencias_favoritas")
      .select("*")
      .eq("referencia_id", referenciaId)
      .eq("usuario_id", usuarioId)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") throw checkError;

    if (exists) {
      const { error } = await supabase
        .from("referencias_favoritas")
        .delete()
        .eq("referencia_id", referenciaId)
        .eq("usuario_id", usuarioId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("referencias_favoritas")
        .insert({ referencia_id: referenciaId, usuario_id: usuarioId });
      if (error) throw error;
    }
  } catch (err) {
    throw new AppError(
      "REFERENCIA_FAVORITO_ERROR",
      "Erro ao alterar favorito da referência",
      err
    );
  }
}

export async function updateReferencia(referenciaId: string, nome: string, fenil_mg_por_100g: number): Promise<void> {
  const { data, error } = await supabase
    .from("referencias")
    .update({ nome, fenil_mg_por_100g })
    .eq("id", referenciaId)
    .select();

  if (error) {
    if ((error as any)?.code === "23505") {
      throw new AppError(
        "REFERENCIA_DUPLICADA",
        "Já existe uma referência com esse nome."
      );
    }

    throw new AppError(
      "REFERENCIA_UPDATE_ERROR",
      "Erro ao atualizar referência",
      error
    );
  }

  if (!data || data.length === 0) {
    throw new AppError(
      "REFERENCIA_UPDATE_NOT_ALLOWED",
      "Você não tem permissão para editar esta referência."
    );
  }
}

export async function activateReferencia(id: string) {
  const { data, error } = await supabase.rpc(
    "ativar_referencia",
    { p_referencia_id: id }
  );

  if (error) {
    throw new AppError(
      "REFERENCIA_ACTIVATE_ERROR",
      "Erro ao ativar referência",
      error
    );
  }

  return data;
}

export async function deleteOrDeactivateReferencia(id: string) {
  const { data, error } = await supabase.rpc(
    "remover_ou_desativar_referencia",
    { p_referencia_id: id }
  );


  if (error) {
    throw new AppError(
      "REFERENCIA_DELETE_OR_DEACTIVATE_ERROR",
      "Erro ao remover ou desativar referência",
      error
    );
  }
}

