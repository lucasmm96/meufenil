import { useEffect, useState } from "react";
import { useAuth } from "@getmocha/users-service/react";
import { useNavigate } from "react-router";
import Layout from "@/react-app/components/Layout";
import { User, Save, Shield, Download, Trash2 } from "lucide-react";

interface Usuario {
  id: number;
  nome: string;
  email: string;
  limite_diario_mg: number;
  role: string;
  consentimento_lgpd_em: string | null;
}

export default function PerfilPage() {
  const { user, isPending, logout } = useAuth();
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [nome, setNome] = useState("");
  const [limiteDiario, setLimiteDiario] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isPending && !user) {
      navigate("/");
    }
  }, [user, isPending, navigate]);

  useEffect(() => {
    if (user) {
      loadPerfil();
    }
  }, [user]);

  const loadPerfil = async () => {
    try {
      const res = await fetch("/api/usuarios/perfil");
      const data = await res.json();
      setUsuario(data);
      setNome(data.nome);
      setLimiteDiario(data.limite_diario_mg.toString());
    } catch (error) {
      console.error("Erro ao carregar perfil:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/usuarios/perfil", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome,
          limite_diario_mg: parseFloat(limiteDiario),
        }),
      });

      if (res.ok) {
        alert("Perfil atualizado com sucesso!");
        loadPerfil();
      }
    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
      alert("Erro ao salvar perfil");
    } finally {
      setSaving(false);
    }
  };

  const handleExportarTudo = async () => {
    try {
      const res = await fetch("/api/exportar/json");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meufenil-dados-completos-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Erro ao exportar dados:", error);
      alert("Erro ao exportar dados");
    }
  };

  const handleExcluirConta = async () => {
    if (!confirm(
      "ATENÇÃO: Esta ação é irreversível!\n\n" +
      "Ao excluir sua conta:\n" +
      "- Todos os seus registros serão permanentemente deletados\n" +
      "- Suas referências pessoais serão removidas\n" +
      "- Você não poderá recuperar esses dados\n\n" +
      "Recomendamos exportar seus dados antes de continuar.\n\n" +
      "Deseja realmente excluir sua conta?"
    )) return;

    const confirmacao = prompt(
      'Digite "EXCLUIR" (em maiúsculas) para confirmar a exclusão da conta:'
    );

    if (confirmacao !== "EXCLUIR") {
      alert("Exclusão cancelada");
      return;
    }

    try {
      // Exportar dados antes de excluir
      await handleExportarTudo();
      
      // Aguardar um pouco para garantir o download
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Aqui você implementaria a rota de exclusão no backend
      // Por enquanto, apenas fazemos logout
      alert("Seus dados foram exportados. Entre em contato com o suporte para concluir a exclusão da conta.");
      await logout();
      navigate("/");
    } catch (error) {
      console.error("Erro ao excluir conta:", error);
      alert("Erro ao excluir conta");
    }
  };

  if (isPending || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!usuario) return null;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Perfil</h1>
          <p className="text-gray-600 mt-1">Gerencie suas informações pessoais</p>
        </div>

        {/* Informações do Perfil */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
              <User className="w-6 h-6 text-indigo-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Informações Pessoais</h2>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                E-mail
              </label>
              <input
                type="email"
                value={usuario.email}
                disabled
                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-gray-50 text-gray-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                O e-mail não pode ser alterado
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Limite Diário de Fenilalanina (mg)
              </label>
              <input
                type="number"
                step="0.01"
                value={limiteDiario}
                onChange={(e) => setLimiteDiario(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Consulte seu médico ou nutricionista para definir o valor adequado
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              {saving ? "Salvando..." : "Salvar Alterações"}
            </button>
          </form>
        </div>

        {/* LGPD */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Privacidade e Dados</h2>
          </div>

          <div className="space-y-4">
            {usuario.consentimento_lgpd_em && (
              <div className="p-4 bg-green-50 rounded-xl">
                <p className="text-sm text-green-900">
                  ✓ Consentimento LGPD fornecido em{" "}
                  {new Date(usuario.consentimento_lgpd_em).toLocaleDateString("pt-BR")}
                </p>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleExportarTudo}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              >
                <Download className="w-5 h-5" />
                Exportar Todos os Meus Dados
              </button>

              <button
                onClick={handleExcluirConta}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-50 border border-red-300 text-red-700 rounded-xl font-semibold hover:bg-red-100 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
                Excluir Minha Conta
              </button>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl">
              <h3 className="font-semibold text-gray-900 mb-2">Seus Direitos</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Acessar todos os seus dados a qualquer momento</li>
                <li>• Exportar seus dados em formato legível</li>
                <li>• Solicitar a correção de dados incorretos</li>
                <li>• Solicitar a exclusão completa de sua conta</li>
                <li>• Revogar consentimento para processamento de dados</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
