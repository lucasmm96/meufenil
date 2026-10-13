import { useNavigate } from "react-router-dom";
import { logout } from "@/react-app/services/auth.service";
import { AppError } from "@/react-app/lib/errors";
import { logger } from "@/react-app/lib/logger";
import { useAuth } from "@/react-app/context/AuthContext";
import { useOffline } from "@/react-app/context/OfflineContext";
import { getPendingCount } from "@/react-app/services/offlineStorage.service";
import { processarFilaSync } from "@/react-app/services/sync.service";

export function useLogout() {
  const navigate = useNavigate();
  const { usuarioAtivoId, authUser } = useAuth();
  const { isOnline } = useOffline();

  const handleLogout = async () => {
    const uid = usuarioAtivoId ?? authUser?.id;

    if (uid) {
      const pending = await getPendingCount(uid).catch(() => 0);

      if (pending > 0) {
        if (isOnline) {
          try {
            await processarFilaSync(uid);
          } catch {
            const ok = confirm(
              `Você possui ${pending} registro(s) não sincronizado(s). Ao sair, esses dados serão perdidos permanentemente. Deseja continuar?`
            );
            if (!ok) return;
          }
        } else {
          const ok = confirm(
            `Você possui ${pending} registro(s) não sincronizado(s). Ao sair, esses dados serão perdidos permanentemente. Deseja continuar?`
          );
          if (!ok) return;
        }
      }
    }

    try {
      await logout();
    } catch (err) {
      const appError =
        err instanceof AppError
          ? err
          : new AppError(
              "AUTH_LOGOUT_UNKNOWN_ERROR",
              "Erro inesperado ao sair",
              err,
            );

      logger.error("Erro no logout", appError);
    } finally {
      navigate("/", { replace: true });
    }
  };

  return { handleLogout };
}
