/**
 * DTOs da sincronização de referências (FEAT-0017/ENH-0009) para o painel admin.
 *
 * Espelham as tabelas do M1 e os contratos das RPCs — snake_case preservado,
 * como nos demais dtos (overview.md). `details`/`detalhes` são jsonb do banco
 * e chegam como `Record` tipados pelos services.
 */

export const SYNC_STATUSES = [
  "running",
  "success",
  "pending_review",
  "failure",
  "origin_invalid",
  "reverted",
] as const;

export type SyncStatus = (typeof SYNC_STATUSES)[number];

export const SYNC_EVENTO_TIPOS = [
  "sync_started",
  "extraction",
  "validation",
  "snapshot_created",
  "backup_created",
  "referencia_criada",
  "referencia_arquivada",
  "referencia_deletada",
  "mudanca_aprovada",
  "mudanca_rejeitada",
  "is_ativa_manual",
  "rollback",
  "restore",
  "pendencia_cancelada",
  "pre_sync_inativa",
] as const;

export type SyncEventoTipo = (typeof SYNC_EVENTO_TIPOS)[number];

/** Identidade oficial de uma referência (colunas de `referencias`). */
export interface IdentidadeReferenciaSyncDTO {
  nome: string;
  marca: string;
  fenil_mg_por_100g: number;
}

/** Operação de uma sync (`referencia_syncs.alteracoes` — RPCs M4). */
export interface AlteracaoSyncDTO {
  op: "create" | "archive";
  referencia_id: string | null;
  antes: IdentidadeReferenciaSyncDTO | null;
  depois: IdentidadeReferenciaSyncDTO | null;
}

/** Linha de `referencia_syncs` (§5.1). */
export interface ReferenciaSyncDTO {
  id: string;
  environment: string;
  trigger_source: string;
  requested_by: string | null;
  status: SyncStatus;
  started_at: string;
  finished_at: string | null;
  total_origem: number | null;
  equivalentes: number | null;
  criadas: number | null;
  arquivadas: number | null;
  deletadas: number | null;
  message: string | null;
  details: Record<string, unknown>;
  alteracoes: AlteracaoSyncDTO[];
  created_at: string;
}

export interface ReferenciaSyncsPageDTO {
  items: ReferenciaSyncDTO[];
  total: number;
  page: number;
  pageSize: number;
}

/** Filtros server-side do histórico. */
export interface ReferenciaSyncFiltersDTO {
  status?: SyncStatus;
  page: number;
  pageSize: number;
}

/** Linha de `referencia_eventos` (§5.3) + embeds de contexto. */
export interface EventoSyncDTO {
  id: string;
  sync_id: string | null;
  pendencia_id: string | null;
  referencia_id: string | null;
  tipo: SyncEventoTipo;
  actor_id: string | null;
  detalhes: Record<string, unknown>;
  created_at: string;
  /** Embed da sync (trilha). */
  sync: { started_at: string; status: SyncStatus } | null;
  /** Embed da referência do evento (null após DELETE físico — UUID ainda gravado). */
  referencia: { nome: string; marca: string } | null;
}

export interface EventosSyncPageDTO {
  items: EventoSyncDTO[];
  total: number;
  page: number;
  pageSize: number;
}

/** Linha de `referencia_backups` (§5.4). */
export interface BackupSyncDTO {
  id: string;
  sync_id: string;
  payload_sha256: string;
  contagem: number;
  created_at: string;
  sync: { started_at: string } | null;
}

export interface ResultadoRestaurarBackupDTO {
  backup_id: string;
  reativadas: number;
  criadas: number;
  arquivadas: number;
  pendencias_canceladas: number;
}

/** Resposta do POST manual da rota `/api/referencias-sync`. */
export interface ResultadoSyncManualDTO {
  sync_id: string;
  status: string;
}
