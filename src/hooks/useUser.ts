import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type AppUser = {
  id: string;
  role: "admin" | "user";
  email?: string | null;
};

export function useUser(userId?: string) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let mounted = true;

    async function carregarUsuario() {
      setLoading(true);

      const { data, error } = await supabase
        .from("usuarios")
        .select("id, role, email")
        .eq("id", userId)
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

    carregarUsuario();

    return () => {
      mounted = false;
    };
  }, [userId]);

  const signInWithGoogle = async () => {
    return supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
  };

  return { user, loading, signInWithGoogle };
}
