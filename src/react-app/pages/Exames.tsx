import { useEffect, useState } from "react";
import { useAuth } from "@getmocha/users-service/react";
import { useNavigate } from "react-router";
import Layout from "@/react-app/components/Layout";
import { Activity, Plus, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ExamePKU {
  id: number;
  data_exame: string;
  resultado_mg_dl: number;
  created_at: string;
}

export default function ExamesPage() {
  const { user, isPending } = useAuth();
  const navigate = useNavigate();
  const [exames, setExames] = useState<ExamePKU[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [dataExame, setDataExame] = useState(new Date().toISOString().split('T')[0]);
  const [resultadoMgDl, setResultadoMgDl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isPending && !user) {
      navigate("/");
    }
  }, [user, isPending, navigate]);

  useEffect(() => {
    if (user) {
      loadExames();
    }
  }, [user]);

  const loadExames = async () => {
    try {
      const res = await fetch("/api/exames-pku");
      const data = await res.json();
      setExames(data);
    } catch (error) {
      console.error("Erro ao carregar exames:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dataExame || !resultadoMgDl) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/exames-pku", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data_exame: dataExame,
          resultado_mg_dl: parseFloat(resultadoMgDl),
        }),
      });

      if (res.ok) {
        setShowModal(false);
        setDataExame(new Date().toISOString().split('T')[0]);
        setResultadoMgDl("");
        loadExames();
      }
    } catch (error) {
      console.error("Erro ao adicionar exame:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir este exame?")) return;

    try {
      const res = await fetch(`/api/exames-pku/${id}`, { method: "DELETE" });
      if (res.ok) {
        loadExames();
      }
    } catch (error) {
      console.error("Erro ao excluir exame:", error);
    }
  };

  if (isPending || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const graficoData = [...exames].reverse();
  
  const ultimoExame = exames[0];
  const penultimoExame = exames[1];
  const tendencia = ultimoExame && penultimoExame 
    ? ultimoExame.resultado_mg_dl - penultimoExame.resultado_mg_dl 
    : 0;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Exames PKU</h1>
            <p className="text-gray-600 mt-1">Controle de fenilcetonúria</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
          >
            + Registrar Exame
          </button>
        </div>

        {exames.length > 0 && (
          <>
            {/* Cards de Resumo */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <Activity className="w-6 h-6 text-indigo-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-500">Último Exame</span>
                </div>
                <div className="space-y-2">
                  <p className="text-3xl font-bold text-gray-900">
                    {ultimoExame.resultado_mg_dl.toFixed(1)} mg/dL
                  </p>
                  <p className="text-sm text-gray-600">
                    {format(parseISO(ultimoExame.data_exame), "dd/MM/yyyy")}
                  </p>
                </div>
              </div>

              {penultimoExame && (
                <>
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        tendencia <= 0 ? 'bg-green-100' : 'bg-orange-100'
                      }`}>
                        {tendencia <= 0 ? (
                          <TrendingDown className="w-6 h-6 text-green-600" />
                        ) : (
                          <TrendingUp className="w-6 h-6 text-orange-600" />
                        )}
                      </div>
                      <span className="text-sm font-medium text-gray-500">Variação</span>
                    </div>
                    <div className="space-y-2">
                      <p className={`text-3xl font-bold ${
                        tendencia <= 0 ? 'text-green-600' : 'text-orange-600'
                      }`}>
                        {tendencia > 0 ? '+' : ''}{tendencia.toFixed(1)} mg/dL
                      </p>
                      <p className="text-sm text-gray-600">
                        vs exame anterior
                      </p>
                    </div>
                  </div>

                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                        <Activity className="w-6 h-6 text-purple-600" />
                      </div>
                      <span className="text-sm font-medium text-gray-500">Total de Exames</span>
                    </div>
                    <div className="space-y-2">
                      <p className="text-3xl font-bold text-gray-900">
                        {exames.length}
                      </p>
                      <p className="text-sm text-gray-600">
                        registrados
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Gráfico */}
            {exames.length >= 2 && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                <h2 className="text-xl font-bold text-gray-900 mb-6">
                  Histórico de Resultados
                </h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={graficoData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="data_exame" 
                        stroke="#6b7280"
                        tickFormatter={(value) => format(parseISO(value), "dd/MM", { locale: ptBR })}
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
                          format(parseISO(value), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                        }
                        formatter={(value: number) => [`${value.toFixed(1)} mg/dL`, "PKU"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="resultado_mg_dl"
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
            )}
          </>
        )}

        {/* Lista de Exames */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Histórico de Exames</h2>
          </div>
          {exames.length === 0 ? (
            <div className="p-12 text-center">
              <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Nenhum exame registrado ainda</p>
              <button
                onClick={() => setShowModal(true)}
                className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Registrar primeiro exame
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data do Exame
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Resultado (mg/dL)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Registrado em
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {exames.map((exame) => (
                    <tr key={exame.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {format(parseISO(exame.data_exame), "dd/MM/yyyy")}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-indigo-600">
                          {exame.resultado_mg_dl.toFixed(1)} mg/dL
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {format(parseISO(exame.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleDelete(exame.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Informação sobre o exame */}
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Activity className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900">Sobre o exame PKU</h3>
              <p className="text-sm text-blue-700 mt-1">
                O exame de fenilcetonúria mede a concentração de fenilalanina no sangue. 
                O valor em mg/dL é calculado dividindo o valor PHE (µmol/L) por 60,6.
                Registre aqui apenas o resultado final em mg/dL.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Adicionar Exame */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Registrar Exame
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <Plus className="w-5 h-5 text-gray-500 rotate-45" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data do Exame
                  </label>
                  <input
                    type="date"
                    value={dataExame}
                    onChange={(e) => setDataExame(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Resultado PKU (mg/dL)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={resultadoMgDl}
                    onChange={(e) => setResultadoMgDl(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Ex: 2.5"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Valor PHE ÷ 60,6 = PKU em mg/dL
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {submitting ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
