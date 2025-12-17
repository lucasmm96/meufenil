import { useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { Activity, Vegan, BarChart3, FileText, Shield, Heart, Linkedin, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";


export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
    });

    if (error) {
      console.error("Erro no login:", error.message);
    }
  };

  const navigate = useNavigate();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        navigate("/dashboard", { replace: true });
      }
    };

    checkSession();
  }, [navigate]);


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="max-w-6xl mx-auto px-4 py-16">
        {/* Hero Section */}
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
          {/* <button
            onClick={redirectToLogin}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
          >
            Entrar com Google
          </button> */}
          <button
            onClick={loginWithGoogle}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
          >
            Entrar com Google
          </button>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
              <Activity className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Controle Diário
            </h3>
            <p className="text-gray-600">
              Registre seus alimentos e monitore o consumo de fenilalanina em tempo real
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
              <BarChart3 className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Estatísticas
            </h3>
            <p className="text-gray-600">
              Visualize gráficos e relatórios detalhados do seu histórico
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center mb-4">
              <FileText className="w-6 h-6 text-pink-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Exportação
            </h3>
            <p className="text-gray-600">
              Exporte seus dados em CSV ou JSON para compartilhar com profissionais
            </p>
          </div>
        </div>

        {/* LGPD Notice */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg max-w-2xl mx-auto">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Seus dados estão seguros
              </h3>
              <p className="text-gray-600 text-sm">
                O MeuFenil está em conformidade com a LGPD. Você tem total controle sobre seus dados,
                podendo exportá-los ou excluí-los a qualquer momento. Suas informações são criptografadas
                e nunca compartilhadas com terceiros.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white/60 backdrop-blur-md border-t border-gray-200/50 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col items-center gap-4">
            <div className="flex flex-wrap items-center justify-center gap-1.5 text-gray-700 text-center px-4">
              <span className="text-xs sm:text-sm">Feito com</span>
              <Heart className="w-4 h-4 text-red-500 fill-red-500 animate-pulse flex-shrink-0" />
              <span className="text-xs sm:text-sm">para todos os pacientes fenil do Brasil</span>
            </div>
            
            <div className="flex items-center gap-6">
              <a
                href="https://www.linkedin.com/in/lucas-martins-menezes/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors"
              >
                <Linkedin className="w-5 h-5" />
                <span className="text-sm hidden sm:inline">LinkedIn</span>
              </a>
              
              <a
                href="mailto:lucasmartinsmenezes@gmail.com"
                className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 transition-colors"
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
