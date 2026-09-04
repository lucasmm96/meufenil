import { supabase } from "@/react-app/lib/supabase";
import { AppError } from "@/react-app/lib/errors";
import {
  extrairMarcaDoNome,
  normalizarMarca,
} from "@/react-app/lib/referencias";

export interface ReferenciaDTO {
  id: string;
  nome: string;
  marca: string;
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
        marca,
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
      // Busca sobre nome E marca (ENH-0004 — a marca deixou de viver dentro
      // do nome; sem isto, buscar "Knorr" ou "in natura" não encontraria nada).
      // Remove aspas do termo: dentro do filtro .or() do PostgREST, valores
      // são embrulhados em aspas duplas para que vírgulas/parênteses digitados
      // não quebrem o parser do filtro.
      const termo = search.replace(/"/g, "").trim();
      if (termo) {
        baseQuery = baseQuery.or(
          `nome.ilike.%${termo}%,marca.ilike.%${termo}%`
        );
      }
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
    let allData: ReferenciaDTO[] = [];

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
  marca?: string;
  fenil_mg_por_100g: number;
  usuarioId: string;
}

export async function createReferencia(
  params: CreateReferenciaParams
): Promise<ReferenciaDTO> {
  const { nome, marca, fenil_mg_por_100g, usuarioId } = params;

  const sanitizado = sanitizarIdentidadeReferencia(nome, marca);

  const { data, error } = await supabase
    .from("referencias")
    .insert({
      nome: sanitizado.nome,
      marca: sanitizado.marca,
      fenil_mg_por_100g,
      criado_por: usuarioId,
      is_global: false,
    })
    .select()
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      throw new AppError(
        "REFERENCIA_DUPLICADA",
        "Já existe uma referência ativa com esse nome e marca."
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
    marca: data.marca,
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

interface UpdateReferenciaParams {
  nome: string;
  marca?: string;
  fenil_mg_por_100g: number;
}

/**
 * Guarda de imutabilidade substantiva (BR-034+, ENH-0004): a identidade
 * (nome, marca, fenil) de referência GLOBAL nunca é alterada por UPDATE —
 * mudança substantiva em global = arquivar a atual + criar a nova. Pessoais
 * seguem editáveis pelo dono (BR-023).
 */
async function assertReferenciaEditavel(referenciaId: string): Promise<void> {
  const { data: atual } = await supabase
    .from("referencias")
    .select("is_global")
    .eq("id", referenciaId)
    .maybeSingle();

  if (atual?.is_global) {
    throw new AppError(
      "REFERENCIA_GLOBAL_IMUTAVEL",
      "Referências globais não podem ser editadas — arquive a atual e crie uma nova com os dados ajustados."
    );
  }
}

export async function updateReferencia(
  referenciaId: string,
  params: UpdateReferenciaParams
): Promise<void> {
  const { nome, marca, fenil_mg_por_100g } = params;

  await assertReferenciaEditavel(referenciaId);

  const sanitizado = sanitizarIdentidadeReferencia(nome, marca);

  const { data, error } = await supabase
    .from("referencias")
    .update({
      nome: sanitizado.nome,
      marca: sanitizado.marca,
      fenil_mg_por_100g,
    })
    .eq("id", referenciaId)
    .select();

  if (error) {
    if (error?.code === "23505") {
      throw new AppError(
        "REFERENCIA_DUPLICADA",
        "Já existe uma referência ativa com esse nome e marca."
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

export async function deleteOrDeactivateReferencia(id: string): Promise<string | null> {
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

  return data;
}

/**
 * Sanitização da identidade nos fluxos de escrita (ENH-0004): remove o
 * sufixo "(Marca: ...)" embutido no nome e o promove à coluna `marca`.
 * Preferência explícita: o campo `marca` do formulário vence sobre a marca
 * extraída do nome (que só vale quando o campo está vazio) — usuários podem
 * colar nomes no formato legado.
 */
function sanitizarIdentidadeReferencia(nome: string, marca?: string) {
  const extraido = extrairMarcaDoNome(nome);
  const marcaDoCampo = marca?.trim();

  return {
    nome: extraido.nome,
    marca: normalizarMarca(marcaDoCampo || extraido.marca),
  };
}

