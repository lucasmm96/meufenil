import { useEffect, useMemo, useState } from "react";
import Layout from "@/react-app/components/Layout";
import {
  Users,
  Shield,
  HardDrive,
  FileText,
  Package,
  Database,
  AlertCircle,
  Activity,
  AlertTriangle,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { useAuth } from "@/react-app/context/AuthContext";
import { useAdmin } from "@/react-app/hooks/useAdmin";
import { useBackgroundJobsAdmin } from "@/react-app/hooks/useBackgroundJobsAdmin";
import { CURRENT_APP_ENVIRONMENT } from "@/react-app/lib/app-environment";
import { LayoutSkeleton, AdminSkeleton } from "@skeletons";
import {
  BackgroundJobExecutionDTO,
  BackgroundJobOverviewDTO,
} from "@/react-app/services/dtos/background-jobs.dto";

const ADMIN_TIMEZONE = "America/Sao_Paulo";

function formatAdminDateTime(value?: string | null) {
  if (!value) return "—";
  return formatInTimeZone(new Date(value), ADMIN_TIMEZONE, "dd/MM/yyyy 'às' HH:mm");
}

function formatDuration(ms?: number | null) {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 10000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms / 1000)} s`;
}

function statusLabel(status: BackgroundJobExecutionDTO["status"]) {
  switch (status) {
    case "success":
      return "Sucesso";
    case "failure":
      return "Falha";
    case "partial":
      return "Parcial";
    default:
      return status;
  }
}

function statusStyles(status: BackgroundJobExecutionDTO["status"]) {
  switch (status) {
    case "success":
      return "bg-emerald-100 text-emerald-800";
    case "failure":
      return "bg-red-100 text-red-800";
    case "partial":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function isFresh(value?: string | null, maxHours = 36) {
  if (!value) return false;
  return Date.now() - new Date(value).getTime() <= maxHours * 60 * 60 * 1000;
}

export default function Admin() {
  const { authUser } = useAuth();
  const { perfilUsuario, usuarios, estatisticasDB, loading } = useAdmin(authUser?.id);

  const isAdmin = perfilUsuario?.role === "admin";
  const jobs = useBackgroundJobsAdmin(authUser?.id, isAdmin);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);

  const totalUsuarios = usuarios.length;
  const totalAdmins = useMemo(
    () => usuarios.filter((usuario) => usuario.role === "admin").length,
    [usuarios],
  );
  const totalUsers = totalUsuarios - totalAdmins;

  const summaryTotals = useMemo(
    () =>
      jobs.overview.reduce(
        (acc, item) => ({
          total: acc.total + item.total_count,
          success: acc.success + item.success_count,
          failure: acc.failure + item.failure_count,
          partial: acc.partial + item.partial_count,
        }),
        { total: 0, success: 0, failure: 0, partial: 0 },
      ),
    [jobs.overview],
  );

  const currentEnvironmentLabel = CURRENT_APP_ENVIRONMENT.toUpperCase();

  const keepaliveCurrent = useMemo(
    () => jobs.overview.find((item) => item.job_key === "keepalive") ?? null,
    [jobs.overview],
  );

  const latestOverview = jobs.overview[0] ?? null;

  const selectedExecution =
    jobs.executions.find((execution) => execution.id === selectedExecutionId) ??
    jobs.executions[0] ??
    null;

  useEffect(() => {
    if (!jobs.executions.length) {
      setSelectedExecutionId(null);
      return;
    }

    if (!selectedExecutionId || !jobs.executions.some((execution) => execution.id === selectedExecutionId)) {
      setSelectedExecutionId(jobs.executions[0].id);
    }
  }, [jobs.executions, selectedExecutionId]);

  const overallHealthy =
    Boolean(keepaliveCurrent) &&
    keepaliveCurrent?.last_status === "success" &&
    isFresh(keepaliveCurrent?.last_started_at);

  const overallLabel = !latestOverview
    ? "Sem dados"
    : overallHealthy
      ? "Saudável"
      : keepaliveCurrent?.last_status === "failure"
        ? "Falha recente"
        : "Atenção";

  const overallStatusTone = !latestOverview
    ? "bg-gray-100 text-gray-700"
    : overallHealthy
      ? "bg-emerald-100 text-emerald-800"
      : keepaliveCurrent?.last_status === "failure"
        ? "bg-red-100 text-red-800"
        : "bg-amber-100 text-amber-800";

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Painel Administrativo</h1>
            <p className="text-gray-600 mt-1">Gerenciar usuários, sistema e monitoramento</p>
          </div>

          <div className="inline-flex items-center gap-2 self-start rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Ambiente atual: {currentEnvironmentLabel}
          </div>
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
                      className={`h-full rounded-full transition-all ${
                        estatisticasDB.armazenamento.percentual_usado > 80
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
                <p className="text-3xl font-bold text-gray-900">{estatisticasDB.registros.toLocaleString("pt-BR")}</p>
                <p className="text-sm text-gray-600 mt-2">Consumos registrados por todos os usuários</p>
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
                    <h3 className="font-semibold text-blue-900 mb-2">Limites do Plano Gratuito (Supabase)</h3>

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

        <section className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Monitoramento de Jobs</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Acompanhe o keepalive e outras execuções do ambiente atual com histórico e filtros.
                </p>
              </div>

              <button
                onClick={jobs.reload}
                className="inline-flex items-center justify-center gap-2 w-full lg:w-auto px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${jobs.loading ? "animate-spin" : ""}`} />
                Atualizar
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <SummaryJobCard
                title="Saúde geral"
                row={latestOverview}
                overall
                healthy={overallHealthy}
                label={overallLabel}
                tone={overallStatusTone}
                environmentLabel={currentEnvironmentLabel}
              />

              <SummaryJobCard
                title="Keepalive atual"
                row={keepaliveCurrent}
                accentClassName="bg-slate-50 border-slate-200"
                environmentLabel={currentEnvironmentLabel}
              />

              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Período filtrado</p>
                    <h3 className="font-semibold text-gray-900">Resumo das execuções</h3>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                  <MetricValue label="Total" value={summaryTotals.total.toString()} />
                  <MetricValue label="Sucesso" value={summaryTotals.success.toString()} tone="text-emerald-700" />
                  <MetricValue label="Falha" value={summaryTotals.failure.toString()} tone="text-red-700" />
                  <MetricValue label="Parcial" value={summaryTotals.partial.toString()} tone="text-amber-700" />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 lg:p-5">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="w-4 h-4 text-slate-600" />
                <h3 className="font-semibold text-slate-900">Filtros</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <SelectField
                  label="Job"
                  value={jobs.filters.jobKey}
                  onChange={(value) => jobs.setFilters({ jobKey: value })}
                  options={[
                    { value: "keepalive", label: "keepalive" },
                    { value: "all", label: "Todos os jobs" },
                  ]}
                />

                <SelectField
                  label="Status"
                  value={jobs.filters.status}
                  onChange={(value) =>
                    jobs.setFilters({ status: value as "all" | "success" | "failure" | "partial" })
                  }
                  options={[
                    { value: "all", label: "Todos" },
                    { value: "success", label: "Sucesso" },
                    { value: "failure", label: "Falha" },
                    { value: "partial", label: "Parcial" },
                  ]}
                />

                <SelectField
                  label="Período"
                  value={String(jobs.filters.periodDays)}
                  onChange={(value) => jobs.setFilters({ periodDays: Number(value) })}
                  options={[
                    { value: "7", label: "7 dias" },
                    { value: "30", label: "30 dias" },
                    { value: "90", label: "90 dias" },
                  ]}
                />
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">Histórico das execuções</h3>
                  <p className="text-sm text-gray-600">
                    {jobs.total} execução(ões) encontradas. Página {jobs.page} de {jobs.totalPages}.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => jobs.setPage(Math.max(1, jobs.page - 1))}
                    disabled={jobs.page <= 1 || jobs.loading}
                    className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Anterior
                  </button>

                  <button
                    onClick={() => jobs.setPage(Math.min(jobs.totalPages, jobs.page + 1))}
                    disabled={jobs.page >= jobs.totalPages || jobs.loading}
                    className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Próxima
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {jobs.error && (
                <div className="m-4 bg-red-50 border-l-4 border-red-500 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-red-900">Erro ao carregar jobs</h4>
                      <p className="text-sm text-red-700 mt-1">{jobs.error.message}</p>
                    </div>
                  </div>
                </div>
              )}

              {!jobs.error && jobs.executions.length === 0 && !jobs.loading ? (
                <div className="p-8 text-center">
                  <Activity className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <h4 className="font-semibold text-gray-900">Nenhuma execução encontrada</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Ajuste os filtros ou aguarde novas execuções dos jobs em background.
                  </p>
                </div>
              ) : (
                <>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Execução</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duração</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mensagem</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {jobs.executions.map((execution) => (
                          <tr
                            key={execution.id}
                            onClick={() => setSelectedExecutionId(execution.id)}
                            className={`cursor-pointer hover:bg-gray-50 ${
                              selectedExecution?.id === execution.id ? "bg-indigo-50/60" : ""
                            }`}
                          >
                            <td className="px-6 py-4">
                              <div className="font-medium text-gray-900">
                                {formatAdminDateTime(execution.started_at)}
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatAdminDateTime(execution.finished_at)}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{execution.job_key}</td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusStyles(execution.status)}`}>
                                {statusLabel(execution.status)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {formatDuration(execution.duration_ms)}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                              <div className="truncate">{execution.message}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="md:hidden p-4 space-y-4">
                    {jobs.executions.map((execution) => (
                      <button
                        key={execution.id}
                        onClick={() => setSelectedExecutionId(execution.id)}
                        className={`w-full text-left bg-gray-50 rounded-xl p-4 space-y-3 border ${
                          selectedExecution?.id === execution.id ? "border-indigo-400" : "border-transparent"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-gray-900">{execution.job_key}</p>
                            <p className="text-xs text-gray-500">{formatAdminDateTime(execution.started_at)}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusStyles(execution.status)}`}>
                            {statusLabel(execution.status)}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-gray-600">Duração: {formatDuration(execution.duration_ms)}</span>
                        </div>

                        <p className="text-sm text-gray-700">{execution.message}</p>
                      </button>
                    ))}
                  </div>

                  {selectedExecution && (
                    <div className="border-t border-gray-200 bg-slate-50 p-4 sm:p-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-sm text-gray-500">Detalhes da execução</p>
                              <h4 className="text-lg font-semibold text-gray-900">{selectedExecution.job_key}</h4>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusStyles(selectedExecution.status)}`}>
                              {statusLabel(selectedExecution.status)}
                            </span>
                          </div>

                          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 text-sm">
                            <DetailItem label="Ambiente atual" value={currentEnvironmentLabel} />
                            <DetailItem label="Run ID" value={selectedExecution.run_id} mono />
                            <DetailItem label="Início" value={formatAdminDateTime(selectedExecution.started_at)} />
                            <DetailItem label="Fim" value={formatAdminDateTime(selectedExecution.finished_at)} />
                            <DetailItem label="Duração" value={formatDuration(selectedExecution.duration_ms)} />
                            <DetailItem label="Criado em" value={formatAdminDateTime(selectedExecution.created_at)} />
                          </dl>

                          <div className="mt-5">
                            <h5 className="text-sm font-semibold text-gray-900 mb-2">Mensagem</h5>
                            <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 border border-gray-200">
                              {selectedExecution.message}
                            </p>
                          </div>
                        </div>

                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
                          <h5 className="text-sm font-semibold text-gray-900 mb-3">Metadata</h5>
                          <pre className="text-xs bg-gray-950 text-gray-100 rounded-2xl p-4 overflow-auto max-h-80 whitespace-pre-wrap break-words">
                            {JSON.stringify(selectedExecution.details, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

      </div>
    </Layout>
  );
}

function SummaryJobCard({
  title,
  row,
  accentClassName,
  overall = false,
  healthy = false,
  label,
  tone,
  environmentLabel,
}: {
  title: string;
  row: BackgroundJobOverviewDTO | null;
  accentClassName?: string;
  overall?: boolean;
  healthy?: boolean;
  label?: string;
  tone?: string;
  environmentLabel?: string;
}) {
  if (overall) {
    return (
      <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-300">{title}</p>
            <p className="text-2xl font-bold mt-2">{label ?? "Sem dados"}</p>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${tone ?? "bg-gray-100 text-gray-700"}`}>
            {label ?? "Sem dados"}
          </div>
        </div>

        <div className="mt-4 space-y-1 text-sm text-slate-300">
          <p>Status atual: {healthy ? "Executando dentro do esperado" : "Requer atenção"}</p>
          <p>Última execução: {formatAdminDateTime(row?.last_started_at ?? null)}</p>
          <p>Ambiente: {environmentLabel ?? "—"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`border rounded-2xl p-5 shadow-sm ${accentClassName ?? "bg-white border-gray-200"}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <h3 className="font-semibold text-gray-900 mt-1">
            {row ? (row.last_status === "success" ? "Operando normalmente" : "Atenção necessária") : "Sem dados"}
          </h3>
        </div>

        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${row ? statusStyles(row.last_status) : "bg-gray-100 text-gray-700"}`}>
          {row ? statusLabel(row.last_status) : "Sem dados"}
        </span>
      </div>

      {row ? (
        <div className="mt-4 space-y-2 text-sm text-gray-700">
          <p><strong>Última execução:</strong> {formatAdminDateTime(row.last_started_at)}</p>
          <p><strong>Duração:</strong> {formatDuration(row.last_duration_ms)}</p>
          <p><strong>Total no período:</strong> {row.total_count}</p>
          <p className="text-xs text-gray-500">Ambiente: {environmentLabel ?? row.environment.toUpperCase()}</p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-600">
          Nenhum registro encontrado para este job no período selecionado.
        </p>
      )}
    </div>
  );
}

function MetricValue({
  label,
  value,
  tone = "text-gray-900",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`text-xl font-bold mt-1 ${tone}`}>{value}</p>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-2">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DetailItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className={`mt-1 text-sm font-medium text-gray-900 ${mono ? "font-mono break-all" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
