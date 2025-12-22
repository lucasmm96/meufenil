import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Tipo do usuário da aplicação (tabela public.usuarios)
 * Ajuste os campos se sua tabela tiver mais colunas
 */
type AppUser = {
  id: string;
  role: "admin" | "user";
  email?: string | null;
};

export function useUser() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function carregarUsuario() {
      setLoading(true);

      // 1️⃣ Usuário do Supabase Auth
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      // 2️⃣ Usuário da tabela public.usuarios
      const { data, error } = await supabase
        .from("usuarios")
        .select("id, role, email")
        .eq("id", authUser.id)
        .single();

      if (mounted) {
        if (error) {
          console.error("Erro ao carregar usuário:", error);
          setUser(null);
        } else {
          setUser(data);
        }
        setLoading(false);
      }
    }

    carregarUsuario();

    // 3️⃣ Escuta mudanças de auth (login / logout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        setLoading(false);
      } else {
        carregarUsuario();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}
