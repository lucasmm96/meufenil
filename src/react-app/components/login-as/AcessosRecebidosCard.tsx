import { ArrowRightCircle } from "lucide-react";

interface AcessoRecebido {
  id: string;
  usuario_origem: {
    nome?: string;
    email: string;
  };
}

interface Props {
  acessos: AcessoRecebido[];
  loading: boolean;
  onAssumir: (delegacaoId: string) => Promise<void>;
  isReadOnly?: boolean;
}

export function AcessosRecebidosCard({
  acessos,
  loading,
  onAssumir,
  isReadOnly = false,
}: Props) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow">
      <h2 className="text-xl font-bold mb-4">Acessos recebidos</h2>

      {loading && <p className="text-sm text-gray-500">Carregando...</p>}

      {!loading && acessos.length === 0 && (
        <p className="text-sm text-gray-500">
          Nenhum acesso recebido.
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
                {acesso.usuario_origem.nome ?? acesso.usuario_origem.email}
              </p>
            </div>

            <button
              onClick={() => onAssumir(acesso.id)}
              disabled={isReadOnly}
              className="
                flex items-center gap-2
                border rounded-xl
                px-4 py-2
                text-sm
                hover:bg-gray-50
                disabled:opacity-50
                disabled:cursor-not-allowed
                disabled:hover:bg-transparent
                disabled:pointer-events-none
              "
            >
              <ArrowRightCircle className="w-4 h-4" />
              Acessar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
