import { useMemo } from "react";
import Layout from "@/react-app/components/Layout";
import { Users, Shield, HardDrive, FileText, Package, Database, AlertCircle } from "lucide-react";
import { useAuth } from "@/react-app/context/AuthContext";
import { useAdmin } from "@/react-app/hooks/useAdmin";
import { LayoutSkeleton, AdminSkeleton } from "@skeletons";

export default function Admin() {
  const { authUser } = useAuth();
  const {
    perfilUsuario,
    usuarios,
    estatisticasDB,
    loading,
  } = useAdmin(authUser?.id);

  const totalUsuarios = usuarios.length;

  const totalAdmins = useMemo(
    () => usuarios.filter((u) => u.role === "admin").length,
    [usuarios],
  );

  const totalUsers = totalUsuarios - totalAdmins;

  if (loading) {
    return (
      <LayoutSkeleton>
        <AdminSkeleton />
      </LayoutSkeleton>
    );
  }

  if (!perfilUsuario || perfilUsuario.role !== "admin") {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 border-l-4 border-red-500 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900">Acesso Negado</h3>
                <p className="text-sm text-red-700 mt-1">
                  Você não tem permissão para acessar o painel administrativo.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Painel Administrativo</h1>
          <p className="text-gray-600 mt-1">Gerenciar usuários e sistema</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Total de Usuários</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900">{totalUsuarios}</p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Administradores</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900">{totalAdmins}</p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Usuários Comuns</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900">{totalUsers}</p>
          </div>
        </div>

        {estatisticasDB && (
          <>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Uso do Banco de Dados</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <HardDrive className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">Armazenamento</h3>
                    <p className="text-sm text-gray-600">
                      {estatisticasDB.armazenamento.estimado_mb.toFixed(2)} MB de {estatisticasDB.armazenamento.limite_gratuito_mb} MB
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Plano gratuito</span>
                    <span className="font-semibold text-gray-900">
                      {estatisticasDB.armazenamento.percentual_usado.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${estatisticasDB.armazenamento.percentual_usado > 80
                        ? "bg-red-500"
                        : estatisticasDB.armazenamento.percentual_usado > 60
                          ? "bg-yellow-500"
                          : "bg-green-500"
                        }`}
                      style={{ width: `${Math.min(estatisticasDB.armazenamento.percentual_usado, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center">
                    <FileText className="w-6 h-6 text-cyan-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Registros Totais</h3>
                </div>
                <p className="text-3xl font-bold text-gray-900">{estatisticasDB.registros.toLocaleString('pt-BR')}</p>
                <p className="text-sm text-gray-600 mt-2">
                  Consumos registrados por todos os usuários
                </p>
              </div>

              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
                    <Package className="w-6 h-6 text-teal-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Referências de Alimentos</h3>
                </div>
                <p className="text-3xl font-bold text-gray-900">{estatisticasDB.referencias.total}</p>
                <div className="flex gap-4 mt-3 text-sm">
                  <div>
                    <span className="text-gray-600">Globais: </span>
                    <span className="font-semibold text-teal-700">{estatisticasDB.referencias.globais}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Personalizadas: </span>
                    <span className="font-semibold text-teal-700">{estatisticasDB.referencias.personalizadas}</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-500 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <Database className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-blue-900 mb-2">
                      Limites do Plano Gratuito (Supabase)
                    </h3>

                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• Banco de dados: 500 MB</li>
                      <li>• Storage de arquivos: 1 GB</li>
                      <li>• Autenticação: até ~50.000 usuários ativos/mês</li>
                    </ul>

                    <p className="text-xs text-blue-600 mt-3">
                      Os limites de leitura e escrita não são fixos e variam conforme o uso
                      e a infraestrutura do Supabase.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900">Backup e Manutenção</h3>
              <p className="text-sm text-blue-700 mt-1">
                Registros com mais de 12 meses são arquivados automaticamente.
                Os dados dos usuários são protegidos conforme a LGPD.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
