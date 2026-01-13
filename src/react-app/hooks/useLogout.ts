import { useNavigate } from "react-router-dom";
import { logout } from "@/react-app/services/auth.service";
import { AppError } from "@/react-app/lib/errors";
import { logger } from "@/react-app/lib/logger";

export function useLogout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
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
