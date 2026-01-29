import { useState } from "react";
import { X, Mail, ShieldCheck } from "lucide-react";

interface ConcederAcessoModalProps {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (email: string) => Promise<void>;
}

export function ConcederAcessoModal({
  open,
  loading = false,
  onClose,
  onConfirm,
}: ConcederAcessoModalProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleConfirm = async () => {
    setError(null);

    if (!email.trim()) {
      setError("Informe um e-mail válido.");
      return;
    }

    try {
      await onConfirm(email.trim());
      setEmail("");
      onClose();
    } catch (err: any) {
      setError(
        err?.message ?? "Erro ao conceder acesso. Tente novamente.",
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-bold">Conceder acesso</h3>
          </div>

          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500 hover:text-gray-700" />
          </button>
        </div>

        <p className="text-sm text-gray-600">
          Informe o e-mail da pessoa que poderá acessar seu perfil.
          Você poderá revogar esse acesso a qualquer momento.
        </p>

        <div className="space-y-1">
          <label className="text-sm font-medium">E-mail</label>
          <div className="flex items-center gap-2 border rounded-xl px-3 py-2">
            <Mail className="w-4 h-4 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 outline-none text-sm"
              placeholder="email@exemplo.com"
              disabled={loading}
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border rounded-xl py-2 text-sm"
            disabled={loading}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 bg-indigo-600 text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Concedendo..." : "Conceder acesso"}
          </button>
        </div>
      </div>
    </div>
  );
}
