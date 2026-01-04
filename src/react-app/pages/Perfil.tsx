import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/react-app/components/Layout";
import { User, Save, Shield, Download, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/react-app/context/AuthContext";

interface Usuario {
  id: string;
  nome: string | null;
  email: string | null;
  role: string;
  limite_diario_mg: number;
  timezone: string;
  consentimento_lgpd_em: string | null;
}

export default function PerfilPage() {
  const navigate = useNavigate();
  const { authUser, loadingAuth } = useAuth();

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [nome, setNome] = useState("");
  const [limiteDiario, setLimiteDiario] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loadingAuth && !authUser) {
      navigate("/", { replace: true });
    }
  }, [loadingAuth, authUser, navigate]);

  useEffect(() => {
    if (!authUser) return;
    loadPerfil(authUser.id);
  }, [authUser]);

  const loadPerfil = async (userId: string) => {
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select(`
          id,
          nome,
          email,
          role,
          limite_diario_mg,
          timezone,
          consentimento_lgpd_em
        `)
        .eq("id", userId)
        .single();

      if (error || !data) {
        console.error("Erro ao carregar perfil:", error);
        return;
      }

      setUsuario(data);
      setNome(data.nome ?? "");
      setLimiteDiario(data.limite_diario_mg.toString());
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authUser) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from("usuarios")
        .update({
          nome,
          limite_diario_mg: Number(limiteDiario),
          updated_at: new Date().toISOString(),
        })
        .eq("id", authUser.id);

      if (error) {
        console.error("Erro ao salvar perfil:", error);
        alert("Erro ao salvar perfil");
        return;
      }

      alert("Perfil atualizado com sucesso!");
      loadPerfil(authUser.id);
    } finally {
      setSaving(false);
    }
  };

  const handleExportarTudo = async () => {
    if (!authUser) {
      alert("Usuário não autenticado");
      return;
    }

    try {
      const { data: perfil, error: perfilError } = await supabase
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
        usuario: perfil,
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
      alert("Erro ao exportar dados: " + (err?.message ?? err));
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
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        alert("Usuário não autenticado");
        return;
      }

      const accessToken = sessionData.session.access_token;

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
        console.error("Erro ao excluir conta:", data);
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

  if (loadingAuth || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!usuario) return null;

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
                value={usuario.email ?? ""}
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

          {usuario.consentimento_lgpd_em && (
            <p className="text-sm text-green-700 mb-4">
              ✓ Consentimento LGPD em{" "}
              {new Date(usuario.consentimento_lgpd_em).toLocaleDateString(
                "pt-BR"
                )}
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
