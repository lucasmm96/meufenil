import { useState, useEffect, useMemo, useRef } from "react";
import { X, Search, Plus, Star } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { useAuth } from "@/react-app/context/AuthContext";
import { useReferencias } from "@/react-app/hooks/useReferencias";
import { useCreateRegistro } from "@/react-app/hooks/useCreateRegistro";
import type { ReferenciaDTO } from "@/react-app/services/referencias.service";
import ModalReferencia from "@/react-app/components/ModalReferencia";

interface AdicionarRegistroProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AdicionarRegistro({
  onClose,
  onSuccess,
}: AdicionarRegistroProps) {
  const { ready, usuarioAtivoId, timezone } = useAuth();

  const [search, setSearch] = useState("");
  const [selectedReferencia, setSelectedReferencia] = useState<ReferenciaDTO | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [pesoG, setPesoG] = useState("");
  const [data, setData] = useState("");
  const [showModalReferencia, setShowModalReferencia] = useState(false);
  const [creatingReferencia, setCreatingReferencia] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    data: referencias,
    loading: referenciasLoading,
    search: searchReferencias,
    create: createReferencia,
  } = useReferencias(usuarioAtivoId!, { defaultOrder: "nome" });

  const registro = useCreateRegistro();

  const loading = registro.loading || referenciasLoading;

  if (!ready || !usuarioAtivoId) return null;

  useEffect(() => {
    if (!timezone) return;
    setData(formatInTimeZone(new Date(), timezone, "yyyy-MM-dd"));
  }, [timezone]);

  useEffect(() => {
    searchReferencias("");
  }, [searchReferencias]);

  useEffect(() => {
    const t = setTimeout(() => {
      searchReferencias(search);
    }, 300);

    return () => clearTimeout(t);
  }, [search, searchReferencias]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    }

    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const favoritos = useMemo(() => {
    return referencias.filter((ref) => ref.is_favorita);
  }, [referencias]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!usuarioAtivoId || !selectedReferencia || !pesoG || !data || !timezone) return;

    const fenil_mg =
      (selectedReferencia.fenil_mg_por_100g * Number(pesoG)) / 100;

    const dataTimestamp = formatInTimeZone(
      new Date(`${data}T00:00:00`),
      timezone,
      "yyyy-MM-dd'T'HH:mm:ssXXX"
    );

    await registro.create({
      usuarioId: usuarioAtivoId,
      referenciaId: selectedReferencia.id,
      data: dataTimestamp,
      peso_g: Number(pesoG),
      fenil_mg,
    });

    onSuccess();
  }

  function handleClearSelected() {
    setSelectedReferencia(null);
    setSearch("");
    searchReferencias("");
  }

  function handleClearSearch() {
    setSearch("");
    setSelectedReferencia(null);
    searchReferencias("");
    setShowDropdown(true);
  }

  async function handleCreateReferencia(data: { nome: string; fenil: number }) {
    const { nome, fenil } = data;

    if (Number.isNaN(fenil)) return;

    setCreatingReferencia(true);

    try {
      const ref = await createReferencia(nome, fenil);

      setSelectedReferencia(ref);
      setSearch(ref.nome);
      setShowDropdown(false);

      searchReferencias("");
      setShowModalReferencia(false);
    } finally {
      setCreatingReferencia(false);
    }
  }

  const fenilCalculada =
    selectedReferencia && pesoG
      ? (selectedReferencia.fenil_mg_por_100g * Number(pesoG)) / 100
      : 0;

  const listaExibida = referencias;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="p-5 sm:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              Adicionar Registro
            </h2>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Data</label>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>

            <div ref={dropdownRef} className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Alimento</label>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />

                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelectedReferencia(null);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  className="w-full pl-10 pr-10 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Buscar alimento..."
                />

                {search && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {showDropdown && listaExibida.length > 0 && (
                <div className="mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto divide-y">
                  {listaExibida.map((ref) => (
                    <button
                      key={ref.id}
                      type="button"
                      onClick={() => {
                        setSelectedReferencia(ref);
                        setSearch(ref.nome);
                        setShowDropdown(false);
                      }}
                      className={`w-full px-4 py-3 flex items-start justify-between gap-3 text-left hover:bg-gray-50 ${
                        ref.is_favorita ? "bg-amber-50/60" : ""
                      }`}
                    >
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-medium text-gray-900 text-sm sm:text-base break-words">
                          {ref.nome}
                        </span>

                        <span className="text-xs sm:text-sm text-gray-500">
                          {ref.fenil_mg_por_100g.toFixed(1)} mg/100g
                        </span>
                      </div>

                      {ref.is_favorita && (
                        <Star className="w-5 h-5 text-amber-500 fill-amber-500 shrink-0 mt-0.5" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {selectedReferencia && (
                <div className="p-4 bg-indigo-50 rounded-xl flex justify-between items-start gap-3">
                  <div className="text-sm text-indigo-900 break-words">
                    <span className="font-semibold">
                      {selectedReferencia.nome}
                    </span>{" "}
                    -{" "}
                    {selectedReferencia.fenil_mg_por_100g.toFixed(1)} mg de
                    fenilalanina por 100g
                  </div>

                  <button
                    type="button"
                    onClick={handleClearSelected}
                    className="text-indigo-400 hover:text-indigo-600 transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowModalReferencia(true)}
                className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium py-2"
              >
                <Plus className="w-4 h-4" />
                Criar novo alimento
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
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
              <div className="p-4 bg-purple-50 rounded-xl space-y-1">
                <p className="text-sm text-gray-600">
                  Fenilalanina calculada:
                </p>
                <p className="text-xl sm:text-2xl font-bold text-purple-600">
                  {fenilCalculada.toFixed(1)} mg
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={loading || !selectedReferencia || !pesoG}
                className="w-full sm:w-auto flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? "Salvando..." : "Salvar Registro"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showModalReferencia && (
        <ModalReferencia
          loading={creatingReferencia}
          onClose={() => setShowModalReferencia(false)}
          onSubmit={handleCreateReferencia}
        />
      )}
    </div>
  );
}
