import { useNavigate } from "react-router-dom";
import { useAuth } from "@/react-app/context/AuthContext";

export function useProtectedPage() {
  const navigate = useNavigate();
  const { authUser, loadingAuth } = useAuth();

  if (loadingAuth) {
    return {
      authUser: null,
      isReady: false,
    };
  }

  if (!authUser) {
    navigate("/", { replace: true });
    return {
      authUser: null,
      isReady: false,
    };
  }

  return {
    authUser,
    isReady: true,
  };
}
