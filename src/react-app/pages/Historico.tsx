import { useMemo, useState } from "react";
import Layout from "@/react-app/components/Layout";
import { Trash2, Calendar, Filter } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRegistros } from "@/react-app/hooks/useRegistros";
import { LayoutSkeleton, HistoricoSkeleton } from "@skeletons";
import { useAuth } from "@/react-app/context/AuthContext";

export default function HistoricoPage() {
  const { ready, usuarioAtivoId } = useAuth();

  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const [dataInicioTemp, setDataInicioTemp] = useState("");
  const [dataFimTemp, setDataFimTemp] = useState("");

  const { data: registros = [], loading, remove } = useRegistros(
    ready && usuarioAtivoId
      ? {
          usuarioId: usuarioAtivoId,
          dataInicio,
          dataFim,
        }
      : undefined
  );

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este registro?")) return;
    await remove(id);
  };

  const aplicarFiltros = () => {
    setDataInicio(dataInicioTemp);
    setDataFim(dataFimTemp);
  };

  const limparFiltros = () => {
    setDataInicio("");
    setDataFim("");
    setDataInicioTemp("");
    setDataFimTemp("");
  };

  const agrupadosPorData = useMemo(() => {
    return registros.reduce<Record<string, typeof registros>>((acc, r) => {
      if (!acc[r.data]) acc[r.data] = [];
      acc[r.data].push(r);
      return acc;
    }, {});
  }, [registros]);

  if (!ready || loading) {
    return (
      <LayoutSkeleton>
        <HistoricoSkeleton />
      </LayoutSkeleton>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Histórico</h1>
          <p className="text-gray-600 mt-1">
            Todos os seus registros de consumo
          </p>
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
                value={dataInicioTemp}
                onChange={(e) => setDataInicioTemp(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Fim
              </label>
              <input
                type="date"
                value={dataFimTemp}
                onChange={(e) => setDataFimTemp(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex gap-4 mt-4">
            <button
              onClick={aplicarFiltros}
              className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700"
            >
              Aplicar filtros
            </button>

            {(dataInicio || dataFim) && (
              <button
                onClick={limparFiltros}
                className="mt-4 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {Object.keys(agrupadosPorData).length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-12 shadow-lg text-center">
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Nenhum registro encontrado
            </h3>
            <p className="text-gray-600">
              Comece adicionando seus primeiros registros no Dashboard
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(agrupadosPorData)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([data, regs]) => {
                const totalDia = regs.reduce(
                  (sum, r) => sum + r.fenil_mg,
                  0
                );

                return (
                  <div
                    key={data}
                    className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg"
                  >
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {format(
                            new Date(data + "T12:00:00"),
                            "EEEE, d 'de' MMMM",
                            { locale: ptBR }
                          )}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {regs.length}{" "}
                          {regs.length === 1
                            ? "registro"
                            : "registros"}
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
                          className="flex justify-between items-center bg-gray-50 p-4 rounded-xl"
                        >
                          <div>
                            <p className="font-semibold">{r.nome_alimento}</p>
                            <p className="text-sm text-gray-600">
                              {r.peso_g}g • {r.fenil_mg.toFixed(1)} mg
                            </p>
                          </div>
                          <button
                            onClick={() => handleDelete(r.id)}
                            className="ml-4 w-10 h-10 flex items-center justify-center rounded-xl hover:bg-red-50 text-red-600"
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
