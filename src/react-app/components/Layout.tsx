import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/react-app/context/AuthContext";

import {
  LayoutDashboard,
  History,
  BarChart3,
  User,
  LogOut,
  Shield,
  Heart,
  Linkedin,
  Mail,
  Stethoscope,
  Info,
  Vegan,
} from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

interface Perfil {
  role: string;
  nome?: string;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const { authUser, loadingAuth } = useAuth();

  const [perfil, setPerfil] = useState<Perfil | null>(null);

  useEffect(() => {
    if (!authUser) return;

    supabase
      .from("usuarios")
      .select("role, nome")
      .eq("id", authUser.id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setPerfil(data);
        }
      });
  }, [authUser]);

  async function handleLogout() {
    await supabase.auth.signOut().catch(() => { });
    navigate("/", { replace: true });
  }

  const isActive = (path: string) => location.pathname === path;
  const isAdmin = perfil?.role === "admin";

  const navItems = [
    { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/historico", icon: History, label: "Histórico" },
    { path: "/estatisticas", icon: BarChart3, label: "Estatísticas" },
    { path: "/exames", icon: Stethoscope, label: "Exames PKU" },
    { path: "/sobre", icon: Info, label: "Sobre" },
    ...(isAdmin ? [{ path: "/admin", icon: Shield, label: "Admin" }] : []),
  ];

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-12 w-12 rounded-full border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/dashboard" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                <Vegan className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                MeuFenil
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <Link to="/perfil" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-gray-600 hover:text-indigo-600 rounded-lg transition-colors">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Perfil</span>
              </Link>
              <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">Sair</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white/60 backdrop-blur-md border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${active
                    ? "text-indigo-600 border-b-2 border-indigo-600"
                    : "text-gray-600 hover:text-gray-900"
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white/60 backdrop-blur-md border-t border-gray-200/50 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-1.5 text-gray-700 text-center">
              <span className="text-xs sm:text-sm">Feito com</span>
              <Heart className="w-4 h-4 text-red-500 fill-red-500 animate-pulse" />
              <span className="text-xs sm:text-sm">
                para pacientes fenil do Brasil
              </span>
            </div>

            <div className="flex items-center gap-6">
              <a
                href="https://www.linkedin.com/in/lucas-martins-menezes/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-600 hover:text-indigo-600"
              >
                <Linkedin className="w-5 h-5" />
                <span className="text-sm hidden sm:inline">LinkedIn</span>
              </a>

              <a
                href="mailto:lucasmartinsmenezes@gmail.com"
                className="flex items-center gap-2 text-gray-600 hover:text-indigo-600"
              >
                <Mail className="w-5 h-5" />
                <span className="text-sm hidden sm:inline">Email</span>
              </a>
            </div>

            <p className="text-xs text-gray-500">
              © {new Date().getFullYear()} MeuFenil. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
