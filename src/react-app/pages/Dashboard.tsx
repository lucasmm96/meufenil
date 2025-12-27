import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import Layout from "@/react-app/components/Layout";
import ConsentimentoLGPD from "@/react-app/components/ConsentimentoLGPD";
import AdicionarRegistro from "@/react-app/components/AdicionarRegistro";
import CriarAlimento from "@/react-app/components/CriarAlimento";
import { Activity, TrendingUp, AlertCircle, Plus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/react-app/context/AuthContext";

const parseLocalDate = (dateString: string) => {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(y, m - 1, d);
};

interface Usuario {
  id: string;
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
  const navigate = useNavigate();
  const { authUser, loadingAuth } = useAuth();

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [hoje, setHoje] = useState<DashboardHoje | null>(null);
  const [grafico, setGrafico] = useState<GraficoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCriarModal, setShowCriarModal] = useState(false);

  useEffect(() => {
    if (loadingAuth) return;

    if (!authUser) {
      navigate("/", { replace: true });
      return;
    }

    loadDashboard(authUser.id);
  }, [loadingAuth, authUser]);

  const loadDashboard = async (userId: string) => {
    setLoading(true);

    const { data: perfil, error } = await supabase
      .from("usuarios")
      .select("id, limite_diario_mg, consentimento_lgpd_em")
      .eq("id", userId)
      .single();

    if (error || !perfil) {
      console.error(error);
      setLoading(false);
      return;
    }

    const hojeStr = format(new Date(), "yyyy-MM-dd");

    const { data: registrosHoje } = await supabase
      .from("registros")
      .select("fenil_mg")
      .eq("usuario_id", userId)
      .eq("data", hojeStr);

    const totalHoje =
      registrosHoje?.reduce((acc, r) => acc + (r.fenil_mg ?? 0), 0) ?? 0;

    const inicio = format(subDays(new Date(), 6), "yyyy-MM-dd");

    const { data: registrosGrafico } = await supabase
      .from("registros")
      .select("data, fenil_mg")
      .eq("usuario_id", userId)
      .gte("data", inicio);

    const mapa: Record<string, number> = {};

    registrosGrafico?.forEach((r) => {
      mapa[r.data] = (mapa[r.data] ?? 0) + (r.fenil_mg ?? 0);
    });

    const graficoData = Object.keys(mapa)
      .sort()
      .map((data) => ({
        data,
        total: mapa[data],
      }));

    setUsuario(perfil);
    setHoje({
      total: totalHoje,
      limite: perfil.limite_diario_mg,
      data: hojeStr,
    });
    setGrafico(graficoData);
    setLoading(false);
  };

  const handleConsentimento = async () => {
    if (!usuario) return;

    await supabase
      .from("usuarios")
      .update({ consentimento_lgpd_em: new Date().toISOString() })
      .eq("id", usuario.id);

    loadDashboard(usuario.id);
  };

  if (loading || !usuario || !hoje) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
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
          onSuccess={() => loadDashboard(usuario.id)}
        />
      )}

      {showCriarModal && (
        <CriarAlimento
          onClose={() => setShowCriarModal(false)}
          onSuccess={() => setShowCriarModal(false)}
        />
      )}

      <div className="space-y-6">
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

        <div className="grid md:grid-cols-3 gap-6">
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
