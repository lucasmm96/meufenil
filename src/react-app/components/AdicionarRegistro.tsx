import { useState, useEffect } from "react";
import { X, Search, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatInTimeZone } from "date-fns-tz";
import { useAuth } from "@/react-app/context/AuthContext";

interface Referencia {
  id: string;
  nome: string;
  fenil_mg_por_100g: number;
}

interface AdicionarRegistroProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AdicionarRegistro({
  onClose,
  onSuccess,
}: AdicionarRegistroProps) {
  const { authUser, loadingAuth, timezone } = useAuth();

  const [referencias, setReferencias] = useState<Referencia[]>([]);
  const [search, setSearch] = useState("");
  const [selectedReferencia, setSelectedReferencia] =
    useState<Referencia | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [pesoG, setPesoG] = useState("");
  const [data, setData] = useState("");
  const [loading, setLoading] = useState(false);
  const [showNovaReferencia, setShowNovaReferencia] = useState(false);
  const [novaRefNome, setNovaRefNome] = useState("");
  const [novaRefFenil, setNovaRefFenil] = useState("");

  const userId = authUser?.id ?? null;

  useEffect(() => {
    if (!timezone) return;

    const hoje = formatInTimeZone(new Date(), timezone, "yyyy-MM-dd");
    setData(hoje);
  }, [timezone]);

  useEffect(() => {
    if (userId) loadReferencias("");
  }, [userId]);

  useEffect(() => {
    if (!search) {
      setShowDropdown(false);
      return;
    }

    const t = setTimeout(() => {
      if (userId) loadReferencias(search);
      setShowDropdown(true);
    }, 300);

    return () => clearTimeout(t);
  }, [search, userId]);

  async function loadReferencias(searchTerm: string) {
    if (!userId) return;

    const filter = searchTerm ? `%${searchTerm}%` : `%`;

    const { data, error } = await supabase
      .from("referencias")
      .select("id, nome, fenil_mg_por_100g")
      .or(`is_global.eq.true,criado_por.eq.${userId}`)
      .ilike("nome", filter)
      .order("nome");

    if (error) {
      console.error("Erro ao carregar referências:", error);
      return;
    }

    if (data) setReferencias(data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedReferencia || !pesoG || !userId || !data || !timezone) return;

    setLoading(true);

    try {
      const fenil_mg =
        (selectedReferencia.fenil_mg_por_100g * Number(pesoG)) / 100;

      const dataTimestamp = formatInTimeZone(
        new Date(`${data}T00:00:00`),
        timezone,
        "yyyy-MM-dd'T'HH:mm:ssXXX"
      );

      const { error } = await supabase.from("registros").insert({
        data: dataTimestamp,
        usuario_id: userId,
        referencia_id: selectedReferencia.id,
        peso_g: Number(pesoG),
        fenil_mg,
      });

      if (!error) {
        onSuccess();
      } else {
        console.error("Erro ao salvar registro:", error);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleNovaReferencia(e: React.FormEvent) {
    e.preventDefault();
    if (!novaRefNome || !novaRefFenil || !userId) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("referencias")
      .insert({
        nome: novaRefNome,
        fenil_mg_por_100g: Number(novaRefFenil),
        criado_por: userId,
        is_global: false,
      })
      .select()
      .single();

    setLoading(false);

    if (!error && data) {
      setSelectedReferencia(data);
      setSearch(data.nome);
      setShowNovaReferencia(false);
      loadReferencias("");
    }
  }

  const fenilCalculada =
    selectedReferencia && pesoG
      ? (selectedReferencia.fenil_mg_por_100g * Number(pesoG)) / 100
      : 0;

  if (loadingAuth) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Adicionar Registro</h2>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {showNovaReferencia ? (
            <form onSubmit={handleNovaReferencia} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Nome do Alimento</label>
                <input
                  type="text"
                  value={novaRefNome}
                  onChange={(e) => setNovaRefNome(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Ex: Maçã fuji"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fenilalanina (mg por 100g)</label>
                <input
                  type="number"
                  step="0.01"
                  value={novaRefFenil}
                  onChange={(e) => setNovaRefFenil(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Ex: 25.50"
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowNovaReferencia(false)}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? "Criando..." : "Criar Referência"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data</label>
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Alimento</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onFocus={() => search && setShowDropdown(true)}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Buscar alimento..."
                  />
                </div>

                {showDropdown && search && referencias.length > 0 && (
                  <div className="mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {referencias.map((ref) => (
                      <button
                        key={ref.id}
                        type="button"
                        onClick={() => {
                          setSelectedReferencia(ref);
                          setSearch(ref.nome);
                          setShowDropdown(false);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 flex justify-between items-center"
                      >
                        <span className="font-medium text-gray-900">{ref.nome}</span>
                        <span className="text-sm text-gray-500">
                          {ref.fenil_mg_por_100g.toFixed(1)} mg/100g
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {selectedReferencia && (
                  <div className="mt-2 p-3 bg-indigo-50 rounded-xl">
                    <p className="text-sm text-indigo-900">
                      <span className="font-semibold">{selectedReferencia.nome}</span> - {selectedReferencia.fenil_mg_por_100g.toFixed(1)} mg de fenilalanina por 100g
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowNovaReferencia(true)}
                  className="mt-2 flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Criar novo alimento
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Peso consumido (gramas)</label>
                <input
                  type="number"
                  step="0.01"
                  value={pesoG}
                  onChange={(e) => setPesoG(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Ex: 150"
                  required
                />
              </div>

              {fenilCalculada > 0 && (
                <div className="p-4 bg-purple-50 rounded-xl">
                  <p className="text-sm text-gray-600">Fenilalanina calculada:</p>
                  <p className="text-2xl font-bold text-purple-600">{fenilCalculada.toFixed(1)} mg</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !selectedReferencia || !pesoG}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? "Salvando..." : "Salvar Registro"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
