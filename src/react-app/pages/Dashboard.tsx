import { useEffect, useState } from "react";
import { useAuth } from "@getmocha/users-service/react";
import { useNavigate } from "react-router";
import Layout from "@/react-app/components/Layout";
import ConsentimentoLGPD from "@/react-app/components/ConsentimentoLGPD";
import AdicionarRegistro from "@/react-app/components/AdicionarRegistro";
import CriarAlimento from "@/react-app/components/CriarAlimento";
import { Activity, TrendingUp, AlertCircle, Plus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// Função helper para parsear datas sem problema de fuso horário
const parseLocalDate = (dateString: string) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

interface Usuario {
  id: number;
  limite_diario_mg: number;
  consentimento_lgpd_em: string | null;
}

interface DashboardHoje {
  total: number;
  limite: number;
  data: string;
}

interface GraficoData {
  data: string;
  total: number;
}

export default function DashboardPage() {
  const { user, isPending } = useAuth();
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [hoje, setHoje] = useState<DashboardHoje | null>(null);
  const [grafico, setGrafico] = useState<GraficoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCriarModal, setShowCriarModal] = useState(false);

  useEffect(() => {
    if (!isPending && !user) {
      navigate("/");
    }
  }, [user, isPending, navigate]);

  useEffect(() => {
    if (user) {
      loadDashboard();
    }
  }, [user]);

  const loadDashboard = async () => {
    try {
      const [perfilRes, hojeRes, graficoRes] = await Promise.all([
        fetch("/api/usuarios/perfil"),
        fetch("/api/dashboard/hoje"),
        fetch("/api/dashboard/ultimos-dias?dias=7"),
      ]);

      const perfilData = await perfilRes.json();
      const hojeData = await hojeRes.json();
      const graficoData = await graficoRes.json();

      setUsuario(perfilData);
      setHoje(hojeData);
      setGrafico(graficoData);
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConsentimento = async () => {
    try {
      await fetch("/api/usuarios/consentimento-lgpd", { method: "POST" });
      loadDashboard();
    } catch (error) {
      console.error("Erro ao salvar consentimento:", error);
    }
  };

  const handleRegistroAdicionado = () => {
    setShowAddModal(false);
    loadDashboard();
  };

  const handleAlimentoCriado = () => {
    setShowCriarModal(false);
  };

  if (isPending || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user || !usuario || !hoje) {
    return null;
  }

  const percentual = (hoje.total / hoje.limite) * 100;
  const ultrapassou = hoje.total > hoje.limite;

  return (
    <Layout>
      {!usuario.consentimento_lgpd_em && (
        <ConsentimentoLGPD onAccept={handleConsentimento} />
      )}

      {showAddModal && (
        <AdicionarRegistro
          onClose={() => setShowAddModal(false)}
          onSuccess={handleRegistroAdicionado}
        />
      )}

      {showCriarModal && (
        <CriarAlimento
          onClose={() => setShowCriarModal(false)}
          onSuccess={handleAlimentoCriado}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">
              {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowCriarModal(true)}
              className="flex items-center gap-2 bg-white border-2 border-indigo-600 text-indigo-600 px-4 sm:px-6 py-3 rounded-xl font-semibold hover:bg-indigo-50 transition-all"
            >
              <Plus className="w-5 h-5" />
              <span>Criar Alimento</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
            >
              Adicionar Registro
            </button>
          </div>
        </div>

        {/* Cards de Resumo */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Consumo Hoje */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-indigo-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Hoje</span>
            </div>
            <div className="space-y-2">
              <p className="text-3xl font-bold text-gray-900">
                {hoje.total.toFixed(1)} mg
              </p>
              <p className="text-sm text-gray-600">
                de {hoje.limite.toFixed(0)} mg
              </p>
            </div>
          </div>

          {/* Percentual */}
          <div className={`bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg ${
            ultrapassou ? 'ring-2 ring-red-500' : ''
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                ultrapassou ? 'bg-red-100' : 'bg-green-100'
              }`}>
                {ultrapassou ? (
                  <AlertCircle className="w-6 h-6 text-red-600" />
                ) : (
                  <TrendingUp className="w-6 h-6 text-green-600" />
                )}
              </div>
              <span className="text-sm font-medium text-gray-500">Percentual</span>
            </div>
            <div className="space-y-2">
              <p className={`text-3xl font-bold ${
                ultrapassou ? 'text-red-600' : 'text-green-600'
              }`}>
                {percentual.toFixed(1)}%
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    ultrapassou 
                      ? 'bg-gradient-to-r from-red-500 to-red-600' 
                      : 'bg-gradient-to-r from-green-500 to-green-600'
                  }`}
                  style={{ width: `${Math.min(percentual, 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Limite */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Restante</span>
            </div>
            <div className="space-y-2">
              <p className="text-3xl font-bold text-gray-900">
                {Math.max(0, hoje.limite - hoje.total).toFixed(1)} mg
              </p>
              <p className="text-sm text-gray-600">
                disponível hoje
              </p>
            </div>
          </div>
        </div>

        {/* Gráfico */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            Últimos 7 dias
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={grafico}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="data" 
                  stroke="#6b7280"
                  tickFormatter={(value) => format(parseLocalDate(value), "dd/MM", { locale: ptBR })}
                />
                <YAxis stroke="#6b7280" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    border: "none",
                    borderRadius: "12px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  }}
                  labelFormatter={(value) => 
                    format(parseLocalDate(value), "dd 'de' MMMM", { locale: ptBR })
                  }
                  formatter={(value: number) => [`${value.toFixed(1)} mg`, "Fenilalanina"]}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="url(#colorGradient)"
                  strokeWidth={3}
                  dot={{ fill: "#6366f1", r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <defs>
                  <linearGradient id="colorGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#9333ea" />
                  </linearGradient>
                </defs>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {ultrapassou && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900">Limite ultrapassado</h3>
                <p className="text-sm text-red-700 mt-1">
                  Você ultrapassou seu limite diário de fenilalanina em {(hoje.total - hoje.limite).toFixed(1)} mg.
                  Considere ajustar suas próximas refeições.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
