import { Trash2, Plus } from "lucide-react";

interface AcessoConcedido {
  id: string;
  usuario_destino: {
    nome?: string;
    email: string;
  };
  created_at: string;
}

interface Props {
  acessos: AcessoConcedido[];
  loading: boolean;
  onRevogar: (delegacaoId: string) => Promise<void>;
  onConceder?: () => void;
  isReadOnly?: boolean;
}

export function AcessosConcedidosCard({
  acessos,
  loading,
  onRevogar,
  onConceder,
  isReadOnly = false,
}: Props) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Acessos concedidos</h2>

        {!isReadOnly && onConceder && (
          <button
            onClick={onConceder}
            className="flex items-center gap-2 border rounded-xl px-4 py-2 text-sm hover:bg-gray-50"
          >
            <Plus className="w-4 h-4" />
            Conceder acesso
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-gray-500">Carregando...</p>}

      {!loading && acessos.length === 0 && (
        <p className="text-sm text-gray-500">
          Você ainda não concedeu acesso a ninguém.
        </p>
      )}

      <ul className="space-y-3">
        {acessos.map((acesso) => (
          <li
            key={acesso.id}
            className="flex items-center justify-between border rounded-xl px-4 py-3"
          >
            <div>
              <p className="font-medium">
                {acesso.usuario_destino.nome ?? acesso.usuario_destino.email}
              </p>
              <p className="text-xs text-gray-500">
                Desde{" "}
                {new Date(acesso.created_at).toLocaleDateString("pt-BR")}
              </p>
            </div>

            <button
              onClick={() => onRevogar(acesso.id)}
              disabled={isReadOnly}
              className="
                text-red-600
                hover:text-red-800
                disabled:opacity-50
                disabled:cursor-not-allowed
                disabled:hover:text-red-600
                disabled:pointer-events-none
              "
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
