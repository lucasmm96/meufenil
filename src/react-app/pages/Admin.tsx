import { useEffect, useMemo, useState, type FormEvent } from "react";
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
  MessageSquare,
  Play,
  History,
  ClipboardList,
  ScrollText,
  ArchiveRestore,
  Undo2,
  X,
  GitCompareArrows,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { useAuth } from "@/react-app/context/AuthContext";
import { useAdmin } from "@/react-app/hooks/useAdmin";
import { useBackgroundJobsAdmin } from "@/react-app/hooks/useBackgroundJobsAdmin";
import { useReferenciasSyncAdmin } from "@/react-app/hooks/useReferenciasSyncAdmin";
import ModalMensagemExecucao from "@/react-app/components/ModalMensagemExecucao";
import { CURRENT_APP_ENVIRONMENT } from "@/react-app/lib/app-environment";
import { LayoutSkeleton, AdminSkeleton } from "@skeletons";
import {
  BackgroundJobExecutionDTO,
  BackgroundJobOverviewDTO,
} from "@/react-app/services/dtos/background-jobs.dto";
import type {
  BackupSyncDTO,
  DiffCampoSyncDTO,
  EventoSyncDTO,
  PendenciaSyncDTO,
  ReferenciaSyncDTO,
  SyncEventoTipo,
  SyncPendenciaStatus,
  SyncPendenciaTipo,
  SyncStatus,
} from "@/react-app/services/dtos/referencias-sync.dto";

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

