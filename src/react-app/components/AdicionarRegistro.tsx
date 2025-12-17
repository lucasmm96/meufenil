import { useState, useEffect } from "react";
import { X, Search, Plus } from "lucide-react";

interface Referencia {
  id: number;
  nome: string;
  fenil_mg_por_100g: number;
  is_global: boolean;
}

interface AdicionarRegistroProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AdicionarRegistro({ onClose, onSuccess }: AdicionarRegistroProps) {
  const [referencias, setReferencias] = useState<Referencia[]>([]);
  const [search, setSearch] = useState("");
  const [selectedReferencia, setSelectedReferencia] = useState<Referencia | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [pesoG, setPesoG] = useState("");
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [showNovaReferencia, setShowNovaReferencia] = useState(false);
  const [novaRefNome, setNovaRefNome] = useState("");
  const [novaRefFenil, setNovaRefFenil] = useState("");

  useEffect(() => {
    loadReferencias("");
  }, []);

  useEffect(() => {
    if (search) {
      const timer = setTimeout(() => {
        loadReferencias(search);
        setShowDropdown(true);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setShowDropdown(false);
    }
  }, [search]);

  const loadReferencias = async (searchTerm: string) => {
    try {
      const res = await fetch(`/api/referencias?search=${encodeURIComponent(searchTerm)}`);
      const data: Referencia[] = await res.json(); // ✅ tipando explicitamente
      setReferencias(data);
    } catch (error) {
      console.error("Erro ao carregar referências:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReferencia || !pesoG) return;

    setLoading(true);
    try {
      const res = await fetch("/api/registros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data,
          referencia_id: selectedReferencia.id,
          peso_g: parseFloat(pesoG),
        }),
      });

      if (res.ok) {
        onSuccess();
      }
    } catch (error) {
      console.error("Erro ao adicionar registro:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNovaReferencia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaRefNome || !novaRefFenil) return;

    setLoading(true);
    try {
      const res = await fetch("/api/referencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: novaRefNome,
          fenil_mg_por_100g: parseFloat(novaRefFenil),
        }),
      });

      if (res.ok) {
        const data: { id: number } = await res.json();
        setShowNovaReferencia(false);
        setNovaRefNome("");
        setNovaRefFenil("");
        loadReferencias(search);
        // Selecionar automaticamente a nova referência
        const novaRefRes = await fetch(`/api/referencias?search=${encodeURIComponent(novaRefNome)}`);
        const refs: Referencia[] = await novaRefRes.json();
        const criada = refs.find((r) => r.id === data.id);
        if (criada) setSelectedReferencia(criada);
      }
    } catch (error) {
      console.error("Erro ao criar referência:", error);
    } finally {
      setLoading(false);
    }
  };

  const fenilCalculada = selectedReferencia && pesoG
    ? (Number(selectedReferencia.fenil_mg_por_100g) * Number(pesoG)) / 100
    : 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Adicionar Registro
            </h2>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome do Alimento
                </label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fenilalanina (mg por 100g)
                </label>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data
                </label>
                <input
                  type="date"
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Alimento
                </label>
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
                      <span className="font-semibold">{selectedReferencia.nome}</span>
                      {" - "}
                      {selectedReferencia.fenil_mg_por_100g.toFixed(1)} mg de fenilalanina por 100g
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Peso consumido (gramas)
                </label>
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
                  <p className="text-2xl font-bold text-purple-600">
                    {fenilCalculada.toFixed(1)} mg
                  </p>
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
