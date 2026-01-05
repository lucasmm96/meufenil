import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/react-app/components/Layout";
import { Download, TrendingUp, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/react-app/lib/supabase";
import { useAuth } from "@/react-app/context/AuthContext";
import { formatInTimeZone } from "date-fns-tz";

const parseLocalDate = (dateString: string) => {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(y, m - 1, d);
};

interface Registro {
  data: string;
  total: number;
}

interface Usuario {
  id: string;
  timezone: string;
}

export default function EstatisticasPage() {
  const navigate = useNavigate();
  const { authUser, loadingAuth } = useAuth();

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [periodo, setPeriodo] = useState<"semana" | "mes">("semana");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loadingAuth && !authUser) {
      navigate("/", { replace: true });
    }
  }, [loadingAuth, authUser, navigate]);

  useEffect(() => {
    if (!authUser) return;
    loadUsuario(authUser.id);
  }, [authUser]);

  useEffect(() => {
    if (!usuario) return;
    loadEstatisticas(usuario);
  }, [usuario, periodo]);

  const loadUsuario = async (userId: string) => {
    const { data, error } = await supabase
      .from("usuarios")
      .select("id, timezone")
      .eq("id", userId)
      .single();

    if (error || !data) {
      console.error("[Estatisticas] erro usuario", error);
      return;
    }

    setUsuario(data);
  };

  const loadEstatisticas = async (user: Usuario) => {
    setLoading(true);

    try {
      const dias = periodo === "semana" ? 7 : 30;
      const inicio = formatInTimeZone(subDays(new Date(), dias - 1), user.timezone, "yyyy-MM-dd");

      const { data: registrosDB, error } = await supabase
        .from("registros")
        .select("data, fenil_mg")
        .eq("usuario_id", user.id)
        .gte("data", inicio);

      if (error) {
        console.error("[Estatisticas] erro registros", error);
        return;
      }

      const mapa: Record<string, number> = {};

      registrosDB?.forEach((r) => {
        mapa[r.data] = (mapa[r.data] ?? 0) + (r.fenil_mg ?? 0);
      });

      const resultado: Registro[] = Object.keys(mapa)
        .sort()
        .map((data) => ({
          data,
          total: mapa[data],
        }));

      setRegistros(resultado);
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const header = "data,total_mg\n";
    const rows = registros
      .map((r) => `${r.data},${r.total.toFixed(2)}`)
      .join("\n");

    downloadFile(
      header + rows,
      `meufenil-estatisticas-${periodo}.csv`,
      "text/csv;charset=utf-8;"
    );
  };

  const exportJSON = () => {
    downloadFile(
      JSON.stringify(registros, null, 2),
      `meufenil-estatisticas-${periodo}.json`,
      "application/json"
    );
  };

  if (loading || loadingAuth || !usuario) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const totalConsumo = registros.reduce((sum, r) => sum + r.total, 0);
  const mediaConsumo = registros.length > 0 ? totalConsumo / registros.length : 0;
  const maiorConsumo = Math.max(...registros.map((r) => r.total), 0);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Estatísticas</h1>
            <p className="text-gray-600">
              Análise do consumo de fenilalanina
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
            <button
              onClick={exportJSON}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              JSON
            </button>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg">
          <div className="flex gap-2">
            <button
              onClick={() => setPeriodo("semana")}
              className={`flex-1 px-4 py-2 rounded-xl font-semibold transition-colors ${periodo === "semana"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Última Semana
            </button>
            <button
              onClick={() => setPeriodo("mes")}
              className={`flex-1 px-4 py-2 rounded-xl font-semibold transition-colors ${periodo === "mes"
                  ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Último Mês
            </button>
          </div>
        </div>

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
            <p className="text-sm text-gray-600 mt-2">por dia</p>
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
            <p className="text-sm text-gray-600 mt-2">em um dia</p>
          </div>
        </div>

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
