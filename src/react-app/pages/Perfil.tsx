import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/react-app/components/Layout";
import { User, Save, Shield, Download, Trash2 } from "lucide-react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { useUser } from "@/hooks/useUser";

/* =========================
   Supabase Client (front)
========================= */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

/* =========================
   Tipos
========================= */

interface Usuario {
  id: string;
  nome: string | null;
  email: string | null;
  role: string;
  limite_diario_mg: number;
  timezone: string;
  consentimento_lgpd_em: string | null;
}

interface DeleteAccountResponse {
  success?: boolean;
  error?: string;
}

/* =========================
   Página
========================= */

export default function PerfilPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useUser();

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [nome, setNome] = useState("");
  const [limiteDiario, setLimiteDiario] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* Proteção de rota */
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/");
    }
  }, [authLoading, user, navigate]);

  /* Carregar perfil */
  useEffect(() => {
    if (!user) return;
    loadPerfil();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadPerfil = async () => {
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
        .eq("id", user!.id)
        .single();

      if (error) {
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

  /* Salvar alterações */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from("usuarios")
        .update({
          nome,
          limite_diario_mg: Number(limiteDiario),
          updated_at: new Date().toISOString(),
        })
        .eq("id", user!.id);

      if (error) {
        console.error("Erro ao salvar perfil:", error);
        alert("Erro ao salvar perfil");
        return;
      }

      alert("Perfil atualizado com sucesso!");
      loadPerfil();
    } finally {
      setSaving(false);
    }
  };

  const handleExportarTudo = async () => {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        alert("Usuário não autenticado");
        return;
      }

      const userId = sessionData.session.user.id;

      // Buscar perfil
      const { data: perfil, error: perfilError } = await supabase
        .from("usuarios")
        .select("*")
        .eq("id", userId)
        .single();

      if (perfilError) throw perfilError;

      // Buscar registros
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

      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error("Erro ao exportar dados:", err);
      alert("Erro ao exportar dados: " + (err?.message ?? err));
    }
  };

  /* Excluir conta usando Edge Function */
  const handleExcluirConta = async () => {
    if (!confirm("Deseja realmente excluir sua conta?")) return;

    const confirmacao = prompt('Digite "EXCLUIR" para confirmar:');
    if (confirmacao !== "EXCLUIR") {
      alert("Exclusão cancelada");
      return;
    }

    try {
      // 1️⃣ pegar sessão atual
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        alert("Usuário não autenticado");
        return;
      }

      const accessToken = sessionData.session.access_token;

      // 2️⃣ chamar Edge Function COM Authorization
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`, // ✅ OBRIGATÓRIO
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

      // 3️⃣ logout local
      await supabase.auth.signOut();
      navigate("/");

    } catch (err) {
      console.error("Erro ao excluir conta:", err);
      alert("Erro ao excluir conta");
    }
  };

  /* Loading */
  if (authLoading || loading) {
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

        {/* Informações pessoais */}
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

        {/* Privacidade */}
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
