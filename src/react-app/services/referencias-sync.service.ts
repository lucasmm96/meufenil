import { supabase } from "@/react-app/lib/supabase";
import { AppError } from "@/react-app/lib/errors";
import { CURRENT_APP_ENVIRONMENT } from "@/react-app/lib/app-environment";
import {
  AlteracaoSyncDTO,
  BackupSyncDTO,
  EventoSyncDTO,
  EventosSyncPageDTO,
  IdentidadeReferenciaSyncDTO,
  ReferenciaSyncDTO,
  ReferenciaSyncsPageDTO,
  ResultadoRestaurarBackupDTO,
  ResultadoSyncManualDTO,
  SyncStatus,
} from "./dtos/referencias-sync.dto";

const DEFAULT_PAGE_SIZE = 3;
const DEFAULT_BACKUPS_LIMIT = 25;

const SYNC_FIELDS = `
  id,
  environment,
  trigger_source,
  requested_by,
  status,
  started_at,
  finished_at,
  total_origem,
  equivalentes,
  criadas,
  arquivadas,
  deletadas,
  message,
  details,
  alteracoes,
  created_at
`;

// ENH-0009 removeu a FK referencia_eventos.referencia_id → referencias; o embed
// "referencias ( nome, marca )" não funciona mais sem FK no PostgREST. O nome da
// referência é derivado de detalhes (identidade gravada nos eventos de criação/
// arquivamento/deleção). Para is_ativa_manual (detalhes = {de, para}), referencia = null.
const EVENTO_FIELDS = `
  id,
  sync_id,
  pendencia_id,
  referencia_id,
  tipo,
  actor_id,
  detalhes,
  created_at,
  referencia_syncs ( started_at, status )
`;

const BACKUP_FIELDS = `
  id,
  sync_id,
  payload_sha256,
  contagem,
  created_at,
  referencia_syncs ( started_at )
`;

interface EventoRow {
  id: string;
  sync_id: string | null;
  pendencia_id: string | null;
  referencia_id: string | null;
  tipo: EventoSyncDTO["tipo"];
  actor_id: string | null;
  detalhes: unknown;
  created_at: string;
  referencia_syncs: { started_at: string; status: SyncStatus } | null;
}

interface BackupRow {
  id: string;
  sync_id: string;
  payload_sha256: string;
  contagem: number;
  created_at: string;
  referencia_syncs: { started_at: string } | null;
}

function parseDetails(details: unknown): Record<string, unknown> {
  if (details && typeof details === "object" && !Array.isArray(details)) {
    return details as Record<string, unknown>;
  }

  if (Array.isArray(details)) {
    return { items: details };
  }

  return {};
}

function parseIdentidade(value: unknown): IdentidadeReferenciaSyncDTO | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const identidade = value as Record<string, unknown>;
  if (typeof identidade.nome !== "string" || identidade.nome === "") {
    return null;
  }

  return {
    nome: identidade.nome,
    marca: typeof identidade.marca === "string" ? identidade.marca : "",
    fenil_mg_por_100g: Number(identidade.fenil_mg_por_100g ?? 0),
  };
}

function parseAlteracoes(alteracoes: unknown): AlteracaoSyncDTO[] {
  if (!Array.isArray(alteracoes)) {
    return [];
  }

  return alteracoes
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      op: item.op === "archive" ? ("archive" as const) : ("create" as const),
      referencia_id: typeof item.referencia_id === "string" ? item.referencia_id : null,
      antes: parseIdentidade(item.antes),
      depois: parseIdentidade(item.depois),
    }));
}

function parseSyncRow(row: Record<string, unknown>): ReferenciaSyncDTO {
  return {
    id: String(row.id),
    environment: String(row.environment),
    trigger_source: String(row.trigger_source),
    requested_by: typeof row.requested_by === "string" ? row.requested_by : null,
    status: row.status as SyncStatus,
    started_at: String(row.started_at),
    finished_at: typeof row.finished_at === "string" ? row.finished_at : null,
    total_origem: typeof row.total_origem === "number" ? row.total_origem : null,
    equivalentes: typeof row.equivalentes === "number" ? row.equivalentes : null,
    criadas: typeof row.criadas === "number" ? row.criadas : null,
    arquivadas: typeof row.arquivadas === "number" ? row.arquivadas : null,
    deletadas: typeof row.deletadas === "number" ? row.deletadas : null,
    message: typeof row.message === "string" ? row.message : null,
    details: parseDetails(row.details),
    alteracoes: parseAlteracoes(row.alteracoes),
    created_at: String(row.created_at),
  };
}

function toEventoDTO(row: EventoRow): EventoSyncDTO {
  const detalhes = parseDetails(row.detalhes);
  const referencia =
    typeof detalhes.nome === "string" && detalhes.nome !== ""
      ? { nome: detalhes.nome, marca: typeof detalhes.marca === "string" ? detalhes.marca : "" }
      : null;
  return {
    id: row.id,
    sync_id: row.sync_id,
    pendencia_id: row.pendencia_id,
    referencia_id: row.referencia_id,
    tipo: row.tipo,
    actor_id: row.actor_id,
    detalhes,
    created_at: row.created_at,
    sync: row.referencia_syncs
      ? { started_at: row.referencia_syncs.started_at, status: row.referencia_syncs.status }
      : null,
    referencia,
  };
}

function toBackupDTO(row: BackupRow): BackupSyncDTO {
  return {
    id: row.id,
    sync_id: row.sync_id,
    payload_sha256: row.payload_sha256,
    contagem: row.contagem,
    created_at: row.created_at,
    sync: row.referencia_syncs ? { started_at: row.referencia_syncs.started_at } : null,
  };
}

export function getDefaultReferenciasSyncPageSize() {
  return DEFAULT_PAGE_SIZE;
}

