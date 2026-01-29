import { useAuth } from "@/react-app/context/AuthContext";

export function useUsuarioAtivo() {
  const {
    authUser,
    loadingAuth,
    ready,
    usuarioAtivoId,
    isDelegado,
    owner,
  } = useAuth();

  if (loadingAuth || !ready) {
    return {
      ready: false,
      authUserId: null,
      usuarioAtivoId: null,
      isDelegado: false,
      owner: null,
    };
  }

  if (!authUser) {
    return {
      ready: false,
      authUserId: null,
      usuarioAtivoId: null,
      isDelegado: false,
      owner: null,
    };
  }

  return {
    ready: true,
    authUserId: authUser.id,
    usuarioAtivoId,
    isDelegado,
    owner: owner ?? {
      id: authUser.id,
      nome: authUser.user_metadata?.full_name ?? null,
      email: authUser.email ?? null,
    },
  };
}
