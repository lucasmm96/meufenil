/**
 * notificacoes.service.ts — FEAT-0018
 *
 * Acesso ao cliente anon do Supabase para notificações.
 * RLS garante que cada usuário acessa somente as próprias notificações
 * e os broadcasts (target = 'broadcast').
 *
 * inserirNotificacao: não acessível via cliente anon para usuários comuns —
 * INSERT exige papel admin (via RLS) ou service_role (bypass RLS).
 * Para uso interno/admin via frontend com sessão de admin, a função funciona.
 * Para automações do servidor, usar diretamente o cliente service_role.
 */
import { supabase } from "@/react-app/lib/supabase";
import { AppError } from "@/react-app/lib/errors";
import type {
  NotificacaoDTO,
  InserirNotificacaoParams,
} from "./dtos/notificacoes.dto";

/**
 * Lista notificações não expiradas do usuário, ordenadas por created_at DESC.
 * Inclui notificações pessoais (user_id = userId) e broadcasts.
 */
export async function listarNotificacoes(
  userId: string
): Promise<NotificacaoDTO[]> {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("notificacoes")
    .select("*")
    .or(`user_id.eq.${userId},target.eq.broadcast`)
    .gt("expires_at", now)
    .order("created_at", { ascending: false });

  if (error) {
    throw new AppError(
      "NOTIFICACOES_LIST_ERROR",
      "Erro ao carregar notificações",
      error
    );
  }

  return (data ?? []) as NotificacaoDTO[];
}

/**
 * Conta notificações não lidas e não expiradas do usuário.
 * Inclui broadcasts não lidos.
 */
export async function contarNaoLidas(userId: string): Promise<number> {
  const now = new Date().toISOString();

  const { count, error } = await supabase
    .from("notificacoes")
    .select("*", { count: "exact", head: true })
    .or(`user_id.eq.${userId},target.eq.broadcast`)
    .is("read_at", null)
    .gt("expires_at", now);

  if (error) {
    throw new AppError(
      "NOTIFICACOES_COUNT_ERROR",
      "Erro ao contar notificações não lidas",
      error
    );
  }

  return count ?? 0;
}

/**
 * Marca uma notificação como lida via RPC (garante que só o dono pode marcar).
 */
export async function marcarComoLida(id: string): Promise<void> {
  const { error } = await supabase.rpc("marcar_notificacao_lida", {
    notificacao_id: id,
  });

  if (error) {
    throw new AppError(
      "NOTIFICACOES_MARCAR_LIDA_ERROR",
      "Erro ao marcar notificação como lida",
      error
    );
  }
}

/**
 * Marca todas as notificações não lidas do usuário autenticado como lidas.
 */
export async function marcarTodasComoLidas(): Promise<void> {
  const { error } = await supabase.rpc("marcar_todas_notificacoes_lidas");

  if (error) {
    throw new AppError(
      "NOTIFICACOES_MARCAR_TODAS_ERROR",
      "Erro ao marcar todas as notificações como lidas",
      error
    );
  }
}

/**
 * Insere uma notificação (uso exclusivo para admin autenticado).
 *
 * Esta função usa o cliente anon com a sessão do admin para INSERT.
 * A RLS (notificacoes_insert_admin_only) permite que somente admins
 * autenticados insiram diretamente. Para service_role ou automações
 * de servidor, use o cliente service_role diretamente.
 */
export async function inserirNotificacao(
  params: InserirNotificacaoParams
): Promise<void> {
  const { error } = await supabase.from("notificacoes").insert({
    user_id: params.user_id,
    type: params.type,
    title: params.title,
    body: params.body,
    target: params.target,
  });

  if (error) {
    throw new AppError(
      "NOTIFICACOES_INSERT_ERROR",
      error.message || "Erro ao inserir notificação",
      error
    );
  }
}

/**
 * Subscreve ao canal Realtime de notificações do usuário.
 * Retorna a função de cleanup para cancelar a subscription.
 *
 * Para broadcasts: a ausência de filtro por user_id é intencional —
 * o RLS SELECT (`user_id = auth.uid() OR target = 'broadcast'`)
 * garante que o usuário receba apenas os eventos autorizados.
 */
export function subscribirNotificacoes(
  userId: string,
  callback: () => void
): () => void {
  const channel = supabase
    .channel(`notificacoes:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notificacoes",
      },
      () => {
        callback();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
