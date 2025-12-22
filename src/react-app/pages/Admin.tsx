import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/react-app/components/Layout";
import { Shield, Users, Database, AlertCircle, Upload, Download, FileText, HardDrive, Package } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useUser } from "@/hooks/useUser";

interface UsuarioAdmin {
  id: number;
  nome: string;
  email: string;
  role: "user" | "admin";
  limite_diario_mg: number;
  created_at: string;
}

interface EstatisticasDB {
  usuarios: number;
  referencias: {
    total: number;
    globais: number;
    personalizadas: number;
  };
  registros: number;
  armazenamento: {
    estimado_mb: number;
    limite_gratuito_mb: number;
    percentual_usado: number;
  };
}

type EstatisticasAdminRPC = {
  tamanho_db_mb: number;
  registros_totais: number;
  referencias_total: number;
  referencias_globais: number;
  referencias_personalizadas: number;
};

type UserWithEmail = {
  email?: string;
};

export default function AdminPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useUser();

  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [perfilUsuario, setPerfilUsuario] = useState<UsuarioAdmin | null>(null);
  const [estatisticasDB, setEstatisticasDB] =
    useState<EstatisticasDB | null>(null);

  const [loading, setLoading] = useState(true);
  const [csvText, setCsvText] = useState("");
  const [importando, setImportando] = useState(false);
  const [resultadoImportacao, setResultadoImportacao] = useState<{
    importados: number;
    erros: string[];
    total: number;
  } | null>(null);


  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate("/");
      return;
    }

    carregarAdmin();
  }, [authLoading, user]);

  async function carregarAdmin() {
    try {
      setLoading(true);

      /* Perfil */
      const { data: perfil, error: perfilError } = await supabase
        .from("usuarios")
        .select("*")
        .eq("id", user!.id)
        .single();

      if (perfilError || !perfil) {
        navigate("/dashboard");
        return;
      }

      setPerfilUsuario(perfil);

      if (perfil.role !== "admin") {
        navigate("/dashboard");
        return;
      }

      const { data: usuariosData } = await supabase
        .from("usuarios")
        .select("*")
        .order("created_at", { ascending: false });

      setUsuarios(usuariosData || []);

      const { data: stats, error: statsError } = await supabase
        .rpc("get_estatisticas_admin")
        .single<EstatisticasAdminRPC>();

      if (statsError || !stats) return;

      const LIMITE_MB = 500;
      const percentual = Math.min(
        (stats.tamanho_db_mb / LIMITE_MB) * 100,
        100
      );

      setEstatisticasDB({
        usuarios: usuariosData?.length || 0,
        registros: stats.registros_totais,
        referencias: {
          total: stats.referencias_total,
          globais: stats.referencias_globais,
          personalizadas: stats.referencias_personalizadas,
        },
        armazenamento: {
          estimado_mb: stats.tamanho_db_mb,
          limite_gratuito_mb: LIMITE_MB,
          percentual_usado: percentual,
        },
      });
    } finally {
      setLoading(false);
    }
  }


  const handleToggleRole = async (id: number, role: string) => {
    const novoRole = role === "admin" ? "user" : "admin";

    if (!confirm(`Alterar papel para ${novoRole}?`)) return;

    await supabase.from("usuarios").update({ role: novoRole }).eq("id", id);
    carregarAdmin();
  };

  const [houveAtualizacoes, setHouveAtualizacoes] = useState(false);

  const handleImportarCsv = async () => {
    if (!csvText.trim()) return;

    setImportando(true);
    setResultadoImportacao(null);
    setHouveAtualizacoes(false);

    const erros: string[] = [];
    let importados = 0;

    try {
      // Remove BOM e normaliza
      const texto = csvText.replace(/^\uFEFF/, "").trim();

      const linhas = texto.split(/\r?\n/).filter(l => l.trim());
      if (linhas.length === 0) {
        setResultadoImportacao({ importados: 0, erros: ["CSV vazio"], total: 0 });
        return;
      }

      // Detecta separador automaticamente
      const separador = linhas[0].includes(";") ? ";" : ",";

      // Remove cabeçalho se existir
      const inicio = linhas[0].toLowerCase().includes("nome")
        ? 1
        : 0;

      const registros: {
        nome: string;
        fenil_mg_por_100g: number;
        is_global: boolean;
        nome_normalizado?: string;
      }[] = [];

      for (let i = inicio; i < linhas.length; i++) {
        const linha = linhas[i];
        const [nomeRaw, fenilRaw] = linha.split(separador);

        if (!nomeRaw || !fenilRaw) {
          erros.push(`Linha ${i + 1}: formato inválido`);
          continue;
        }

        const nome = nomeRaw.trim();
        const fenil = Number(fenilRaw.replace(",", "."));

        if (!nome) {
          erros.push(`Linha ${i + 1}: nome vazio`);
          continue;
        }

        if (isNaN(fenil) || fenil < 0) {
          erros.push(`Linha ${i + 1}: valor de fenilalanina inválido`);
          continue;
        }

        registros.push({
          nome,
          fenil_mg_por_100g: fenil,
          is_global: true,
          nome_normalizado: nome
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim(),
        });
      }

      if (registros.length === 0) {
        setResultadoImportacao({
          importados: 0,
          erros,
          total: linhas.length - inicio,
        });
        return;
      }

      /**
       * 🔍 DETECTA SE JÁ EXISTEM REGISTROS
       */
      const nomesNormalizados = registros.map(r => r.nome_normalizado!);

      const { data: existentes, error: erroConsulta } = await supabase
        .from("referencias")
        .select("nome_normalizado")
        .in("nome_normalizado", nomesNormalizados);

      if (erroConsulta) {
        throw erroConsulta;
      }

      if (existentes && existentes.length > 0) {
        setHouveAtualizacoes(true);
      }

      /**
       * UPSERT
       */
      const { error } = await supabase
        .from("referencias")
        .upsert(registros, {
          onConflict: "nome_normalizado",
        });

      if (error) {
        throw error;
      }

      importados = registros.length;

      setResultadoImportacao({
        importados,
        erros,
        total: linhas.length - inicio,
      });

      if (importados > 0) {
        setCsvText("");
      }
    } catch (error: any) {
      console.error("Erro ao importar CSV:", error);
      erros.push("Erro inesperado ao importar CSV");
      setResultadoImportacao({
        importados: 0,
        erros,
        total: 0,
      });
    } finally {
      setImportando(false);
    }
  };

  const handleBaixarModelo = () => {
    const csvContent =
      "\uFEFF" +
      "nome;fenil_mg_por_100g\n" +
      "Arroz branco cozido;80\n" +
      "Feijão preto cozido;140\n" +
      "Peito de frango;850\n";

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-referencias.csv";
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!perfilUsuario || perfilUsuario.role !== "admin") {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 border-l-4 border-red-500 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
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

  const totalUsuarios = usuarios.length;
  const totalAdmins = usuarios.filter((u) => u.role === "admin").length;
  const totalUsers = usuarios.filter((u) => u.role === "user").length;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Painel Administrativo</h1>
          <p className="text-gray-600 mt-1">Gerenciar usuários e sistema</p>
        </div>

        {/* Estatísticas de Usuários */}
        <div className="grid md:grid-cols-3 gap-6">
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

        {/* Estatísticas do Banco de Dados */}
        {estatisticasDB && (
          <>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Uso do Banco de Dados</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Armazenamento */}
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
                  {estatisticasDB.armazenamento.percentual_usado > 80 && (
                    <p className="text-xs text-red-600 mt-2">
                      ⚠️ Atenção: Armazenamento acima de 80%. Considere excluir dados antigos.
                    </p>
                  )}
                </div>
              </div>

              {/* Registros */}
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

              {/* Referências */}
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

              {/* Informações sobre limites */}
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

        {/* Lista de Usuários */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Usuários do Sistema</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuário
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Limite Diário
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Papel
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cadastro
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {usuarios.map((usuario) => (
                  <tr key={usuario.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {usuario.nome}
                        </div>
                        <div className="text-sm text-gray-500">{usuario.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {usuario.limite_diario_mg.toFixed(0)} mg
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${usuario.role === "admin"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-green-100 text-green-800"
                          }`}
                      >
                        {usuario.role === "admin" ? "Admin" : "Usuário"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(usuario.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleToggleRole(usuario.id, usuario.role)}
                        disabled={usuario.email === (user as UserWithEmail | null)?.email}
                        className={`font-medium ${usuario.email === user?.email
                          ? "text-gray-400 cursor-not-allowed"
                          : "text-indigo-600 hover:text-indigo-900"
                          }`}
                      >
                        {usuario.role === "admin" ? "Remover Admin" : "Tornar Admin"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Importação de Referências */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Importação em Massa de Referências
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Adicione múltiplas referências de alimentos de uma só vez via CSV
                </p>
              </div>
              <button
                onClick={handleBaixarModelo}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Baixar Modelo
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cole o conteúdo do CSV
              </label>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="nome,fenil_mg_por_100g&#10;Arroz branco cozido,80&#10;Feijão preto cozido,140&#10;Peito de frango,850"
                rows={10}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-2">
                Formato: <code>nome,fenil_mg_por_100g</code> (uma referência por linha)
              </p>
            </div>

            <button
              onClick={handleImportarCsv}
              disabled={importando || !csvText.trim()}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {importando ? (
                <>
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Importar Referências
                </>
              )}
            </button>

            {resultadoImportacao && (
              <div className={`p-4 rounded-xl ${resultadoImportacao.erros.length === 0
                ? "bg-green-50 border-l-4 border-green-500"
                : "bg-yellow-50 border-l-4 border-yellow-500"
                }`}>
                <div className="flex items-start gap-3">
                  <FileText className={`w-5 h-5 flex-shrink-0 mt-0.5 ${resultadoImportacao.erros.length === 0
                    ? "text-green-600"
                    : "text-yellow-600"
                    }`} />
                  <div className="flex-1">
                    <h3
                      className={`font-semibold ${resultadoImportacao.erros.length === 0
                          ? "text-green-900"
                          : "text-yellow-900"
                        }`}
                    >
                      Importação Concluída
                    </h3>

                    <p
                      className={`text-sm mt-1 ${resultadoImportacao.erros.length === 0
                          ? "text-green-700"
                          : "text-yellow-700"
                        }`}
                    >
                      {resultadoImportacao.importados} de {resultadoImportacao.total} referências importadas com sucesso
                    </p>

                    {houveAtualizacoes && resultadoImportacao.erros.length === 0 && (
                      <p className="text-xs text-green-600 mt-1">
                        Algumas referências já existentes foram atualizadas com os novos valores.
                      </p>
                    )}

                    {resultadoImportacao.erros.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-yellow-900">
                          Erros encontrados:
                        </p>
                        <ul className="text-xs text-yellow-700 mt-1 space-y-1 max-h-32 overflow-y-auto">
                          {resultadoImportacao.erros.map((erro, idx) => (
                            <li key={idx}>• {erro}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-blue-50 border-l-4 border-blue-500 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-blue-900 text-sm">Dicas para Importação</h4>
                  <ul className="text-xs text-blue-700 mt-2 space-y-1">
                    <li>• As referências importadas serão marcadas como globais (visíveis para todos)</li>
                    <li>• Se uma referência já existir, ela será atualizada com o novo valor</li>
                    <li>• O valor de fenilalanina deve ser em mg por 100g de alimento</li>
                    <li>• Você pode incluir ou não uma linha de cabeçalho no CSV</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

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