/**
 * Histórico de syncs do AMBIENTE ATUAL. Paginação server-side no padrão de
 * background-jobs (`.range` + count exact).
 */
export async function getSyncsReferencias(filters: {
  status?: SyncStatus;
  page: number;
  pageSize: number;
}): Promise<ReferenciaSyncsPageDTO> {
  const { status, page, pageSize } = filters;
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;

  let query = supabase.from("referencia_syncs").select(SYNC_FIELDS, { count: "exact" });
  query = query.eq("environment", CURRENT_APP_ENVIRONMENT);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query.order("started_at", { ascending: false }).range(from, to);

  if (error || !data) {
    throw new AppError(
      "SYNC_HISTORY_ERROR",
      "Erro ao carregar histórico de sincronizações",
      error,
    );
  }

  return {
    items: (data as Record<string, unknown>[]).map(parseSyncRow),
    total: count ?? 0,
    page,
    pageSize,
  };
}

/**
 * "Matching validado" (§14.4): existe sync bem-sucedida no ambiente (status
 * `success`) — a partir dela o auto-apply está consolidado.
 */
export async function getSyncValidadaAmbiente(): Promise<boolean> {
  const { count, error } = await supabase
    .from("referencia_syncs")
    .select("id", { count: "exact", head: true })
    .eq("environment", CURRENT_APP_ENVIRONMENT)
    .eq("status", "success");

  if (error) {
    throw new AppError(
      "SYNC_STATE_ERROR",
      "Erro ao verificar o estado das sincronizações",
      error,
    );
  }

  return (count ?? 0) > 0;
}

/** Existe sync running no ambiente (single-flight B10) — bloqueia recuperação. */
export async function getSyncRunningAmbiente(): Promise<boolean> {
  const { count, error } = await supabase
    .from("referencia_syncs")
    .select("id", { count: "exact", head: true })
    .eq("environment", CURRENT_APP_ENVIRONMENT)
    .eq("status", "running");

  if (error) {
    throw new AppError(
      "SYNC_STATE_ERROR",
      "Erro ao verificar sincronizações em execução",
      error,
    );
  }

  return (count ?? 0) > 0;
}

/**
 * Auditoria — eventos paginados; filtros por tipo, sync (trilha) e termo no
 * nome da referência (filtro no embed `referencias.nome`, padrão ilike).
 */
export async function getEventosReferencia(filters: {
  tipo?: EventoSyncDTO["tipo"];
  syncId?: string;
  termoReferencia?: string;
  page: number;
  pageSize: number;
}): Promise<EventosSyncPageDTO> {
  const { tipo, syncId, termoReferencia, page, pageSize } = filters;
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;

  let query = supabase.from("referencia_eventos").select(EVENTO_FIELDS, { count: "exact" });

  if (tipo) {
    query = query.eq("tipo", tipo);
  }

  if (syncId) {
    query = query.eq("sync_id", syncId);
  }

  const termo = termoReferencia?.trim();
  if (termo) {
    // ENH-0009: FK removida → filtra pelo nome gravado em detalhes (jsonb ->>)
    query = query.ilike("detalhes->>nome", `%${termo}%`);
  }

  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);

  if (error || !data) {
    throw new AppError(
      "SYNC_AUDIT_ERROR",
      "Erro ao carregar auditoria de eventos",
      error,
    );
  }

  return {
    items: (data as unknown as EventoRow[]).map(toEventoDTO),
    total: count ?? 0,
    page,
    pageSize,
  };
}

/** Backups recentes para restauração excepcional (ordem decrescente). */
export async function getBackupsReferencia(limit = DEFAULT_BACKUPS_LIMIT): Promise<BackupSyncDTO[]> {
  const { data, error } = await supabase
    .from("referencia_backups")
    .select(BACKUP_FIELDS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    throw new AppError(
      "SYNC_BACKUPS_ERROR",
      "Erro ao carregar backups de referências",
      error,
    );
  }

  return (data as unknown as BackupRow[]).map(toBackupDTO);
}

/** Coluna `usuarios.pode_recuperacao` da própria sessão (gate da aba). */
export async function getPermissaoRecuperacao(usuarioId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("usuarios")
    .select("pode_recuperacao")
    .eq("id", usuarioId)
    .maybeSingle();

  if (error) {
    throw new AppError(
      "SYNC_RECOVERY_PERMISSION_ERROR",
      "Erro ao verificar permissão de recuperação",
      error,
    );
  }

  return data?.pode_recuperacao === true;
}

/** Restauração excepcional via RPC (admin + pode_recuperacao). */
export async function restaurarBackupReferencias(
  backupId: string,
): Promise<ResultadoRestaurarBackupDTO> {
  const { data, error } = await supabase
    .rpc("restaurar_referencias_de_backup", { p_backup_id: backupId })
    .single<ResultadoRestaurarBackupDTO>();

  if (error || !data) {
    throw new AppError(
      "SYNC_RESTORE_ERROR",
      "Erro ao restaurar backup de referências",
      error,
    );
  }

  return data;
}

/**
 * Execução manual da sync (POST `/api/referencias-sync` com JWT da sessão).
 */
export async function executarSyncManual(): Promise<ResultadoSyncManualDTO> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;

  if (!accessToken) {
    throw new AppError("SYNC_MANUAL_AUTH_ERROR", "Sessão expirada — faça login novamente");
  }

  const res = await fetch("/api/referencias-sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    sync_id?: string;
    status?: string;
  };

  if (!res.ok) {
    throw new AppError(
      "SYNC_MANUAL_ERROR",
      body.error ?? "Falha ao executar sincronização",
      undefined,
    );
  }

  return {
    sync_id: body.sync_id ?? "",
    status: body.status ?? "",
  };
}
