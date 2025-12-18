import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/react-app/components/Layout";
import { Trash2, Filter } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/hooks/useUser";

/* =========================
   Tipos
========================= */

interface RegistroDB {
  id: string;
  data: string;
  peso_g: number;
  fenil_mg: number;
  created_at: string;
  referencias: {
    nome: string;
  } | null;
}

interface Registro {
  id: string;
  data: string;
  peso_g: number;
  fenil_mg: number;
  created_at: string;
  nome_alimento: string;
}

/* =========================
   Página
========================= */

export default function HistoricoPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useUser();

  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  /* Proteção de rota */
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/");
    }
  }, [authLoading, user, navigate]);

  /* Carregamento */
  useEffect(() => {
    if (!user) return;
    loadRegistros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, dataInicio, dataFim]);

  const loadRegistros = async () => {
    setLoading(true);

    try {
      let query = supabase
        .from("registros")
        .select(`
          id,
          data,
          peso_g,
          fenil_mg,
          created_at,
          referencias!inner (
            nome
          )
        `)
        .eq("usuario_id", user!.id)
        .order("data", { ascending: false });

      if (dataInicio) query = query.gte("data", dataInicio);
      if (dataFim) query = query.lte("data", dataFim);

      const { data: registrosData, error } = await query;

      console.log("RAW DATA FROM SUPABASE:", registrosData);

      if (error) {
        console.error("Erro ao carregar registros:", error);
        setRegistros([]);
        return;
      }

      /* ✅ NORMALIZAÇÃO CORRETA */
      const normalizados: Registro[] = (registrosData ?? []).map((r: any) => {
        const referencia =
          Array.isArray(r.referencias)
            ? r.referencias[0]
            : r.referencias;

        return {
          id: r.id,
          data: r.data,
          peso_g: r.peso_g,
          fenil_mg: r.fenil_mg,
          created_at: r.created_at,
          nome_alimento: referencia?.nome ?? "Alimento removido",
        };
      });


      setRegistros(normalizados);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este registro?")) return;

    const { error } = await supabase
      .from("registros")
      .delete()
      .eq("id", id);

    if (!error) {
      loadRegistros();
    }
  };

  const agrupadosPorData = useMemo(() => {
    return registros.reduce<Record<string, Registro[]>>((acc, r) => {
      if (!acc[r.data]) acc[r.data] = [];
      acc[r.data].push(r);
      return acc;
    }, {});
  }, [registros]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Histórico</h1>
          <p className="text-gray-600">Todos os seus registros de consumo</p>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl p-6 shadow">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5" />
            <h2 className="font-semibold">Filtros</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="border rounded-xl px-4 py-2"
            />
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="border rounded-xl px-4 py-2"
            />
          </div>
        </div>

        {/* Lista */}
        {Object.entries(agrupadosPorData).map(([data, regs]) => {
          const totalDia = regs.reduce((s, r) => s + r.fenil_mg, 0);

          return (
            <div key={data} className="bg-white rounded-2xl p-6 shadow">
              <h3 className="font-semibold">
                {format(new Date(`${data}T12:00:00`), "EEEE, d 'de' MMMM", {
                  locale: ptBR,
                })}
              </h3>

              {regs.map((r) => (
                <div
                  key={r.id}
                  className="flex justify-between items-center mt-3 bg-gray-50 p-4 rounded-xl"
                >
                  <div>
                    <p className="font-semibold">{r.nome_alimento}</p>
                    <p className="text-sm text-gray-600">
                      {r.peso_g}g • {r.fenil_mg.toFixed(1)} mg
                    </p>
                  </div>

                  <button
                    onClick={() => handleDelete(r.id)}
                    className="text-red-600"
                  >
                    <Trash2 />
                  </button>
                </div>
              ))}

              <p className="mt-4 font-bold text-indigo-600">
                Total do dia: {totalDia.toFixed(1)} mg
              </p>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
