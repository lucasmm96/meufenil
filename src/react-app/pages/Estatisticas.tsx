import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/react-app/components/Layout";
import { Download, TrendingUp, Calendar } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/lib/supabase";

// evita bug de fuso horário
const parseLocalDate = (dateString: string) => {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(y, m - 1, d);
};

interface Registro {
  data: string;
  total: number;
}

export default function EstatisticasPage() {
  const navigate = useNavigate();

  const [registros, setRegistros] = useState<Registro[]>([]);
  const [periodo, setPeriodo] = useState<"semana" | "mes">("semana");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEstatisticas();
  }, [periodo]);

  const loadEstatisticas = async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      navigate("/", { replace: true });
      return;
    }

    const dias = periodo === "semana" ? 7 : 30;
    const inicio = format(subDays(new Date(), dias - 1), "yyyy-MM-dd");

    const { data: registrosDB, error } = await supabase
      .from("registros")
      .select("data, fenil_mg")
      .eq("usuario_id", user.id)
      .gte("data", inicio);

    if (error) {
      console.error(error);
      setLoading(false);
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
    setLoading(false);
  };

  /* =========================
     EXPORTAÇÃO (FRONT ONLY)
  ========================= */

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-10 w-10 rounded-full border-b-2 border-indigo-600" />
      </div>
    );
  }

  const totalConsumo = registros.reduce((sum, r) => sum + r.total, 0);
  const mediaConsumo =
    registros.length > 0 ? totalConsumo / registros.length : 0;
  const maiorConsumo = Math.max(...registros.map((r) => r.total), 0);

  return (
    <Layout>
      <div className="space-y-6">
        {/* HEADER */}
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
              className="flex items-center gap-2 px-4 py-2 bg-white border rounded-xl"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>

            <button
              onClick={exportJSON}
              className="flex items-center gap-2 px-4 py-2 bg-white border rounded-xl"
            >
              <Download className="w-4 h-4" />
              JSON
            </button>
          </div>
        </div>

        {/* PERÍODO */}
        <div className="bg-white rounded-xl p-4 shadow">
          <div className="flex gap-2">
            <button
              onClick={() => setPeriodo("semana")}
              className={`flex-1 py-2 rounded-lg font-semibold ${
                periodo === "semana"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100"
              }`}
            >
              Última semana
            </button>

            <button
              onClick={() => setPeriodo("mes")}
              className={`flex-1 py-2 rounded-lg font-semibold ${
                periodo === "mes"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100"
              }`}
            >
              Último mês
            </button>
          </div>
        </div>

        {/* CARDS */}
        <div className="grid md:grid-cols-3 gap-6">
          <ResumoCard
            title="Total"
            icon={<TrendingUp />}
            value={`${totalConsumo.toFixed(1)} mg`}
          />

          <ResumoCard
            title="Média diária"
            icon={<Calendar />}
            value={`${mediaConsumo.toFixed(1)} mg`}
          />

          <ResumoCard
            title="Maior consumo"
            icon={<TrendingUp />}
            value={`${maiorConsumo.toFixed(1)} mg`}
          />
        </div>

        {/* GRÁFICO */}
        <div className="bg-white rounded-xl p-6 shadow">
          <h2 className="font-bold mb-4">Consumo por dia</h2>

          <div className="h-80">
            <ResponsiveContainer>
              <BarChart data={registros}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="data"
                  tickFormatter={(v) =>
                    format(parseLocalDate(v), "dd/MM", { locale: ptBR })
                  }
                />
                <YAxis />
                <Tooltip
                  formatter={(v: number) => `${v.toFixed(1)} mg`}
                  labelFormatter={(v) =>
                    format(parseLocalDate(v), "dd 'de' MMMM", {
                      locale: ptBR,
                    })
                  }
                />
                <Bar dataKey="total" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function ResumoCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl p-6 shadow">
      <div className="flex justify-between items-center mb-2">
        <div className="text-indigo-600">{icon}</div>
        <span className="text-sm text-gray-500">{title}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
