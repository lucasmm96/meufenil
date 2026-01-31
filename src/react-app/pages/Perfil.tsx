import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/react-app/components/Layout";
import { User, Save, Shield, Download, Trash2, Plus } from "lucide-react";
import { usePerfil } from "@/react-app/hooks/usePerfil";
import { supabase } from "@/react-app/lib/supabase";
import { LayoutSkeleton, PerfilSkeleton } from "@skeletons";

import { AcessosConcedidosCard } from "@/react-app/components/login-as/AcessosConcedidosCard";
import { AcessosRecebidosCard } from "@/react-app/components/login-as/AcessosRecebidosCard";
import { ModalConcederAcesso } from "@/react-app/components/login-as/ModalConcederAcesso";

import { useAuth } from "@/react-app/context/AuthContext";

export default function PerfilPage() {
  const navigate = useNavigate();

  const {
    authUser,
    ready,
    usuarioAtivoId,
    isDelegado,

    concedidos,
    recebidos,
    carregarDelegacoes,
    conceder,
    revogar,
    assumir,
  } = useAuth();

  const { perfil, loading, saving, salvar } = usePerfil(
    usuarioAtivoId ?? undefined
  );

  const isReadOnly = isDelegado;
  const noopAsync = async () => {};

  const [nome, setNome] = useState("");
  const [limiteDiario, setLimiteDiario] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  /* =========================
   * Bootstrap
   * ========================= */
  useEffect(() => {
    if (perfil) {
      setNome(perfil.nome ?? "");
      setLimiteDiario(perfil.limite_diario_mg.toString());
    }
  }, [perfil]);

  useEffect(() => {
    carregarDelegacoes();
  }, [carregarDelegacoes]);

  /* =========================
   * Handlers
   * ========================= */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!perfil || isReadOnly) return;

    await salvar({
      nome,
      limite_diario_mg: Number(limiteDiario),
    });

    alert("Perfil atualizado com sucesso!");
  };

  const handleExportarTudo = async () => {
    if (!usuarioAtivoId || isReadOnly) return;

    try {
      const { data: perfilData, error: perfilError } = await supabase
        .from("usuarios")
        .select("*")
        .eq("id", usuarioAtivoId)
        .single();

      if (perfilError) throw perfilError;

      const { data: registros, error: registrosError } = await supabase
        .from("registros")
        .select(`
          id,
          data,
          peso_g,
          fenil_mg,
          created_at,
          referencias ( nome )
        `)
        .eq("usuario_id", usuarioAtivoId)
        .order("data", { ascending: false });

      if (registrosError) throw registrosError;

      const exportData = {
        usuario: perfilData,
        registros,
        exportado_em: new Date().toISOString(),
        versao: "1.0",
      };

      const blob = new Blob(
        [JSON.stringify(exportData, null, 2)],
        { type: "application/json" }
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = `meufenil-dados-${new Date().toISOString().split("T")[0]}.json`;

      document.body.appendChild(a);
      a.click();

      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Erro ao exportar dados");
    }
  };

  const handleExcluirConta = async () => {
    if (!authUser || isReadOnly) return;
    if (!confirm("Deseja realmente excluir sua conta?")) return;

    const confirmacao = prompt('Digite "EXCLUIR" para confirmar:');
    if (confirmacao !== "EXCLUIR") return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (!accessToken) return;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!res.ok) throw new Error();

      await supabase.auth.signOut();
      navigate("/", { replace: true });
    } catch {
      alert("Erro ao excluir conta");
    }
  };

  /* =========================
   * Loading
   * ========================= */
  if (!ready || loading) {
    return (
      <LayoutSkeleton>
        <PerfilSkeleton />
      </LayoutSkeleton>
    );
  }

  if (!perfil) return null;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl font-bold">Perfil</h1>
          <p className="text-gray-600">
            {isReadOnly
              ? "Visualização de perfil via acesso delegado"
              : "Gerencie suas informações pessoais"}
          </p>
        </header>

        {isReadOnly && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-xl text-sm">
            Você está acessando esta conta por meio de um acesso delegado.
            As informações estão disponíveis apenas para consulta.
          </div>
        )}

        <div className="bg-white rounded-2xl p-6 shadow">
          <div className="flex items-center gap-3 mb-6">
            <User className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-bold">Informações Pessoais</h2>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nome</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                disabled={isReadOnly}
                className="w-full px-4 py-3 rounded-xl border disabled:bg-gray-100"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">E-mail</label>
              <input
                value={perfil.email ?? ""}
                disabled
                className="w-full px-4 py-3 rounded-xl border bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Limite diário de fenilalanina (mg)
              </label>
              <input
                type="number"
                step="0.01"
                value={limiteDiario}
                onChange={(e) => setLimiteDiario(e.target.value)}
                disabled={isReadOnly}
                className="w-full px-4 py-3 rounded-xl border disabled:bg-gray-100"
                required
              />
            </div>

            {!isReadOnly && (
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
              >
                <Save className="inline w-4 h-4 mr-2" />
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            )}
          </form>
        </div>

        {/* {!isReadOnly && (
          <div className="bg-white rounded-2xl p-6 shadow">
            <button
              onClick={() => setModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 border rounded-xl py-3 hover:bg-gray-50"
            >
              <Plus className="w-5 h-5" />
              Conceder acesso
            </button>
          </div>

        )} */}

        {/* <AcessosConcedidosCard
          acessos={concedidos}
          loading={false}
          onRevogar={isReadOnly ? noopAsync : revogar}
          isReadOnly={isReadOnly}
        /> */}

        <AcessosConcedidosCard
          acessos={concedidos}
          loading={false}
          onRevogar={isReadOnly ? noopAsync : revogar}
          onConceder={() => setModalOpen(true)}
          isReadOnly={isReadOnly}
        />

        <AcessosRecebidosCard
          acessos={recebidos}
          loading={false}
          onAssumir={isReadOnly ? noopAsync : assumir}
          isReadOnly={isReadOnly}
        />

        {!isReadOnly && (
          <ModalConcederAcesso
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onConceder={conceder}
            loading={false}
          />
        )}

        {!isReadOnly && (
          <div className="bg-white rounded-2xl p-6 shadow">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-green-600" />
              <h2 className="text-xl font-bold">Privacidade e Dados</h2>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleExportarTudo}
                className="w-full flex items-center justify-center gap-2 border rounded-xl py-3"
              >
                <Download className="w-5 h-5" />
                Exportar meus dados
              </button>

              <button
                onClick={handleExcluirConta}
                className="w-full flex items-center justify-center gap-2 border border-red-300 text-red-700 rounded-xl py-3"
              >
                <Trash2 className="w-5 h-5" />
                Excluir minha conta
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
