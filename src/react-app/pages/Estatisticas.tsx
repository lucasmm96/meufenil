import { useEffect, useState } from "react";
import { useAuth } from "@getmocha/users-service/react";
import { useNavigate } from "react-router";
import Layout from "@/react-app/components/Layout";
import { Download, TrendingUp, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

// Função helper para parsear datas sem problema de fuso horário
const parseLocalDate = (dateString: string) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

interface Registro {
  data: string;
  fenil_mg: number;
}

export default function EstatisticasPage() {
  const { user, isPending } = useAuth();
  const navigate = useNavigate();
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [periodo, setPeriodo] = useState<"semana" | "mes">("semana");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isPending && !user) {
      navigate("/");
    }
  }, [user, isPending, navigate]);

  useEffect(() => {
    if (user) {
      loadEstatisticas();
    }
  }, [user, periodo]);

  const loadEstatisticas = async () => {
    setLoading(true);
    try {
      const dias = periodo === "semana" ? 7 : 30;
      const res = await fetch(`/api/dashboard/ultimos-dias?dias=${dias}`);
      const data = await res.json();
      setRegistros(data);
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: "csv" | "json") => {
    try {
      const hoje = new Date();
      const inicio = subDays(hoje, periodo === "semana" ? 7 : 30);
      
      const url = `/api/exportar/${format}?data_inicio=${inicio.toISOString().split('T')[0]}&data_fim=${hoje.toISOString().split('T')[0]}`;
      
      const res = await fetch(url);
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `meufenil-${format}-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Erro ao exportar:", error);
    }
  };

  if (isPending || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const totalConsumo = registros.reduce((sum, r) => sum + (r.total || 0), 0);
  const mediaConsumo = registros.length > 0 ? totalConsumo / registros.length : 0;
  const maiorConsumo = Math.max(...registros.map(r => r.total || 0), 0);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Estatísticas</h1>
            <p className="text-gray-600 mt-1">Análise detalhada do seu consumo</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleExport("csv")}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
            <button
              onClick={() => handleExport("json")}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              JSON
            </button>
          </div>
        </div>

        {/* Seletor de Período */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg">
          <div className="flex gap-2">
            <button
              onClick={() => setPeriodo("semana")}
              className={`flex-1 px-4 py-2 rounded-xl font-semibold transition-colors ${
                periodo === "semana"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Última Semana
            </button>
            <button
              onClick={() => setPeriodo("mes")}
              className={`flex-1 px-4 py-2 rounded-xl font-semibold transition-colors ${
                periodo === "mes"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Último Mês
            </button>
          </div>
        </div>

        {/* Cards de Resumo */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Total</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {totalConsumo.toFixed(1)} mg
            </p>
            <p className="text-sm text-gray-600 mt-2">
              {periodo === "semana" ? "nos últimos 7 dias" : "nos últimos 30 dias"}
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Média Diária</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {mediaConsumo.toFixed(1)} mg
            </p>
            <p className="text-sm text-gray-600 mt-2">
              por dia
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Maior Consumo</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {maiorConsumo.toFixed(1)} mg
            </p>
            <p className="text-sm text-gray-600 mt-2">
              em um dia
            </p>
          </div>
        </div>

        {/* Gráfico */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            Consumo por Dia
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={registros}>
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
                <Bar
                  dataKey="total"
                  fill="url(#colorGradient)"
                  radius={[8, 8, 0, 0]}
                />
                <defs>
                  <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#9333ea" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Layout>
  );
}