function executionCountLabel(total: number) {
  return total === 1 ? "1 execução encontrada." : `${total} execuções encontradas.`;
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
  const referenciasSync = useReferenciasSyncAdmin(authUser?.id, isAdmin);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [mensagemExecucao, setMensagemExecucao] = useState<BackgroundJobExecutionDTO | null>(null);

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
              <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Histórico das execuções</h3>
                <p className="text-sm text-gray-600 mt-1">{executionCountLabel(jobs.total)}</p>
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
                            <td className="px-6 py-4">
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setMensagemExecucao(execution);
                                }}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                Ver mensagem
                              </button>
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
                      </button>
                    ))}
                  </div>

                  {jobs.executions.length > 0 && (
                    <div className="border-t border-gray-200 px-5 sm:px-6 py-4">
                      <div className="flex flex-col sm:grid sm:grid-cols-3 items-center gap-3">
                        <p className="text-sm text-gray-600">
                          Página {jobs.page} de {jobs.totalPages}
                        </p>

                        <div className="flex items-center justify-center gap-2">
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

                        <div className="flex items-center justify-center sm:justify-end gap-2">
                          <label htmlFor="page-size" className="text-xs font-medium text-gray-500">Item por página</label>
                          <select
                            id="page-size"
                            value={String(jobs.pageSize)}
                            onChange={(e) => jobs.setPageSize(Number(e.target.value))}
                            disabled={jobs.loading}
                            className="px-2 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          >
                            <option value="3">3</option>
                            <option value="10">10</option>
                            <option value="20">20</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

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

        <SecaoSincronizacaoReferencias data={referenciasSync} />

        {mensagemExecucao && (
          <ModalMensagemExecucao
            execution={mensagemExecucao}
            onClose={() => setMensagemExecucao(null)}
          />
        )}
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

// ===========================================================================
// Seção "Sincronização de Referências" (FEAT-0017 M6 — design §15)
// ===========================================================================

type AbaSincronizacao = "historico" | "pendencias" | "auditoria" | "recuperacao";

type SyncAdminData = ReturnType<typeof useReferenciasSyncAdmin>;

type IdentidadeSync = { nome: string; marca: string; fenil_mg_por_100g: number };

const ABAS_SINCRONIZACAO: Array<{ id: AbaSincronizacao; label: string }> = [
  { id: "historico", label: "Histórico" },
  { id: "pendencias", label: "Pendências de curadoria" },
  { id: "auditoria", label: "Auditoria" },
  { id: "recuperacao", label: "Recuperação" },
];

const SYNC_STATUS_LABELS_OPCOES: Array<{ value: string; label: string }> = [
  { value: "running", label: "Executando" },
  { value: "success", label: "Sucesso" },
  { value: "pending_review", label: "Em revisão" },
  { value: "failure", label: "Falha" },
  { value: "origin_invalid", label: "Origem inválida" },
  { value: "reverted", label: "Revertida" },
];

function contagemLabel(total: number, singular: string, plural: string) {
  return total === 1 ? `1 ${singular}` : `${total} ${plural}`;
}

const SYNC_STATUS_LABELS: Record<SyncStatus, string> = {
  running: "Executando",
  success: "Sucesso",
  pending_review: "Em revisão",
  failure: "Falha",
  origin_invalid: "Origem inválida",
  reverted: "Revertida",
};

function syncStatusStyles(status: SyncStatus) {
  switch (status) {
    case "running":
      return "bg-blue-100 text-blue-800";
    case "success":
      return "bg-emerald-100 text-emerald-800";
    case "pending_review":
      return "bg-amber-100 text-amber-800";
    case "failure":
    case "origin_invalid":
      return "bg-red-100 text-red-800";
    case "reverted":
      return "bg-slate-100 text-slate-700";
  }
}

const PENDENCIA_STATUS_LABELS: Record<SyncPendenciaStatus, string> = {
  open: "Aberta",
  approved: "Aprovada",
  rejected: "Rejeitada",
  cancelled: "Cancelada",
};

function pendenciaStatusStyles(status: SyncPendenciaStatus) {
  switch (status) {
    case "open":
      return "bg-blue-100 text-blue-800";
    case "approved":
      return "bg-emerald-100 text-emerald-800";
    case "rejected":
      return "bg-red-100 text-red-800";
    case "cancelled":
      return "bg-gray-100 text-gray-700";
  }
}

const PENDENCIA_TIPO_LABELS: Record<SyncPendenciaTipo, string> = {
  substitution: "Substituição",
  absence: "Ausência",
  new_item: "Novo item",
};

function pendenciaTipoStyles(tipo: SyncPendenciaTipo) {
  switch (tipo) {
    case "substitution":
      return "bg-amber-100 text-amber-800";
    case "absence":
      return "bg-red-100 text-red-800";
    case "new_item":
      return "bg-emerald-100 text-emerald-800";
  }
}

const EVENTO_TIPO_LABELS: Record<SyncEventoTipo, string> = {
  sync_started: "Sincronização iniciada",
  extraction: "Extração",
  validation: "Validação",
  snapshot_created: "Snapshot criado",
  backup_created: "Backup criado",
  referencia_criada: "Referência criada",
  referencia_arquivada: "Referência arquivada",
  mudanca_aprovada: "Mudança aprovada",
  mudanca_rejeitada: "Mudança rejeitada",
  is_ativa_manual: "Ativação alterada manualmente",
  rollback: "Rollback",
  restore: "Restauração",
  pendencia_cancelada: "Pendência cancelada",
  pre_sync_inativa: "Inativa pré-sincronização",
};

const DIFF_CAMPO_LABELS: Record<DiffCampoSyncDTO["campo"], string> = {
  nome: "Nome",
  marca: "Marca",
  fenil_mg_por_100g: "Fenilalanina (mg/100g)",
};

function idCurto(id?: string | null) {
  if (!id) return "—";
  return id.slice(0, 8);
}

function nomeComMarcaSync(nome: string, marca?: string | null) {
  return marca ? `${nome} — ${marca}` : nome;
}

function identidadeResumoSync(ident: IdentidadeSync | null | undefined) {
  if (!ident) return "—";
  return `${nomeComMarcaSync(ident.nome, ident.marca)} · ${ident.fenil_mg_por_100g.toFixed(2)} mg/100g`;
}

function valorDiffSync(campo: DiffCampoSyncDTO["campo"], valor: string | number) {
  return campo === "fenil_mg_por_100g" ? `${Number(valor).toFixed(2)} mg/100g` : String(valor);
}

function tempoExecucaoSync(startedAt: string, finishedAt: string | null) {
  if (!finishedAt) return "em andamento";
  return formatDuration(new Date(finishedAt).getTime() - new Date(startedAt).getTime());
}

function BlocoErroSecao({ title, message }: { title: string; message: string }) {
  return (
    <div className="m-4 bg-red-50 border-l-4 border-red-500 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
        <div>
          <h4 className="font-semibold text-red-900">{title}</h4>
          <p className="text-sm text-red-700 mt-1">{message}</p>
        </div>
      </div>
    </div>
  );
}

function PaginacaoSync({
  page,
  totalPages,
  totalLabel,
  loading,
  onPrev,
  onNext,
  pageSize,
  onPageSize,
  selectId,
}: {
  page: number;
  totalPages: number;
  totalLabel: string;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
  pageSize: number;
  onPageSize: (size: number) => void;
  selectId: string;
}) {
  return (
    <div className="border-t border-gray-200 px-5 sm:px-6 py-4">
      <div className="flex flex-col sm:grid sm:grid-cols-3 items-center gap-3">
        <p className="text-sm text-gray-600">
          {totalLabel} · Página {page} de {totalPages}
        </p>

        <div className="flex items-center justify-center gap-2">
          <button
            onClick={onPrev}
            disabled={page <= 1 || loading}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <ChevronLeft className="w-4 h-4" />
            Anterior
          </button>

          <button
            onClick={onNext}
            disabled={page >= totalPages || loading}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Próxima
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-center sm:justify-end gap-2">
          <label htmlFor={selectId} className="text-xs font-medium text-gray-500">Item por página</label>
          <select
            id={selectId}
            value={String(pageSize)}
            onChange={(event) => onPageSize(Number(event.target.value))}
            disabled={loading}
            className="px-2 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="3">3</option>
            <option value="10">10</option>
            <option value="20">20</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function TrilhaSyncChip({
  syncId,
  onLimpar,
  onVerHistorico,
}: {
  syncId: string | null;
  onLimpar: () => void;
  onVerHistorico: () => void;
}) {
  if (!syncId) return null;
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1.5 text-sm font-medium text-indigo-800">
      <span>Trilha da sincronização <span className="font-mono">{idCurto(syncId)}</span></span>
      <button
        type="button"
        onClick={onVerHistorico}
        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
      >
        ver no histórico
      </button>
      <button
        type="button"
        onClick={onLimpar}
        aria-label="Limpar trilha da sincronização"
        className="text-indigo-400 hover:text-indigo-700"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function SecaoSincronizacaoReferencias({ data }: { data: SyncAdminData }) {
  const [aba, setAba] = useState<AbaSincronizacao>("historico");

  // Pontes entre sub-abas: o histórico abre a trilha de uma sync nas
  // pendências; o chip de trilha volta ao histórico.
  function irParaPendenciasDaSync(syncId: string) {
    setAba("pendencias");
    data.setPendenciasSyncId(syncId);
  }

  function irParaHistorico() {
    setAba("historico");
  }

  return (
    <section className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Sincronização de Referências</h2>
            <p className="text-sm text-gray-600 mt-1">
              Histórico das sincronizações com a tabela oficial de fenilalanina (ANVISA), curadoria
              das divergências e recuperação excepcional.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
                data.recuperacaoLoading && data.matchingValidado === null
                  ? "bg-gray-100 text-gray-700"
                  : data.matchingValidado
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  data.recuperacaoLoading && data.matchingValidado === null
                    ? "bg-gray-400"
                    : data.matchingValidado
                      ? "bg-emerald-500"
                      : "bg-amber-500"
                }`}
              />
              {data.recuperacaoLoading && data.matchingValidado === null
                ? "Verificando estado..."
                : data.matchingValidado
                  ? "Matching validado"
                  : "Aguardando bootstrap"}
            </span>

            <BotaoExecutarSync data={data} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 px-6 pt-4 border-b border-gray-200">
        {ABAS_SINCRONIZACAO.map((item) => {
          const visivel =
            item.id !== "recuperacao" || data.podeRecuperar || data.recuperacaoLoading;
          if (!visivel) return null;
          const ativa = aba === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setAba(item.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                ativa
                  ? "border-indigo-500 text-indigo-700 bg-indigo-50/60"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {aba === "historico" && <AbaHistoricoSync data={data} onIrParaPendencias={irParaPendenciasDaSync} />}
      {aba === "pendencias" && <AbaPendenciasSync data={data} onIrParaHistorico={irParaHistorico} />}
      {aba === "auditoria" && <AbaAuditoriaSync data={data} onIrParaHistorico={irParaHistorico} />}
      {aba === "recuperacao" && <AbaRecuperacaoSync data={data} />}
    </section>
  );
}

function BotaoExecutarSync({ data }: { data: SyncAdminData }) {
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);

  async function executar() {
    if (!confirm("Executar uma sincronização manual com a fonte oficial agora?")) return;
    setResultado(null);
    try {
      const res = await data.executarSync();
      setResultado({
        ok: true,
        texto: `Sincronização iniciada (${res.status === "running" ? "em execução" : res.status}). ID: ${idCurto(res.sync_id)}.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro inesperado ao executar a sincronização.";
      setResultado({ ok: false, texto: message });
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={executar}
        disabled={data.executandoSync}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
      >
        <Play className={`w-4 h-4 ${data.executandoSync ? "animate-spin" : ""}`} />
        {data.executandoSync ? "Executando..." : "Executar sync agora"}
      </button>

      {resultado && (
        <p
          className={`text-xs max-w-xs text-right ${
            resultado.ok ? "text-emerald-700" : "text-red-700"
          }`}
        >
          {resultado.texto}
        </p>
      )}
    </div>
  );
}

function AbaHistoricoSync({
  data,
  onIrParaPendencias,
}: {
  data: SyncAdminData;
  onIrParaPendencias: (syncId: string) => void;
}) {
  const [syncSelecionadaId, setSyncSelecionadaId] = useState<string | null>(null);
  const [alteracoesAbertas, setAlteracoesAbertas] = useState(false);

  const selecionada =
    data.syncs.items.find((sync) => sync.id === syncSelecionadaId) ?? data.syncs.items[0] ?? null;

  useEffect(() => {
    if (!data.syncs.items.some((sync) => sync.id === syncSelecionadaId)) {
      setSyncSelecionadaId(data.syncs.items[0]?.id ?? null);
    }
  }, [data.syncs.items, syncSelecionadaId]);

  return (
    <div>
      <div className="p-6 space-y-6">
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 lg:p-5">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-slate-600" />
            <h3 className="font-semibold text-slate-900">Filtros</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SelectField
              label="Status"
              value={data.syncsStatus}
              onChange={(value) => data.setSyncsStatus(value as SyncStatus | "all")}
              options={[
                { value: "all", label: "Todos" },
                ...SYNC_STATUS_LABELS_OPCOES,
              ]}
            />
          </div>
        </div>

        {data.syncs.error ? (
          <BlocoErroSecao title="Erro ao carregar o histórico" message={data.syncs.error.message} />
        ) : data.syncs.items.length === 0 && !data.syncs.loading ? (
          <div className="p-8 text-center">
            <History className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <h4 className="font-semibold text-gray-900">Nenhuma sincronização encontrada</h4>
            <p className="text-sm text-gray-600 mt-1">
              O cron semanal ainda não executou ou o filtro não encontrou resultados.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto bg-white border border-gray-200 rounded-2xl">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sync</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Início</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Origem</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bootstrap</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Totais</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Divergências</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mensagem</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.syncs.items.map((sync) => (
                    <tr
                      key={sync.id}
                      onClick={() => setSyncSelecionadaId(sync.id)}
                      className={`cursor-pointer hover:bg-gray-50 ${
                        selecionada?.id === sync.id ? "bg-indigo-50/60" : ""
                      }`}
                    >
                      <td className="px-6 py-4 font-mono text-xs font-medium text-gray-700">{idCurto(sync.id)}</td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {formatAdminDateTime(sync.started_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${syncStatusStyles(sync.status)}`}>
                          {SYNC_STATUS_LABELS[sync.status]}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {sync.trigger_source === "cron" ? "Cron" : "Manual"}
                      </td>
                      <td className="px-6 py-4">
                        {sync.bootstrap ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                            1ª sync
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div>{sync.total_origem ?? "—"} origem</div>
                        <div className="text-xs text-gray-500">
                          {sync.equivalentes ?? "—"} eq · {sync.criadas ?? "—"} criadas · {sync.arquivadas ?? "—"} arquivadas
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {sync.divergencias ? (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              onIrParaPendencias(sync.id);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                          >
                            <GitCompareArrows className="w-3.5 h-3.5" />
                            {contagemLabel(sync.divergencias, "divergência", "divergências")}
                          </button>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <span className="block text-sm text-gray-600 truncate">{sync.message ?? "—"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden p-4 space-y-4">
              {data.syncs.items.map((sync) => (
                <button
                  key={sync.id}
                  onClick={() => setSyncSelecionadaId(sync.id)}
                  className={`w-full text-left bg-gray-50 rounded-xl p-4 space-y-3 border ${
                    selecionada?.id === sync.id ? "border-indigo-400" : "border-transparent"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900 font-mono text-sm">{idCurto(sync.id)}</p>
                      <p className="text-xs text-gray-500">{formatAdminDateTime(sync.started_at)}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${syncStatusStyles(sync.status)}`}>
                      {SYNC_STATUS_LABELS[sync.status]}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                    <span>{sync.trigger_source === "cron" ? "Cron" : "Manual"}</span>
                    {sync.bootstrap && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">1ª sync</span>}
                    <span>{sync.total_origem ?? "—"} origem</span>
                    {sync.divergencias ? (
                      <span className="text-indigo-600 font-medium">{sync.divergencias} pendências</span>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>

            <PaginacaoSync
              page={data.syncs.page}
              totalPages={data.syncs.totalPages}
              totalLabel={contagemLabel(data.syncs.total, "sincronização", "sincronizações")}
              loading={data.syncs.loading}
              onPrev={() => data.setSyncsPage(Math.max(1, data.syncs.page - 1))}
              onNext={() => data.setSyncsPage(Math.min(data.syncs.totalPages, data.syncs.page + 1))}
              pageSize={data.syncs.pageSize}
              onPageSize={data.setSyncsPageSize}
              selectId="page-size-syncs"
            />

            {selecionada && (
              <div className="border-t border-gray-200 bg-slate-50 p-4 sm:p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Detalhes da sincronização</p>
                        <h4 className="text-lg font-semibold text-gray-900 font-mono">{idCurto(selecionada.id)}</h4>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${syncStatusStyles(selecionada.status)}`}>
                        {SYNC_STATUS_LABELS[selecionada.status]}
                      </span>
                    </div>

                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 text-sm">
                      <DetailItem label="Ambiente" value={selecionada.environment.toUpperCase()} />
                      <DetailItem label="Origem" value={selecionada.trigger_source === "cron" ? "Cron (semanal)" : "Manual"} />
                      <DetailItem label="Início" value={formatAdminDateTime(selecionada.started_at)} />
                      <DetailItem label="Fim" value={formatAdminDateTime(selecionada.finished_at)} />
                      <DetailItem label="Duração" value={tempoExecucaoSync(selecionada.started_at, selecionada.finished_at)} />
                      <DetailItem label="Bootstrap" value={selecionada.bootstrap ? "Sim (1ª sync do ambiente)" : "Não"} />
                      <DetailItem label="Origem (linhas)" value={selecionada.total_origem?.toString() ?? "—"} />
                      <DetailItem label="Equivalentes" value={selecionada.equivalentes?.toString() ?? "—"} />
                      <DetailItem label="Criadas" value={selecionada.criadas?.toString() ?? "—"} />
                      <DetailItem label="Arquivadas" value={selecionada.arquivadas?.toString() ?? "—"} />
                      <DetailItem label="Divergências" value={selecionada.divergencias?.toString() ?? "—"} />
                      <DetailItem label="Sync ID completo" value={selecionada.id} mono />
                    </dl>

                    <div className="mt-5">
                      <h5 className="text-sm font-semibold text-gray-900 mb-2">Mensagem</h5>
                      <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 border border-gray-200">
                        {selecionada.message ?? "—"}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
                    <h5 className="text-sm font-semibold text-gray-900 mb-3">Detalhes técnicos (estágios)</h5>
                    <pre className="text-xs bg-gray-950 text-gray-100 rounded-2xl p-4 overflow-auto max-h-64 whitespace-pre-wrap break-words">
                      {JSON.stringify(selecionada.details, null, 2)}
                    </pre>

                    <h5 className="text-sm font-semibold text-gray-900 mt-5 mb-3">Alterações aplicadas</h5>
                    {selecionada.alteracoes.length === 0 ? (
                      <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3 border border-gray-200">
                        Nenhuma alteração foi aplicada nesta sincronização.
                      </p>
                    ) : (
                      <>
                        <button
                          onClick={() => setAlteracoesAbertas((aberto) => !aberto)}
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                        >
                          {alteracoesAbertas ? "Ocultar" : "Ver"} {selecionada.alteracoes.length}{" "}
                          {selecionada.alteracoes.length === 1 ? "operação" : "operações"}
                        </button>
                        {alteracoesAbertas && (
                          <ul className="mt-3 space-y-2 text-sm">
                            {selecionada.alteracoes.map((alteracao, indice) => (
                              <li key={`${alteracao.referencia_id ?? "nova"}-${indice}`} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${alteracao.op === "create" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                                  {alteracao.op === "create" ? "Criação" : "Arquivamento"}
                                </span>
                                <div className="mt-2 text-xs text-gray-700 space-y-1">
                                  <div><span className="text-gray-500">Antes: </span>{identidadeResumoSync(alteracao.antes)}</div>
                                  <div><span className="text-gray-500">Depois: </span>{identidadeResumoSync(alteracao.depois)}</div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AbaPendenciasSync({
  data,
  onIrParaHistorico,
}: {
  data: SyncAdminData;
  onIrParaHistorico: () => void;
}) {
  const [decisao, setDecisao] = useState<{ pendencia: PendenciaSyncDTO; aprovar: boolean } | null>(null);
  const [historicoId, setHistoricoId] = useState<string | null>(null);
  const [historicoLinhas, setHistoricoLinhas] = useState<PendenciaSyncDTO[]>([]);
  const [historicoErro, setHistoricoErro] = useState<string | null>(null);
  const [historicoLoadingId, setHistoricoLoadingId] = useState<string | null>(null);

  async function carregarHistorico(pendencia: PendenciaSyncDTO) {
    if (historicoId === pendencia.id) {
      setHistoricoId(null);
      setHistoricoLinhas([]);
      return;
    }
    setHistoricoErro(null);
    setHistoricoLoadingId(pendencia.id);
    try {
      const linhas = await data.historicoPendencia(pendencia);
      setHistoricoId(pendencia.id);
      setHistoricoLinhas(linhas);
    } catch (err) {
      setHistoricoErro(err instanceof Error ? err.message : "Erro ao carregar o histórico.");
    } finally {
      setHistoricoLoadingId(null);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="w-full sm:w-56">
            <SelectField
              label="Status"
              value={data.pendenciasStatus}
              onChange={(value) => data.setPendenciasStatus(value as SyncPendenciaStatus | "all")}
              options={[
                { value: "open", label: "Abertas" },
                { value: "approved", label: "Aprovadas" },
                { value: "rejected", label: "Rejeitadas" },
                { value: "cancelled", label: "Canceladas" },
                { value: "all", label: "Todas" },
              ]}
            />
          </div>
          <TrilhaSyncChip
            syncId={data.pendenciasSyncId}
            onLimpar={() => data.setPendenciasSyncId(null)}
            onVerHistorico={onIrParaHistorico}
          />
        </div>

        {data.pendencias.error ? (
          <BlocoErroSecao title="Erro ao carregar as pendências" message={data.pendencias.error.message} />
        ) : data.pendencias.items.length === 0 && !data.pendencias.loading ? (
          <div className="p-8 text-center bg-white border border-gray-200 rounded-2xl">
            <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <h4 className="font-semibold text-gray-900">Nenhuma pendência encontrada</h4>
            <p className="text-sm text-gray-600 mt-1">
              Divergências das sincronizações aparecem aqui para curadoria manual.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.pendencias.items.map((pendencia) => (
              <PendenciaCardSync
                key={pendencia.id}
                pendencia={pendencia}
                onAbrirDecisao={(aprovar) => setDecisao({ pendencia, aprovar })}
                historicoAberto={historicoId === pendencia.id}
                historicoLinhas={historicoLinhas}
                historicoErro={historicoErro}
                historicoLoading={historicoLoadingId === pendencia.id}
                onAlternarHistorico={() => carregarHistorico(pendencia)}
              />
            ))}

            <PaginacaoSync
              page={data.pendencias.page}
              totalPages={data.pendencias.totalPages}
              totalLabel={contagemLabel(data.pendencias.total, "pendência", "pendências")}
              loading={data.pendencias.loading}
              onPrev={() => data.setPendenciasPage(Math.max(1, data.pendencias.page - 1))}
              onNext={() => data.setPendenciasPage(Math.min(data.pendencias.totalPages, data.pendencias.page + 1))}
              pageSize={data.pendencias.pageSize}
              onPageSize={data.setPendenciasPageSize}
              selectId="page-size-pendencias"
            />
          </div>
        )}
      </div>

      {decisao && (
        <ModalDecisaoPendencia
          pendencia={decisao.pendencia}
          aprovar={decisao.aprovar}
          onClose={() => setDecisao(null)}
          onDecidir={(aprovar, motivo) => data.decidirPendencia(decisao.pendencia.id, aprovar, motivo)}
        />
      )}
    </div>
  );
}

function PendenciaCardSync({
  pendencia,
  onAbrirDecisao,
  historicoAberto,
  historicoLinhas,
  historicoErro,
  historicoLoading,
  onAlternarHistorico,
}: {
  pendencia: PendenciaSyncDTO;
  onAbrirDecisao: (aprovar: boolean) => void;
  historicoAberto: boolean;
  historicoLinhas: PendenciaSyncDTO[];
  historicoErro: string | null;
  historicoLoading: boolean;
  onAlternarHistorico: () => void;
}) {
  const referencia = pendencia.referencia;
  const proposta = pendencia.proposta;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${pendenciaTipoStyles(pendencia.tipo)}`}>
            {PENDENCIA_TIPO_LABELS[pendencia.tipo]}
          </span>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${pendenciaStatusStyles(pendencia.status)}`}>
            {PENDENCIA_STATUS_LABELS[pendencia.status]}
          </span>
          <span className="text-xs text-gray-500">
            Sync <span className="font-mono">{idCurto(pendencia.sync_id)}</span> · {formatAdminDateTime(pendencia.created_at)}
          </span>
        </div>

        {pendencia.status === "open" && (
          <div className="flex gap-2">
            <button
              onClick={() => onAbrirDecisao(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Aprovar
            </button>
            <button
              onClick={() => onAbrirDecisao(false)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              Rejeitar
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
            {pendencia.tipo === "new_item" ? "Proposta (nova referência)" : "Referência atual"}
          </p>
          {referencia ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <p className="font-medium text-gray-900">{nomeComMarcaSync(referencia.nome, referencia.marca)}</p>
              <p className="text-xs text-gray-500 mt-0.5">{referencia.fenil_mg_por_100g.toFixed(2)} mg/100g</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-xl p-3">
              {pendencia.tipo === "absence" ? "Referência removida fisicamente" : "—"}
            </p>
          )}
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
            {pendencia.tipo === "absence" ? "Origem (sem correspondência)" : "Proposta da origem"}
          </p>
          {proposta ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <p className="font-medium text-gray-900">{nomeComMarcaSync(proposta.nome, proposta.marca)}</p>
              <p className="text-xs text-gray-500 mt-0.5">{proposta.fenil_mg_por_100g.toFixed(2)} mg/100g</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-xl p-3">—</p>
          )}
        </div>
      </div>

      {pendencia.diff && pendencia.diff.length > 0 && (
        <div className="bg-gray-950 rounded-xl p-3 font-mono text-xs overflow-x-auto">
          <p className="text-gray-400 mb-2 text-[10px] uppercase tracking-wide font-sans">Mudanças propostas</p>
          {pendencia.diff.map((d) => (
            <div key={d.campo} className="space-y-0.5 py-0.5">
              <p className="text-gray-500 font-sans text-[10px]">{DIFF_CAMPO_LABELS[d.campo]}</p>
              <p className="text-red-400">- {valorDiffSync(d.campo, d.antes)}</p>
              <p className="text-emerald-400">+ {valorDiffSync(d.campo, d.depois)}</p>
            </div>
          ))}
        </div>
      )}

      {pendencia.status !== "open" && (
        <div className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1">
          {pendencia.motivo && (
            <p><span className="font-semibold text-gray-700">Motivo: </span>{pendencia.motivo}</p>
          )}
          <p>
            {pendencia.decided_at
              ? `Decidida em ${formatAdminDateTime(pendencia.decided_at)}`
              : "Decisão de sincronização (sem registro manual)"}
            {pendencia.decided_by ? ` por admin ${idCurto(pendencia.decided_by)}` : ""}
          </p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={onAlternarHistorico}
          disabled={historicoLoading}
          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline disabled:opacity-50"
        >
          <History className="w-3.5 h-3.5" />
          {historicoLoading
            ? "Carregando histórico..."
            : historicoAberto
              ? "Ocultar ocorrências anteriores"
              : "Ver ocorrências desta divergência"}
        </button>
        {pendencia.sync && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${syncStatusStyles(pendencia.sync.status)}`}>
            Sync: {SYNC_STATUS_LABELS[pendencia.sync.status]}
          </span>
        )}
      </div>

      {historicoErro && <p className="text-sm text-red-700">{historicoErro}</p>}

      {historicoAberto && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          {historicoLinhas.length === 0 ? (
            <p className="text-sm text-gray-600">Nenhuma ocorrência anterior registrada para esta divergência.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {historicoLinhas.map((linha) => (
                <li key={linha.id} className="flex flex-wrap items-center gap-2 text-gray-700">
                  <span className="font-medium">
                    {linha.id === pendencia.id ? "Ocorrência atual" : formatAdminDateTime(linha.created_at)}
                  </span>
                  {linha.id === pendencia.id && (
                    <span className="text-xs text-gray-500">({formatAdminDateTime(linha.created_at)})</span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${pendenciaStatusStyles(linha.status)}`}>
                    {PENDENCIA_STATUS_LABELS[linha.status]}
                  </span>
                  {linha.motivo && <span className="text-xs text-gray-600">— {linha.motivo}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ModalDecisaoPendencia({
  pendencia,
  aprovar,
  onClose,
  onDecidir,
}: {
  pendencia: PendenciaSyncDTO;
  aprovar: boolean;
  onClose: () => void;
  onDecidir: (aprovar: boolean, motivo?: string) => Promise<unknown>;
}) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    setErro(null);
    setEnviando(true);
    try {
      await onDecidir(aprovar, aprovar ? undefined : motivo.trim());
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro inesperado ao registrar a decisão.");
      setEnviando(false);
    }
  }

  const descricao = pendencia.proposta
    ? identidadeResumoSync(pendencia.proposta)
    : pendencia.referencia
      ? identidadeResumoSync(pendencia.referencia)
      : "—";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {aprovar ? "Aprovar mudança" : "Rejeitar mudança"}
          </h2>
          <button onClick={onClose} aria-label="Fechar" className="text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-sm text-gray-700">
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${pendenciaTipoStyles(pendencia.tipo)}`}>
              {PENDENCIA_TIPO_LABELS[pendencia.tipo]}
            </span>
            <p className="mt-2">{descricao}</p>
          </div>

          <p className="text-sm">
            {aprovar
              ? "Aprovar aplica a mudança proposta na próxima sincronização confiável — a referência atual será arquivada e a proposta passará a valer."
              : "Rejeitar mantém a referência atual e registra a divergência como conhecida. O motivo é obrigatório."}
          </p>

          {!aprovar && (
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Motivo da rejeição</span>
              <textarea
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                rows={3}
                required
                placeholder="Ex.: a proposta está desatualizada; conferir com a fonte."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </label>
          )}

          {erro && <p className="text-sm text-red-700 bg-red-50 rounded-xl p-3 border border-red-200">{erro}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={enviando}
              className="px-4 py-2 text-sm rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={confirmar}
              disabled={enviando || (!aprovar && !motivo.trim())}
              className={`px-4 py-2 text-sm rounded-lg font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed ${
                aprovar ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {enviando ? "Registrando..." : aprovar ? "Confirmar aprovação" : "Confirmar rejeição"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AbaAuditoriaSync({
  data,
  onIrParaHistorico,
}: {
  data: SyncAdminData;
  onIrParaHistorico: () => void;
}) {
  const [termoDraft, setTermoDraft] = useState("");

  function aplicarTermo(event: FormEvent) {
    event.preventDefault();
    data.setEventosTermo(termoDraft);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 lg:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-600" />
          <h3 className="font-semibold text-slate-900">Filtros</h3>
          <TrilhaSyncChip
            syncId={data.eventosSyncId}
            onLimpar={() => data.setEventosSyncId(null)}
            onVerHistorico={onIrParaHistorico}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <SelectField
            label="Tipo de evento"
            value={data.eventosTipo}
            onChange={(value) => data.setEventosTipo(value as SyncEventoTipo | "all")}
            options={[{ value: "all", label: "Todos" }, ...EVENTO_TIPO_OPCOES]}
          />

          <form onSubmit={aplicarTermo} className="flex items-end gap-2">
            <label className="block flex-1">
              <span className="block text-sm font-medium text-gray-700 mb-2">Referência (nome)</span>
              <input
                value={termoDraft}
                onChange={(event) => setTermoDraft(event.target.value)}
                placeholder="Buscar por nome..."
                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </label>
            <button
              type="submit"
              className="px-4 py-3 text-sm font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-xl"
            >
              Buscar
            </button>
          </form>
        </div>

        {data.eventosTermo && (
          <p className="text-sm text-gray-600">
            Filtrando por <span className="font-medium">"{data.eventosTermo}"</span>{" "}
            <button
              onClick={() => {
                setTermoDraft("");
                data.setEventosTermo("");
              }}
              className="text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
            >
              limpar busca
            </button>
          </p>
        )}
      </div>

      {data.eventos.error ? (
        <BlocoErroSecao title="Erro ao carregar a auditoria" message={data.eventos.error.message} />
      ) : data.eventos.items.length === 0 && !data.eventos.loading ? (
        <div className="p-8 text-center bg-white border border-gray-200 rounded-2xl">
          <ScrollText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h4 className="font-semibold text-gray-900">Nenhum evento encontrado</h4>
          <p className="text-sm text-gray-600 mt-1">Ajuste os filtros para ver o registro de auditoria.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.eventos.items.map((evento) => (
            <EventoCardSync key={evento.id} evento={evento} onVerTrilha={() => data.setEventosSyncId(evento.sync_id)} />
          ))}

          <PaginacaoSync
            page={data.eventos.page}
            totalPages={data.eventos.totalPages}
            totalLabel={contagemLabel(data.eventos.total, "evento", "eventos")}
            loading={data.eventos.loading}
            onPrev={() => data.setEventosPage(Math.max(1, data.eventos.page - 1))}
            onNext={() => data.setEventosPage(Math.min(data.eventos.totalPages, data.eventos.page + 1))}
            pageSize={data.eventos.pageSize}
            onPageSize={data.setEventosPageSize}
            selectId="page-size-eventos"
          />
        </div>
      )}
    </div>
  );
}

const EVENTO_TIPO_OPCOES: Array<{ value: string; label: string }> = Object.entries(EVENTO_TIPO_LABELS).map(
  ([value, label]) => ({ value, label }),
);

function EventoCardSync({
  evento,
  onVerTrilha,
}: {
  evento: EventoSyncDTO;
  onVerTrilha: () => void;
}) {
  const temDetalhes = Object.keys(evento.detalhes ?? {}).length > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
            {EVENTO_TIPO_LABELS[evento.tipo] ?? evento.tipo}
          </span>
          <span className="text-gray-500">{formatAdminDateTime(evento.created_at)}</span>
          {evento.referencia && (
            <span className="text-gray-700 font-medium">{nomeComMarcaSync(evento.referencia.nome, evento.referencia.marca)}</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
          {evento.sync_id && (
            <button
              onClick={onVerTrilha}
              className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              Sync <span className="font-mono">{idCurto(evento.sync_id)}</span>
              <History className="w-3 h-3" />
              trilha
            </button>
          )}
          {evento.actor_id && <span>admin {idCurto(evento.actor_id)}</span>}
          {evento.pendencia_id && <span>pendência <span className="font-mono">{idCurto(evento.pendencia_id)}</span></span>}
        </div>
      </div>

      {temDetalhes && (
        <pre className="mt-3 text-xs bg-gray-950 text-gray-100 rounded-xl p-3 overflow-auto max-h-48 whitespace-pre-wrap break-words">
          {JSON.stringify(evento.detalhes, null, 2)}
        </pre>
      )}
    </div>
  );
}

function AbaRecuperacaoSync({ data }: { data: SyncAdminData }) {
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);

  function mostrarResultado(ok: boolean, texto: string) {
    setResultado({ ok, texto });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function reverter(sync: ReferenciaSyncDTO) {
    if (!confirm(`Reverter a sincronização ${idCurto(sync.id)}?`)) return;
    const palavra = prompt('Digite "REVERTER" para confirmar a reversão:');
    if (palavra !== "REVERTER") return;
    setResultado(null);
    try {
      const res = await data.reverterSync(sync.id);
      mostrarResultado(
        Boolean(res.revertida),
        res.revertida
          ? `Sincronização revertida: ${res.revertidas ?? 0} operações desfeitas, ${res.preservadas ?? 0} posteriores preservadas, ${res.pendencias_canceladas ?? 0} pendências canceladas.`
          : `Não foi possível reverter: ${res.motivo ?? "motivo não informado."}`,
      );
    } catch (err) {
      mostrarResultado(false, err instanceof Error ? err.message : "Erro inesperado ao reverter a sincronização.");
    }
  }

  async function restaurar(backup: BackupSyncDTO) {
    if (!confirm(`Restaurar o catálogo a partir do backup de ${formatAdminDateTime(backup.created_at)}?`)) return;
    const palavra = prompt('Digite "RESTAURAR" para confirmar a restauração:');
    if (palavra !== "RESTAURAR") return;
    setResultado(null);
    try {
      const res = await data.restaurarBackup(backup.id);
      mostrarResultado(
        true,
        `Backup restaurado: ${res.reativadas} reativadas, ${res.criadas} criadas, ${res.arquivadas} arquivadas, ${res.pendencias_canceladas} pendências canceladas.`,
      );
    } catch (err) {
      mostrarResultado(false, err instanceof Error ? err.message : "Erro inesperado ao restaurar o backup.");
    }
  }

  if (!data.podeRecuperar) {
    return (
      <div className="p-8 text-center">
        <ArchiveRestore className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <h4 className="font-semibold text-gray-900">Recuperação indisponível</h4>
        <p className="text-sm text-gray-600 mt-1">
          A permissão de recuperação ({`pode_recuperacao`}) é concedida manualmente a administradores
          autorizados.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {resultado && (
        <div
          className={`rounded-xl p-4 border-l-4 ${
            resultado.ok ? "bg-emerald-50 border-emerald-500" : "bg-red-50 border-red-500"
          }`}
        >
          <p className={`text-sm ${resultado.ok ? "text-emerald-800" : "text-red-800"}`}>{resultado.texto}</p>
        </div>
      )}

      {data.syncsRevertiveis.error && (
        <BlocoErroSecao title="Erro ao carregar as sincronizações revertíveis" message={data.syncsRevertiveis.error.message} />
      )}
      {data.backups.error && (
        <BlocoErroSecao title="Erro ao carregar os backups" message={data.backups.error.message} />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Undo2 className="w-4 h-4 text-gray-600" /> Rollback seletivo de sincronização
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Desfaz as operações aplicadas por uma sync concluída. Alterações de syncs posteriores são
              preservadas pela guarda de integridade; pendências abertas da sync são canceladas.
            </p>
          </div>

          {data.syncsRevertiveis.items.length === 0 && !data.syncsRevertiveis.loading ? (
            <p className="p-6 text-sm text-gray-600">
              Nenhuma sincronização revertível (status success ou pending_review) encontrada.
            </p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {data.syncsRevertiveis.items.map((sync) => (
                <li key={sync.id} className="px-5 py-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-mono text-xs font-medium text-gray-700">{idCurto(sync.id)}</span>
                      <span className="text-gray-500">{formatAdminDateTime(sync.started_at)}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${syncStatusStyles(sync.status)}`}>
                        {SYNC_STATUS_LABELS[sync.status]}
                      </span>
                    </div>
                    <button
                      onClick={() => reverter(sync)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      Reverter sync
                    </button>
                  </div>
                  <p className="text-xs text-gray-600">
                    {sync.alteracoes.length === 0
                      ? "Nenhuma operação aplicada (nada a reverter)."
                      : `${sync.alteracoes.length} ${sync.alteracoes.length === 1 ? "operação registrada" : "operações registradas"} (${sync.criadas ?? "—"} criadas · ${sync.arquivadas ?? "—"} arquivadas).`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 pt-5 pb-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <ArchiveRestore className="w-4 h-4 text-gray-600" /> Restauração excepcional por backup
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Restaura o catálogo ao estado pré-sincronização gravado no backup. A guarda impede a
              restauração quando há alterações posteriores conflitantes; todo o catálogo é reescrito.
            </p>
          </div>

          {data.backups.items.length === 0 && !data.backups.loading ? (
            <p className="p-6 text-sm text-gray-600">Nenhum backup disponível.</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {data.backups.items.map((backup) => (
                <li key={backup.id} className="px-5 py-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">{formatAdminDateTime(backup.created_at)}</span>
                      <span className="text-gray-500"> · {backup.contagem} linhas</span>
                      <span className="text-gray-500"> · sha <span className="font-mono text-xs">{backup.payload_sha256.slice(0, 12)}</span></span>
                    </div>
                    <button
                      onClick={() => restaurar(backup)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg transition-colors"
                    >
                      Restaurar backup
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Backup da sincronização <span className="font-mono">{idCurto(backup.sync_id)}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

