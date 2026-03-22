import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Activity, Vegan, BarChart3, FileText, Shield, Heart, Linkedin, Mail } from "lucide-react";
import { useAuth } from "@/react-app/context/AuthContext";
import { useUser } from "@/react-app/hooks/useUser";

export default function HomePage() {
  const navigate = useNavigate();
  const { authUser, loadingAuth } = useAuth();
  const { signInWithGoogle } = useUser();

  useEffect(() => {
    if (!loadingAuth && authUser) navigate("/dashboard", { replace: true });
  }, [authUser, loadingAuth, navigate]);

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (authUser) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-6xl mx-auto px-4 py-10 sm:py-14 md:py-16 space-y-10">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 mx-auto">
            <img
              src="/icons/logo.png"
              alt="MeuFenil"
              className="w-full h-full object-cover"
              style={{ display: "block" }}
            />
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900">
            MeuFenil
          </h1>

          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
            Controle diário de consumo de fenilalanina para pessoas com PKU
          </p>

          <div className="pt-2">
            <button
              onClick={signInWithGoogle}
              className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-3 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
            >
              Entrar com Google
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          <Feature
            icon={<Activity className="w-6 h-6 text-indigo-600" />}
            title="Controle Diário"
            text="Registre seus alimentos e monitore o consumo de fenilalanina em tempo real"
          />
          <Feature
            icon={<BarChart3 className="w-6 h-6 text-purple-600" />}
            title="Estatísticas"
            text="Visualize gráficos e relatórios detalhados do seu histórico"
          />
          <Feature
            icon={<FileText className="w-6 h-6 text-pink-600" />}
            title="Exportação"
            text="Exporte seus dados em CSV ou JSON"
          />
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 sm:p-8 shadow-lg max-w-2xl mx-auto w-full">
          <div className="flex gap-4">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-green-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">
                Seus dados estão seguros
              </h3>
              <p className="text-gray-600 text-sm">
                O MeuFenil está em conformidade com a LGPD. Você tem controle total
                sobre seus dados, podendo exportá-los ou excluí-los quando quiser.
              </p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 sm:p-8 shadow-lg w-full flex flex-col gap-4">
      <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
        {icon}
      </div>
      <div className="space-y-2">
        <h3 className="text-lg sm:text-xl font-semibold">{title}</h3>
        <p className="text-gray-600 text-sm sm:text-base">{text}</p>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="bg-white/60 border-t mt-10 sm:mt-16">
      <div className="max-w-7xl mx-auto px-4 py-8 text-center space-y-4">
        <div className="flex justify-center items-center gap-2 text-gray-700 text-sm sm:text-base">
          <span>Feito com</span>
          <Heart className="w-4 h-4 text-red-500 fill-red-500 animate-pulse" />
          <span>para pacientes fenil</span>
        </div>

        <div className="flex justify-center gap-6">
          <a
            href="https://www.linkedin.com/in/lucas-martins-menezes/"
            target="_blank"
            className="text-gray-600 hover:text-indigo-600"
          >
            <Linkedin className="w-5 h-5" />
          </a>

          <a
            href="mailto:lucasmartinsmenezes@gmail.com"
            className="text-gray-600 hover:text-indigo-600"
          >
            <Mail className="w-5 h-5" />
          </a>
        </div>

        <p className="text-xs text-gray-500">
          © {new Date().getFullYear()} MeuFenil
        </p>
      </div>
    </footer>
  );
}