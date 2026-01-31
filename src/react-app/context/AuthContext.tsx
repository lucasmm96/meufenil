import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/react-app/lib/supabase";
import { User } from "@supabase/supabase-js";

import {
  listarDelegacoes,
  concederAcesso,
  revogarAcesso,
  assumirPerfil,
  sairDoPerfilAssumido,
} from "@/react-app/services/delegacoesAcesso.service";

const SESSION_KEY = "meufenil:login-as";

type LoginAsSession = {
  delegacaoId: string;
  usuarioAssumidoId: string;
  owner: {
    id: string;
    nome: string | null;
    email?: string | null;
  };
};

interface AuthContextType {
  authUser: User | null;
  loadingAuth: boolean;
  ready: boolean;

  usuarioAtivoId: string | null;
  isDelegado: boolean;
  owner: LoginAsSession["owner"] | null;

  concedidos: any[];
  recebidos: any[];

  carregarDelegacoes: () => Promise<void>;
  conceder: (email: string) => Promise<void>;
  revogar: (delegacaoId: string) => Promise<void>;
  assumir: (delegacaoId: string) => Promise<void>;
  sairDoPerfilAssumido: () => Promise<void>;

  timezone: string;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [loginAs, setLoginAs] = useState<LoginAsSession | null>(null);

  const [concedidos, setConcedidos] = useState<any[]>([]);
  const [recebidos, setRecebidos] = useState<any[]>([]);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  /* =========================
   * Auth bootstrap
   * ========================= */
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      setAuthUser(data.session?.user ?? null);
      setLoadingAuth(false);
    }

    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        setAuthUser(session?.user ?? null);
        setLoadingAuth(false);
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  /* =========================
   * login-as bootstrap
   * ========================= */
  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;

    try {
      setLoginAs(JSON.parse(raw));
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }, []);

  const usuarioAtivoId = loginAs?.usuarioAssumidoId ?? authUser?.id ?? null;
  const ready = !loadingAuth && !!authUser;

  /* =========================
   * Delegações
   * ========================= */
  const carregarDelegacoes = useCallback(async () => {
    if (!usuarioAtivoId) return;

    const data = await listarDelegacoes(usuarioAtivoId);
    setConcedidos(data.concedidos);
    setRecebidos(data.recebidos);
  }, [usuarioAtivoId]);

  useEffect(() => {
    if (ready && usuarioAtivoId) {
      carregarDelegacoes();
    }
  }, [ready, usuarioAtivoId, carregarDelegacoes]);

  const conceder = useCallback(async (email: string) => {
    await concederAcesso(email);
    await carregarDelegacoes();
  }, [carregarDelegacoes]);

  const revogar = useCallback(async (delegacaoId: string) => {
    await revogarAcesso(delegacaoId);
    await carregarDelegacoes();
  }, [carregarDelegacoes]);

  const assumir = useCallback(async (delegacaoId: string) => {
    const data = await assumirPerfil(delegacaoId);

    const session: LoginAsSession = {
      delegacaoId,
      usuarioAssumidoId: data.usuario_assumido_id,
      owner: {
        id: data.owner.id,
        nome: data.owner.nome,
        email: data.owner.email,
      },
    };

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setLoginAs(session);
  }, []);

  const sair = useCallback(async () => {
    await sairDoPerfilAssumido();
    sessionStorage.removeItem(SESSION_KEY);
    setLoginAs(null);
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    sessionStorage.removeItem(SESSION_KEY);
    setLoginAs(null);
    setAuthUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        authUser,
        loadingAuth,
        ready,

        usuarioAtivoId,
        isDelegado: !!loginAs,
        owner: loginAs?.owner ?? null,

        concedidos,
        recebidos,

        carregarDelegacoes,
        conceder,
        revogar,
        assumir,
        sairDoPerfilAssumido: sair,

        timezone,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
