import { useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useProtectedPage } from "@/react-app/hooks/useProtectedPage";

interface CriarAlimentoProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function CriarAlimento({
  onClose,
  onSuccess,
}: CriarAlimentoProps) {
  const { authUser, isReady } = useProtectedPage();

  const [loading, setLoading] = useState(false);
  const [nome, setNome] = useState("");
  const [fenil, setFenil] = useState("");

  if (!isReady) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome || !fenil) return;

    setLoading(true);

    try {
      const { error } = await supabase.from("referencias").insert({
        nome,
        fenil_mg_por_100g: parseFloat(fenil),
        criado_por: authUser!.id,
        is_global: false,
      });

      if (error) {
        console.error("Erro ao criar alimento:", error);
        return;
      }

      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Criar Novo Alimento</h2>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? "Criando..." : "Criar Alimento"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
