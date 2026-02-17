import { useCallback, useEffect, useState, useMemo } from "react";
import {
  getReferencias,
  createReferencia,
  updateReferencia,
  activateReferencia,
  deleteOrDeactivateReferencia,
  toggleFavoritoReferencia as toggleFavoritoReferenciaService,
  ReferenciaDTO,
} from "@/react-app/services/referencias.service";
import { AppError } from "@/react-app/lib/errors";
import { logger } from "@/react-app/lib/logger";

interface UseReferenciasOptions {
  defaultOrder?: "nome" | "nome_desc" | "fenil" | "fenil_desc";
}

export function useReferencias(usuarioId?: string, options?: UseReferenciasOptions) {
  const [data, setData] = useState<ReferenciaDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [ordenarPor, setOrdenarPor] = useState<"nome" | "nome_desc" | "fenil" | "fenil_desc">(options?.defaultOrder ?? "nome");
  const [searchTerm, setSearchTerm] = useState("");
  const [showInativas, setShowInativas] = useState(false);
  const [onlyFavoritas, setOnlyFavoritas] = useState(false);
  const [onlyCustomizadas, setOnlyCustomizadas] = useState(false);

  const load = useCallback(async () => {
    if (!usuarioId) return;

    setLoading(true);
    setError(null);

    try {
      const refs = await getReferencias({
        usuarioId,
        search: searchTerm,
        orderBy: ordenarPor,
        showInativas,
        onlyFavoritas,
        onlyCustomizadas,
      });

      setData(refs);
    } catch (err) {
      const appError =
        err instanceof AppError
          ? err
          : new AppError("UNKNOWN_ERROR", "Erro inesperado", err);

      setError(appError);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [usuarioId, searchTerm, ordenarPor, showInativas, onlyFavoritas, onlyCustomizadas]);


  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(
    async (nome: string, fenil: number) => {
      if (!usuarioId) {
        throw new AppError(
          "USER_NOT_FOUND",
          "Usuário não identificado"
        );
      }

      try {
        const ref = await createReferencia({
          nome,
          fenil_mg_por_100g: fenil,
          usuarioId,
        });

        await load();
        return ref;
      } catch (err) {
        const appError = err instanceof AppError ? err : new AppError("UNKNOWN_ERROR", "Erro inesperado", err);
        setError(appError);
        logger.error("Erro ao criar referência", appError);
        throw appError;
      }
    },
    [usuarioId, load]
  );

  const update = useCallback(
    async (id: string, nome: string, fenil: number) => {
      await updateReferencia(id, nome, fenil);
      await load();
    },
    [load]
  );

  const activate = useCallback(
    async (id: string) => {
      await activateReferencia(id);
      await load();
    },
    [load]
  );

  const deactivate = useCallback(
    async (id: string) => {
      await deleteOrDeactivateReferencia(id);
      await load();
    },
    [load]
  );


  const remove = useCallback(
    async (id: string) => {
      await deleteOrDeactivateReferencia(id);
      await load();
    },
    [load]
  );

  const toggleFavoritoReferencia = useCallback(
    async (referenciaId: string) => {
      if (!usuarioId) {
        throw new AppError(
          "USER_NOT_FOUND",
          "Usuário não identificado"
        );
      }

      const previousData = data;

      setData((current) => {
        const atualizado = current.map((r) =>
          r.id === referenciaId
            ? { ...r, is_favorita: !r.is_favorita }
            : r
        );

        // 🔥 REORDENA AQUI (favoritos primeiro)
        return atualizado.sort((a, b) => {
          if (a.is_favorita !== b.is_favorita) {
            return a.is_favorita ? -1 : 1;
          }
          return 0;
        });
      });

      try {
        await toggleFavoritoReferenciaService(referenciaId, usuarioId);
      } catch (err) {
        setData(previousData);

        const appError =
          err instanceof AppError
            ? err
            : new AppError(
              "REFERENCIA_FAVORITO_ERROR",
              "Erro ao alterar favorito",
              err
            );

        setError(appError);
        logger.error("Erro ao alternar favorito", appError);
        throw appError;
      }
    },
    [usuarioId, data]
  );


  const search = useCallback((
    term: string,
    filters?: {
      showInativas?: boolean;
      onlyFavoritas?: boolean;
      onlyCustomizadas?: boolean;
    }
  ) => {
    setSearchTerm(term);
    setShowInativas(filters?.showInativas ?? false);
    setOnlyFavoritas(filters?.onlyFavoritas ?? false);
    setOnlyCustomizadas(filters?.onlyCustomizadas ?? false);
  }, []);

  return {
    data,
    loading,
    error,
    search,
    create,
    update,
    activate,
    deactivate,
    remove,
    ordenarPor,
    setOrdenarPor,
    toggleFavoritoReferencia,
    searchTerm,
    showInativas,
    onlyFavoritas,
    onlyCustomizadas,
  };

}
