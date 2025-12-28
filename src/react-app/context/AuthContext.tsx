import { createContext, useContext, useEffect, useRef, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type AuthContextType = {
  authUser: User | null;
  loadingAuth: boolean;
  timezone: string;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [timezone, setTimezone] = useState<string>("UTC");
  const [loadingAuth, setLoadingAuth] = useState(true);
  const initializedRef = useRef(false);

  const loadUserExtras = async (userId: string) => {
    const { data, error } = await supabase
      .from("usuarios")
      .select("timezone")
      .eq("id", userId)
      .single();

    if (!error && data?.timezone) {
      setTimezone(data.timezone);
    } else {
      setTimezone("UTC");
    }
  };

  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      const user = session?.user ?? null;

      // 🚨 Proteção absoluta contra reexecução
      if (event === "INITIAL_SESSION") {
        if (initializedRef.current) return;
        initializedRef.current = true;

        setAuthUser(user);

        if (user) {
          await loadUserExtras(user.id);
        } else {
          setTimezone("UTC");
        }

        setLoadingAuth(false);
        return;
      }

      // LOGIN
      if (event === "SIGNED_IN") {
        setAuthUser(user);
        if (user) {
          await loadUserExtras(user.id);
        }
        return;
      }

      // LOGOUT
      if (event === "SIGNED_OUT") {
        setAuthUser(null);
        setTimezone("UTC");
        return;
      }

      // 🔕 TOKEN_REFRESHED, USER_UPDATED, etc → IGNORAR
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        authUser,
        loadingAuth,
        timezone,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return ctx;
}
