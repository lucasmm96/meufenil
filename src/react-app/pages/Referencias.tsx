import { useState, useEffect } from "react";
import Layout from "@/react-app/components/Layout";
import { Star, ArrowUp, ArrowDown, ArrowUpDown, Trash2, Edit2, RotateCcw, Filter, X } from "lucide-react";

import { useAuth } from "@/react-app/context/AuthContext";
import { useUsuarioAtivo } from "@/react-app/hooks/useUsuarioAtivo";
import { useReferencias } from "@/react-app/hooks/useReferencias";
import { useLayoutPerfil } from "@/react-app/hooks/useLayoutPerfil";
import { LayoutSkeleton, ReferenciasSkeleton } from "@skeletons";
import ModalReferencia from "@/react-app/components/ModalReferencia";

export default function ReferenciasPage() {
  const { authUser, ready } = useAuth();
  const { perfil } = useLayoutPerfil(authUser?.id);
  const isAdmin = perfil?.role === "admin";

  const { usuarioAtivoId } = useUsuarioAtivo();

  const {
    data: referencias,
    loading,
    error,
    search,
    create,
    update,
    activate,
    deactivate,
    remove,
    ordenarPor,
    setOrdenarPor,
    toggleFavoritoReferencia,
    searchTerm,
  } = useReferencias(usuarioAtivoId ?? undefined);

  const [showModal, setShowModal] = useState(false);
  const [editingReferencia, setEditingReferencia] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showInativas, setShowInativas] = useState(false);
  const [onlyFavoritas, setOnlyFavoritas] = useState(false);
  const [onlyCustomizadas, setOnlyCustomizadas] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const podeEditarOuRemover = (ref: any) => {
    if (ref.criado_por === usuarioAtivoId) return true;
    if (isAdmin && ref.is_global) return true;
    return false;
  };

  const motivoBloqueio = (r: any) => {
    if (!r.is_ativa) return "Referência inativa";

    if (!podeEditarOuRemover(r)) {
      if (r.is_global && !isAdmin)
        return "Apenas administradores podem editar referências globais";

      if (r.criado_por !== usuarioAtivoId)
        return "Você não pode editar referências de outro usuário";
    }

    return "";
  };

  const handleOpenCreate = () => {
    setEditingReferencia(null);
    setShowModal(true);
  };

  const handleOpenEdit = (ref: any) => {
    if (!podeEditarOuRemover(ref) || !ref.is_ativa) return;
    setEditingReferencia(ref);
    setShowModal(true);
  };

  const handleDelete = async (ref: any) => {
    if (!podeEditarOuRemover(ref) || !ref.is_ativa) return;

    const confirmar = confirm(
      `Remover a referência "${ref.nome}"?\n\n` +
      `⚠️ Se houver registros associados, ela será apenas desativada.`
    );

    if (!confirmar) return;

    try {
      await remove(ref.id);

      alert("Referência removida com sucesso.");
    } catch (err: any) {
      if (err?.originalError?.code === "23503") {
        await deactivate(ref.id);
        alert(
          "Esta referência possui registros associados.\n\n" +
          "Ela foi DESATIVADA e não poderá ser usada em novos registros."
        );
      } else {
        alert("Erro ao remover referência.");
        throw err;
      }
    }
  };

  const handleSubmit = async (data: { nome: string; fenil: number }) => {
    const { nome, fenil } = data;

    if (Number.isNaN(fenil)) {
      alert("Informe um valor numérico válido para fenilalanina.");
      return;
    }

    setSubmitting(true);

    try {
      if (editingReferencia) {
        if (!podeEditarOuRemover(editingReferencia)) {
          alert("Você não tem permissão para editar esta referência.");
          return;
        }

        await update(editingReferencia.id, nome, fenil);

        alert("Referência atualizada com sucesso.");
      } else {
        await create(nome, fenil);
        alert("Referência criada com sucesso.");
      }

      setShowModal(false);

    } catch (err: any) {

      if (err?.code === "REFERENCIA_DUPLICADA") {
        alert("Já existe uma referência com esse nome.");
        return;
      }

      alert("Erro ao salvar referência.");
      console.error(err);

    } finally {
      setSubmitting(false);
    }
  };

  const toggleSort = (campo: "nome" | "fenil" | "tipo") => {
    if (ordenarPor === campo) setOrdenarPor(`${campo}_desc`);
    else setOrdenarPor(campo as any);
  };

  const totalItems = referencias.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  const referenciasPaginadas = referencias.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [referencias]);

  if (!ready) {
    return (
      <LayoutSkeleton>
        <ReferenciasSkeleton />
      </LayoutSkeleton>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Referências Alimentares
            </h1>
            <p className="text-gray-600 mt-1">
              Valores de fenilalanina por 100g
            </p>
          </div>

          <button
            onClick={handleOpenCreate}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
          >
            + Nova Referência
          </button>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Filtros
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buscar alimento
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Digite o nome do alimento..."
                  value={searchTerm}
                  onChange={(e) =>
                    search(e.target.value, {
                      showInativas,
                      onlyFavoritas,
                      onlyCustomizadas,
                    })
                  }
                  className="w-full px-4 py-2 pr-10 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />

                {searchTerm && (
                  <button
                    type="button"
                    title="Limpar busca"
                    onClick={() =>
                      search("", {
                        showInativas,
                        onlyFavoritas,
                      })
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Opções */}
            <div className="flex flex-col justify-end gap-3">

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={showInativas}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setShowInativas(checked);
                    search(searchTerm, {
                      showInativas: checked,
                      onlyFavoritas,
                    });
                  }}
                  className="accent-indigo-600"
                />
                Mostrar referências inativas
              </label>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={onlyFavoritas}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setOnlyFavoritas(checked);
                    search(searchTerm, {
                      showInativas,
                      onlyFavoritas: checked,
                    });
                  }}
                  className="accent-yellow-500"
                />
                Somente favoritas
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={onlyCustomizadas}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setOnlyCustomizadas(checked);
                    search(searchTerm, {
                      showInativas,
                      onlyFavoritas,
                      onlyCustomizadas: checked,
                    });
                  }}
                  className="accent-purple-600"
                />
                Somente customizadas
              </label>
            </div>
          </div>
        </div>


        {/* Erro */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-xl p-4">
            <p className="text-red-700">
              Erro ao carregar referências
            </p>
          </div>
        )}

        <div className="relative bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden">

          {loading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center z-10">
              <div className="h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              Lista de Referências
            </h2>
          </div>

          {referencias.length === 0 ? (
            <div className="p-12 text-center">
              <Star className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                Nenhuma referência cadastrada ainda
              </p>
              <button
                onClick={handleOpenCreate}
                className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Criar primeira referência
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Fav
                    </th>

                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer"
                      onClick={() => toggleSort("nome")}
                    >
                      Nome
                      {ordenarPor === "nome" && <ArrowUp className="inline w-4 h-4 ml-1" />}
                      {ordenarPor === "nome_desc" && <ArrowDown className="inline w-4 h-4 ml-1" />}
                      {!["nome", "nome_desc"].includes(ordenarPor) && (
                        <ArrowUpDown className="inline w-4 h-4 ml-1" />
                      )}
                    </th>

                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer"
                      onClick={() => toggleSort("fenil")}
                    >
                      Fenilalanina (mg/100g)
                      {ordenarPor === "fenil" && <ArrowUp className="inline w-4 h-4 ml-1" />}
                      {ordenarPor === "fenil_desc" && <ArrowDown className="inline w-4 h-4 ml-1" />}
                      {!["fenil", "fenil_desc"].includes(ordenarPor) && (
                        <ArrowUpDown className="inline w-4 h-4 ml-1" />
                      )}
                    </th>

                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Tipo
                    </th>

                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Ações
                    </th>
                  </tr>
                </thead>

                <tbody className="bg-white divide-y divide-gray-200">
                  {referenciasPaginadas.map((r) => {
                    const bloqueado = !podeEditarOuRemover(r) || !r.is_ativa;

                    return (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => {
                              if (!r.is_ativa) return;
                              toggleFavoritoReferencia(r.id);
                            }}
                            disabled={!r.is_ativa}
                            title={r.is_ativa ? (r.is_favorita ? "Desmarcar favorito" : "Marcar como favorito") : "Referência inativa"}
                            className={`transition-transform ${r.is_ativa ? "hover:scale-110" : "cursor-not-allowed opacity-40"}`}
                          >
                            <Star className={`w-5 h-5 ${r.is_favorita ? "text-yellow-400 fill-yellow-400" : "text-gray-400"}`} />
                          </button>
                        </td>

                        <td className="px-6 py-4">
                          <p
                            className={`text-sm font-medium ${r.is_ativa ? "text-gray-900" : "text-gray-400 line-through"
                              }`}
                          >
                            {r.nome}
                            {!r.is_ativa && (
                              <span className="ml-2 text-xs text-red-600">(Inativa)</span>
                            )}
                          </p>
                        </td>

                        <td className="px-6 py-4">
                          <p className="text-sm font-semibold text-indigo-600">
                            {r.fenil_mg_por_100g.toFixed(1)}
                          </p>
                        </td>

                        <td className="px-6 py-4">
                          <span className={`text-xs font-medium px-3 py-1 rounded-full ${r.is_global
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                            }`}>
                            {r.is_global ? "Global" : "Customizada"}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-3">

                            <button
                              disabled={bloqueado}
                              onClick={() => handleOpenEdit(r)}
                              title={bloqueado ? motivoBloqueio(r) : "Editar"}
                              className={
                                bloqueado
                                  ? "text-gray-300 cursor-not-allowed"
                                  : "text-indigo-600 hover:text-indigo-700"
                              }
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              disabled={bloqueado}
                              onClick={() => handleDelete(r)}
                              title={bloqueado ? motivoBloqueio(r) : "Remover"}
                              className={
                                bloqueado
                                  ? "text-gray-300 cursor-not-allowed"
                                  : "text-red-600 hover:text-red-700"
                              }
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                            {/* REATIVAR */}
                            {!r.is_ativa && podeEditarOuRemover(r) && (
                              <button
                                onClick={async () => {
                                  if (!confirm(`Reativar a referência "${r.nome}"?`)) return;
                                  await activate(r.id);
                                }}
                                title="Reativar referência"
                                className="text-green-600 hover:text-green-700"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 border-t border-gray-200 bg-gray-50">

            <div className="flex items-center gap-2 text-sm">
              <span>Itens por página:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="border rounded px-2 py-1"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="text-sm font-medium text-gray-700">
              Total: {totalItems} registros
            </div>

            <div className="flex items-center gap-2">

              <button
                title="Primeira página"
                onClick={() => setCurrentPage(1)}
                disabled={safeCurrentPage === 1}
                className="p-2 border rounded hover:bg-gray-100 disabled:opacity-40"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 19L4 12L11 5" />
                  <path d="M20 19V5" />
                </svg>
              </button>

              <button
                title="Página anterior"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage === 1}
                className="p-2 border rounded hover:bg-gray-100 disabled:opacity-40"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 19L8 12L15 5" />
                </svg>
              </button>

              <span className="text-sm px-3">
                <strong>{safeCurrentPage}</strong> / {totalPages}
              </span>

              <button
                title="Próxima página"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage === totalPages}
                className="p-2 border rounded hover:bg-gray-100 disabled:opacity-40"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 5L16 12L9 19" />
                </svg>
              </button>

              <button
                title="Última página"
                onClick={() => setCurrentPage(totalPages)}
                disabled={safeCurrentPage === totalPages}
                className="p-2 border rounded hover:bg-gray-100 disabled:opacity-40"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 5L20 12L13 19" />
                  <path d="M4 5V19" />
                </svg>
              </button>

            </div>
          </div>
        </div>
        {showModal && (
          <ModalReferencia
            referencia={editingReferencia}
            loading={submitting}
            onClose={() => setShowModal(false)}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </Layout>
  );
}
