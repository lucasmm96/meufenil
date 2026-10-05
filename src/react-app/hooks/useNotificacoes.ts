/**
 * useNotificacoes — FEAT-0018
 *
 * Gerencia o estado de notificações do usuário ativo.
 * Suporta login-as: opera sobre usuarioAtivoId quando presente.
 * Subscreve ao Supabase Realtime para atualização instantânea do badge.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/react-app/context/AuthContext";
import {
  listarNotificacoes,
  marcarComoLida as serviceMarcarComoLida,
  marcarTodasComoLidas as serviceMarcarTodasComoLidas,
  subscribirNotificacoes,
} from "@/react-app/services/notificacoes.service";
import { AppError } from "@/react-app/lib/errors";
import { logger } from "@/react-app/lib/logger";
import type { NotificacaoDTO } from "@/react-app/services/dtos/notificacoes.dto";

export function useNotificacoes() {
  const { usuarioAtivoId } = useAuth();
  const [notificacoes, setNotificacoes] = useState<NotificacaoDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  const naoLidas = notificacoes.filter((n) => n.read_at === null).length;

  const load = useCallback(async () => {
    if (!usuarioAtivoId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await listarNotificacoes(usuarioAtivoId);
      setNotificacoes(data);
    } catch (err) {
      const appError =
        err instanceof AppError
          ? err
          : new AppError(
              "NOTIFICACOES_UNKNOWN_ERROR",
              "Erro inesperado ao carregar notificações",
              err
            );
      logger.error("Erro em useNotificacoes", appError);
      setError(appError);
    } finally {
      setLoading(false);
    }
  }, [usuarioAtivoId]);

  // Carga inicial e recarga quando o usuário ativo muda
  useEffect(() => {
    load();
  }, [load]);

  // Subscription Realtime: recarrega a lista quando há mudanças na tabela
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!usuarioAtivoId) return;

    const unsubscribe = subscribirNotificacoes(usuarioAtivoId, () => {
      loadRef.current();
    });

    return unsubscribe;
  }, [usuarioAtivoId]);

  const marcarComoLida = useCallback(
    async (id: string) => {
      try {
        await serviceMarcarComoLida(id);
        // Atualiza otimisticamente sem aguardar reload completo
        setNotificacoes((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, read_at: new Date().toISOString() } : n
          )
        );
      } catch (err) {
        logger.error("Erro ao marcar notificação como lida", err);
      }
    },
    []
  );

  const marcarTodasComoLidas = useCallback(async () => {
    try {
      await serviceMarcarTodasComoLidas();
      // Atualiza otimisticamente
      setNotificacoes((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
      );
    } catch (err) {
      logger.error("Erro ao marcar todas as notificações como lidas", err);
    }
  }, []);

  return {
    notificacoes,
    naoLidas,
    loading,
    error,
    reload: load,
    marcarComoLida,
    marcarTodasComoLidas,
  };
}
