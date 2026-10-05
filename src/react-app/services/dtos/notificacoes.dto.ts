export type NotificacaoTipo =
  | "system_event"
  | "admin_message"
  | "health_alert"
  | "app_update"
  | (string & {}); // extensível para novos tipos sem alteração de schema

export type NotificacaoTarget = "user" | "broadcast";

export interface NotificacaoDTO {
  id: string;
  user_id: string;
  type: NotificacaoTipo;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  expires_at: string;
  target: NotificacaoTarget;
}

export interface InserirNotificacaoParams {
  user_id: string;
  type: NotificacaoTipo;
  title: string;
  body: string;
  target: NotificacaoTarget;
}
