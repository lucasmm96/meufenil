import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/react-app/context/AuthContext";

type AppUser = {
  id: string;
  role: "admin" | "user";
  email?: string | null;
};

export function useUser() {
  const { authUser, loadingAuth } = useAuth();

  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function carregarUsuario() {
      if (!authUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from("usuarios")
        .select("id, role, email")
        .eq("id", authUser.id)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        console.error("Erro ao carregar usuário:", error);
        setUser(null);
      } else {
        setUser(data ?? null);
      }

      setLoading(false);
    }

    if (!loadingAuth) {
      carregarUsuario();
    }

    return () => {
      mounted = false;
    };
  }, [authUser, loadingAuth]);

  return { user, loading };
}
