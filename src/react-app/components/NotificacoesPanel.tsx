/**
 * NotificacoesPanel — FEAT-0018
 *
 * Painel overlay que exibe o feed de notificações do usuário.
 * Abre/fecha sem mudança de rota (estado em Layout).
 * Segue os padrões visuais do projeto (modais, cards, skeletons).
 */
import {
  Bell,
  BellOff,
  CheckCheck,
  X,
  AlertTriangle,
  Info,
  MessageSquare,
  Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { NotificacaoDTO, NotificacaoTipo } from "@/react-app/services/dtos/notificacoes.dto";

interface NotificacoesPanelProps {
  notificacoes: NotificacaoDTO[];
  naoLidas: number;
  loading: boolean;
  error: import("@/react-app/lib/errors").AppError | null;
  onMarcarComoLida: (id: string) => void;
  onMarcarTodasComoLidas: () => void;
  onFechar: () => void;
}

function iconeParaTipo(tipo: NotificacaoTipo) {
  switch (tipo) {
    case "health_alert":
      return <AlertTriangle className="w-4 h-4 text-amber-600" />;
    case "admin_message":
      return <MessageSquare className="w-4 h-4 text-indigo-600" />;
    case "app_update":
      return <Zap className="w-4 h-4 text-purple-600" />;
    case "system_event":
    default:
      return <Info className="w-4 h-4 text-blue-600" />;
  }
}

function corFundoParaTipo(tipo: NotificacaoTipo) {
  switch (tipo) {
    case "health_alert":
      return "bg-amber-100";
    case "admin_message":
      return "bg-indigo-100";
    case "app_update":
      return "bg-purple-100";
    case "system_event":
    default:
      return "bg-blue-100";
  }
}

function formatarTempo(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), {
      addSuffix: true,
      locale: ptBR,
    });
  } catch {
    return "";
  }
}

export default function NotificacoesPanel({
  notificacoes,
  naoLidas,
  loading,
  error,
  onMarcarComoLida,
  onMarcarTodasComoLidas,
  onFechar,
}: NotificacoesPanelProps) {
  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40"
        onClick={onFechar}
        aria-hidden="true"
      />

      {/* Painel */}
      <div
        className="fixed right-0 top-16 z-50 w-full sm:w-96 max-h-[calc(100vh-4rem)] flex flex-col bg-white shadow-2xl border-l border-gray-200 sm:rounded-bl-2xl overflow-hidden"
        role="dialog"
        aria-label="Central de notificações"
      >
        {/* Header do painel */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white/90 backdrop-blur-sm sticky top-0">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-semibold text-gray-900">Notificações</h2>
            {naoLidas > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-600 text-white">
                {naoLidas}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {naoLidas > 0 && (
              <button
                onClick={onMarcarTodasComoLidas}
                className="flex items-center gap-1 px-2 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="Marcar todas como lidas"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Marcar todas</span>
              </button>
            )}

            <button
              onClick={onFechar}
              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Fechar"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="animate-pulse flex gap-3 p-3 rounded-xl bg-gray-50"
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-200 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-full" />
                    <div className="h-2 bg-gray-200 rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="p-4">
              <div className="bg-red-50 border-l-4 border-red-500 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-red-900">
                      Erro ao carregar notificações
                    </p>
                    <p className="text-xs text-red-700 mt-0.5">{error.message}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && notificacoes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-3">
                <BellOff className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-700">
                Nenhuma notificação
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Você está em dia! Novas notificações aparecerão aqui.
              </p>
            </div>
          )}

          {!loading && !error && notificacoes.length > 0 && (
            <ul className="divide-y divide-gray-100">
              {notificacoes.map((notificacao) => {
                const isNaoLida = notificacao.read_at === null;

                return (
                  <li key={notificacao.id}>
                    <button
                      className={`w-full text-left flex gap-3 p-4 transition-colors hover:bg-gray-50 ${
                        isNaoLida ? "bg-indigo-50/50" : ""
                      }`}
                      onClick={() => {
                        if (isNaoLida) {
                          onMarcarComoLida(notificacao.id);
                        }
                      }}
                      title={isNaoLida ? "Clique para marcar como lida" : undefined}
                    >
                      {/* Ícone do tipo */}
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${corFundoParaTipo(
                          notificacao.type
                        )}`}
                      >
                        {iconeParaTipo(notificacao.type)}
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-sm leading-tight ${
                              isNaoLida
                                ? "font-semibold text-gray-900"
                                : "font-medium text-gray-700"
                            }`}
                          >
                            {notificacao.title}
                          </p>
                          {isNaoLida && (
                            <span
                              className="shrink-0 w-2 h-2 rounded-full bg-indigo-600 mt-1.5"
                              aria-label="Não lida"
                            />
                          )}
                        </div>

                        <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                          {notificacao.body}
                        </p>

                        <p className="text-xs text-gray-400 mt-1">
                          {formatarTempo(notificacao.created_at)}
                          {notificacao.target === "broadcast" && (
                            <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              geral
                            </span>
                          )}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
