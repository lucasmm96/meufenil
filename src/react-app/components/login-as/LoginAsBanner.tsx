import { ArrowLeftRight, User } from "lucide-react";
import { useAuth } from "@/react-app/context/AuthContext";

export function LoginAsBanner() {
  const { isDelegado, owner, sairDoPerfilAssumido } = useAuth();

  if (!isDelegado || !owner) {
    return null;
  }

  return (
    <div className="bg-amber-100 border-b border-amber-300">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2 text-amber-900 text-sm">
          <User className="w-4 h-4" />
          <span>
            Você está acessando o perfil de{" "}
            <strong>{owner.nome ?? "outro usuário"}</strong>
          </span>
        </div>

        <button
          type="button"
          onClick={sairDoPerfilAssumido}
          className="flex items-center gap-1 text-sm font-medium text-amber-900 hover:underline"
        >
          <ArrowLeftRight className="w-4 h-4" />
          Voltar para minha conta
        </button>
      </div>
    </div>
  );
}
