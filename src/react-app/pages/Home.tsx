import { useNavigate } from "react-router";
import { Activity, Vegan, BarChart3, FileText, Shield, Heart, Linkedin, Mail } from "lucide-react";
import { useAuth } from "@/react-app/context/AuthContext";
import { useUser } from "@/react-app/hooks/useUser";

export default function HomePage() {
  const navigate = useNavigate();
  const { authUser, loadingAuth } = useAuth();
  const { signInWithGoogle } = useUser();

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (authUser) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-6 shadow-lg">
            <Vegan className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            MeuFenil
          </h1>

          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Controle diário de consumo de fenilalanina para pessoas com PKU
          </p>

          <button
            onClick={signInWithGoogle}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
          >
            Entrar com Google
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
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

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg max-w-2xl mx-auto">
          <div className="flex gap-4">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">
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
    <div className="bg-white/80 rounded-2xl p-8 shadow-lg">
      <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{text}</p>
    </div>
  );
}

function Footer() {
  return (
    <footer className="bg-white/60 border-t mt-16">
      <div className="max-w-7xl mx-auto py-8 text-center space-y-4">
        <div className="flex justify-center items-center gap-2 text-gray-700">
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
