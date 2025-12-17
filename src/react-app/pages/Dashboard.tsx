import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import Layout from "@/react-app/components/Layout";
import ConsentimentoLGPD from "@/react-app/components/ConsentimentoLGPD";
import AdicionarRegistro from "@/react-app/components/AdicionarRegistro";
import CriarAlimento from "@/react-app/components/CriarAlimento";
import { Activity, TrendingUp, AlertCircle, Plus } from "lucide-react";
import {
  LineChart,
  Line,
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

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [hoje, setHoje] = useState<DashboardHoje | null>(null);
  const [grafico, setGrafico] = useState<GraficoData[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showCriarModal, setShowCriarModal] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      navigate("/", { replace: true });
      return;
    }

    // ───── perfil ─────
    const { data: perfil, error: perfilError } = await supabase
      .from("usuarios")
      .select("id, limite_diario_mg, consentimento_lgpd_em")
      .eq("id", user.id)
      .single();

    if (perfilError || !perfil) {
      console.error(perfilError);
      setLoading(false);
      return;
    }

    // ───── hoje ─────
    const hojeStr = format(new Date(), "yyyy-MM-dd");

    const { data: registrosHoje } = await supabase
      .from("registros")
      .select("fenil_mg")
      .eq("usuario_id", user.id)
      .eq("data", hojeStr);

    const totalHoje =
      registrosHoje?.reduce((acc, r) => acc + (r.fenil_mg ?? 0), 0) ?? 0;

    // ───── últimos 7 dias ─────
    const inicio = format(subDays(new Date(), 6), "yyyy-MM-dd");

    const { data: registrosGrafico } = await supabase
      .from("registros")
      .select("data, fenil_mg")
      .eq("usuario_id", user.id)
      .gte("data", inicio);

    const mapa: Record<string, number> = {};

    registrosGrafico?.forEach((r) => {
      mapa[r.data] = (mapa[r.data] ?? 0) + (r.fenil_mg ?? 0);
    });

    const graficoData: GraficoData[] = Object.keys(mapa)
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

    loadDashboard();
  };

  if (loading || !usuario || !hoje) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-10 w-10 rounded-full border-b-2 border-indigo-600" />
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
          onSuccess={loadDashboard}
        />
      )}

      {showCriarModal && (
        <CriarAlimento
          onClose={() => setShowCriarModal(false)}
          onSuccess={() => setShowCriarModal(false)}
        />
      )}

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-600">
            {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", {
              locale: ptBR,
            })}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowCriarModal(true)}
            className="border border-indigo-600 text-indigo-600 px-4 py-2 rounded-lg"
          >
            <Plus className="inline w-4 h-4 mr-2" />
            Criar alimento
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg"
          >
            Adicionar registro
          </button>
        </div>
      </div>

      {/* CARDS */}
      <div className="grid md:grid-cols-3 gap-6 mb-6">
        <Card title="Hoje" icon={<Activity />} value={`${hoje.total.toFixed(1)} mg`} />
        <Card
          title="Percentual"
          icon={ultrapassou ? <AlertCircle /> : <TrendingUp />}
          value={`${percentual.toFixed(1)}%`}
          danger={ultrapassou}
        />
        <Card
          title="Restante"
          icon={<Activity />}
          value={`${Math.max(0, hoje.limite - hoje.total).toFixed(1)} mg`}
        />
      </div>

      {/* GRÁFICO */}
      <div className="bg-white rounded-xl p-6 shadow">
        <h2 className="font-bold mb-4">Últimos 7 dias</h2>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={grafico}>
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
              <Line
                type="monotone"
                dataKey="total"
                stroke="#6366f1"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Layout>
  );
}

function Card({
  title,
  value,
  icon,
  danger,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-xl p-6 shadow ${
        danger ? "ring-2 ring-red-500" : ""
      }`}
    >
      <div className="flex justify-between items-center mb-2">
        <div className="text-indigo-600">{icon}</div>
        <span className="text-sm text-gray-500">{title}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
