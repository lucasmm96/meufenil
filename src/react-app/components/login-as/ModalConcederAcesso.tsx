import { useState } from "react";
import { X } from "lucide-react";

interface ModalConcederAcessoProps {
  open: boolean;
  onClose: () => void;
  onConceder: (email: string) => Promise<void>;
  loading?: boolean;
}

export function ModalConcederAcesso({
  open,
  onClose,
  onConceder,
  loading = false,
}: ModalConcederAcessoProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      await onConceder(email);
      setEmail("");
      onClose();
    } catch (err: any) {
      // 🔎 tenta extrair erro real da API
      const message =
        err?.error ||
        err?.message ||
        "Erro ao conceder acesso";

      setError(message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            Conceder acesso à conta
          </h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500 hover:text-gray-700" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email do usuário
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? "Concedendo..." : "Conceder acesso"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
