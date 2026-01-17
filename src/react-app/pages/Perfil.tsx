import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/react-app/components/Layout";
import { User, Save, Shield, Download, Trash2 } from "lucide-react";
import { useProtectedPage } from "@/react-app/hooks/useProtectedPage";
import { usePerfil } from "@/react-app/hooks/usePerfil";
import { supabase } from "@/react-app/lib/supabase";
import { LayoutSkeleton, PerfilSkeleton } from "@skeletons";

export default function PerfilPage() {
  const navigate = useNavigate();
  const { authUser, isReady } = useProtectedPage();

  const {
    perfil,
    loading,
    saving,
    salvar,
  } = usePerfil(authUser?.id);

  const [nome, setNome] = useState("");
  const [limiteDiario, setLimiteDiario] = useState("");

  useEffect(() => {
    if (perfil) {
      setNome(perfil.nome ?? "");
      setLimiteDiario(perfil.limite_diario_mg.toString());
    }
  }, [perfil]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!perfil) return;

    await salvar({
      nome,
      limite_diario_mg: Number(limiteDiario),
    });

    alert("Perfil atualizado com sucesso!");
  };

  const handleExportarTudo = async () => {
    if (!authUser) {
      alert("Usuário não autenticado");
      return;
    }

    try {
      const { data: perfilData, error: perfilError } = await supabase
        .from("usuarios")
        .select("*")
        .eq("id", authUser.id)
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
        .eq("usuario_id", authUser.id)
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
    } catch (err: any) {
      console.error("Erro ao exportar dados:", err);
      alert("Erro ao exportar dados");
    }
  };

  const handleExcluirConta = async () => {
    if (!authUser) return;

    if (!confirm("Deseja realmente excluir sua conta?")) return;

    const confirmacao = prompt('Digite "EXCLUIR" para confirmar:');
    if (confirmacao !== "EXCLUIR") {
      alert("Exclusão cancelada");
      return;
    }

    try {
      const { data: sessionData } =
      await supabase.auth.getSession();
      
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        alert("Usuário não autenticado");
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
          },
        }
      );

      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
      };

      if (!res.ok) {
        alert("Erro ao excluir conta: " + (data.error ?? "Erro desconhecido"));
        return;
      }

      alert("Conta excluída com sucesso!");
      await supabase.auth.signOut().catch(() => {});
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Erro ao excluir conta:", err);
      alert("Erro ao excluir conta");
    }
  };

  if (!isReady || loading) {
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
        <div>
          <h1 className="text-3xl font-bold">Perfil</h1>
          <p className="text-gray-600">Gerencie suas informações pessoais</p>
        </div>

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
                className="w-full px-4 py-3 rounded-xl border"
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
                className="w-full px-4 py-3 rounded-xl border"
                required
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
            >
              <Save className="inline w-4 h-4 mr-2" />
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-bold">Privacidade e Dados</h2>
          </div>

          {perfil.consentimento_lgpd_em && (
            <p className="text-sm text-green-700 mb-4">
              ✓ Consentimento LGPD em{" "}
              {new Date(perfil.consentimento_lgpd_em).toLocaleDateString("pt-BR")}
            </p>
          )}

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
      </div>
    </Layout>
  );
}
