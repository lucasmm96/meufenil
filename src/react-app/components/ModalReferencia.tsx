import { X } from "lucide-react";
import { useState, useEffect } from "react";
import type { ReferenciaDTO } from "@/react-app/services/referencias.service";

interface ModalReferenciaProps {
  referencia?: ReferenciaDTO | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (data: { nome: string; fenil: number }) => Promise<void>;
}

export default function ModalReferencia({
  referencia,
  loading,
  onClose,
  onSubmit,
}: ModalReferenciaProps) {
  const [nome, setNome] = useState("");
  const [fenil, setFenil] = useState("");

  useEffect(() => {
    if (referencia) {
      setNome(referencia.nome);
      setFenil(referencia.fenil_mg_por_100g.toString());
    } else {
      setNome("");
      setFenil("");
    }
  }, [referencia]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome || !fenil) return;

    await onSubmit({
      nome,
      fenil: Number(fenil),
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto">
        <div className="p-5 sm:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-bold">
              {referencia ? "Editar Referência" : "Nova Referência"}
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
              <label className="text-sm font-medium text-gray-700">
                Nome do Alimento
              </label>

              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Ex: Maçã Fuji"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Fenilalanina (mg por 100g)
              </label>

              <input
                type="number"
                step="0.01"
                value={fenil}
                onChange={(e) => setFenil(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Ex: 25.50"
                required
              />
            </div>

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
                disabled={loading}
                className="w-full sm:w-auto flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}