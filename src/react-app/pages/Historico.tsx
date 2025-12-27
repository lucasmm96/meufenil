import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/react-app/components/Layout";
import { Trash2, Calendar, Filter } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/hooks/useUser";
import { useAuth } from "../context/AuthContext";

interface Registro {
  id: string;
  data: string;
  peso_g: number;
  fenil_mg: number;
  created_at: string;
  nome_alimento: string;
}

export default function HistoricoPage() {
  const navigate = useNavigate();
  const { authUser, loadingAuth } = useAuth();

  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const loadRegistros = useCallback(async () => {
    if (!authUser) return;

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
          referencias!inner ( nome )
        `)
        .eq("usuario_id", authUser.id)
        .order("data", { ascending: false });

      if (dataInicio) query = query.gte("data", dataInicio);
      if (dataFim) query = query.lte("data", dataFim);

      const { data, error } = await query;
      if (error) throw error;

      setRegistros(
        (data ?? []).map((r: any) => ({
          id: r.id,
          data: r.data,
          peso_g: r.peso_g,
          fenil_mg: r.fenil_mg,
          created_at: r.created_at,
          nome_alimento: r.referencias?.[0]?.nome ?? "Alimento removido",
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [authUser, dataInicio, dataFim]);

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

  useEffect(() => {
    if (loadingAuth) return;

    if (!authUser) {
      navigate("/", { replace: true });
    }
  }, [loadingAuth, authUser, navigate]);

  useEffect(() => {
    if (loadingAuth || !authUser) return;
    loadRegistros();
  }, [loadingAuth, authUser, loadRegistros]);

  const agrupadosPorData = useMemo(() => {
    return registros.reduce<Record<string, Registro[]>>((acc, r) => {
      if (!acc[r.data]) acc[r.data] = [];
      acc[r.data].push(r);
      return acc;
    }, {});
  }, [registros]);

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Histórico</h1>
          <p className="text-gray-600 mt-1">Todos os seus registros de consumo</p>
        </div>

        {/* Filtros */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Filtros</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Início
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Fim
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
          {(dataInicio || dataFim) && (
            <button
              onClick={() => {
                setDataInicio("");
                setDataFim("");
              }}
              className="mt-4 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Limpar filtros
            </button>
          )}
        </div>
        {Object.keys(agrupadosPorData).length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-12 shadow-lg text-center">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Nenhum registro encontrado
            </h3>
            <p className="text-gray-600">
              Comece adicionando seus primeiros registros na página do Dashboard
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(agrupadosPorData)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([data, regs]) => {
                const totalDia = regs.reduce((sum, r) => sum + r.fenil_mg, 0);
                return (
                  <div key={data} className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {format(new Date(data + "T12:00:00"), "EEEE, d 'de' MMMM", { locale: ptBR })}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {regs.length} {regs.length === 1 ? "registro" : "registros"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Total do dia</p>
                        <p className="text-2xl font-bold text-indigo-600">
                          {totalDia.toFixed(1)} mg
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
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
                            className="ml-4 w-10 h-10 flex items-center justify-center rounded-xl hover:bg-red-50 text-red-600 hover:text-red-700 transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </Layout>
  );
}
