import { supabase } from "@/react-app/lib/supabase";
import { AppError } from "@/react-app/lib/errors";
import { CURRENT_APP_ENVIRONMENT } from "@/react-app/lib/app-environment";
import {
  AlteracaoSyncDTO,
  BackupSyncDTO,
  EventoSyncDTO,
  EventosSyncPageDTO,
  IdentidadeReferenciaSyncDTO,
  PendenciaSyncDTO,
  PendenciasSyncPageDTO,
  ReferenciaSyncDTO,
  ReferenciaSyncsPageDTO,
  ResultadoRestaurarBackupDTO,
  ResultadoReverterSyncDTO,
  ResultadoSyncManualDTO,
  SyncStatus,
} from "./dtos/referencias-sync.dto";

const DEFAULT_PAGE_SIZE = 3;
const DEFAULT_BACKUPS_LIMIT = 25;
const DEFAULT_REVERTIVEIS_LIMIT = 50;

const SYNC_FIELDS = `
  id,
  environment,
  trigger_source,
  requested_by,
  bootstrap,
  status,
  started_at,
  finished_at,
  total_origem,
  equivalentes,
  criadas,
  arquivadas,
  divergencias,
  message,
  details,
  alteracoes,
  created_at
`;

const PENDENCIA_FIELDS = `
  id,
  sync_id,
  tipo,
  referencia_id,
  proposta,
  diff,
  status,
  motivo,
  created_at,
  decided_at,
  decided_by,
  referencia_syncs ( started_at, status ),
  referencias ( nome, marca, fenil_mg_por_100g )
`;

const EVENTO_FIELDS = `
  id,
  sync_id,
  pendencia_id,
  referencia_id,
  tipo,
  actor_id,
  detalhes,
  created_at,
  referencia_syncs ( started_at, status ),
  referencias ( nome, marca )
`;

const BACKUP_FIELDS = `
  id,
  sync_id,
  payload_sha256,
  contagem,
  created_at,
  referencia_syncs ( started_at )
`;

/** Linha crua do banco — embeds em posição fixa (sem DTO tipado do gerador). */
interface PendenciaRow {
  id: string;
  sync_id: string;
  tipo: PendenciaSyncDTO["tipo"];
  referencia_id: string | null;
  proposta: unknown;
  diff: unknown;
  status: PendenciaSyncDTO["status"];
  motivo: string | null;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
  referencia_syncs: { started_at: string; status: SyncStatus } | null;
  referencias: { nome: string; marca: string; fenil_mg_por_100g: number } | null;
}

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
  referencias: { nome: string; marca: string } | null;
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

/** jsonb `antes`/`depois` das operações — null quando não é objeto. */
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

function parseProposta(proposta: unknown): IdentidadeReferenciaSyncDTO | null {
  return parseIdentidade(proposta);
}

function parseDiff(diff: unknown): PendenciaSyncDTO["diff"] {
  if (!Array.isArray(diff)) {
    return null;
  }

  return diff
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      campo: item.campo as "nome" | "marca" | "fenil_mg_por_100g",
      antes: item.antes as string | number,
      depois: item.depois as string | number,
    }));
}

function parseSyncRow(row: Record<string, unknown>): ReferenciaSyncDTO {
  return {
    id: String(row.id),
    environment: String(row.environment),
    trigger_source: String(row.trigger_source),
    requested_by: typeof row.requested_by === "string" ? row.requested_by : null,
    bootstrap: row.bootstrap === true,
    status: row.status as SyncStatus,
    started_at: String(row.started_at),
    finished_at: typeof row.finished_at === "string" ? row.finished_at : null,
    total_origem: typeof row.total_origem === "number" ? row.total_origem : null,
    equivalentes: typeof row.equivalentes === "number" ? row.equivalentes : null,
    criadas: typeof row.criadas === "number" ? row.criadas : null,
    arquivadas: typeof row.arquivadas === "number" ? row.arquivadas : null,
    divergencias: typeof row.divergencias === "number" ? row.divergencias : null,
    message: typeof row.message === "string" ? row.message : null,
    details: parseDetails(row.details),
    alteracoes: parseAlteracoes(row.alteracoes),
    created_at: String(row.created_at),
  };
}

function toPendenciaDTO(row: PendenciaRow): PendenciaSyncDTO {
  return {
    id: row.id,
    sync_id: row.sync_id,
    tipo: row.tipo,
    referencia_id: row.referencia_id,
    proposta: parseProposta(row.proposta),
    diff: parseDiff(row.diff),
    status: row.status,
    motivo: row.motivo,
    created_at: row.created_at,
    decided_at: row.decided_at,
    decided_by: row.decided_by,
    sync: row.referencia_syncs
      ? { started_at: row.referencia_syncs.started_at, status: row.referencia_syncs.status }
      : null,
    referencia: row.referencias,
  };
}

function toEventoDTO(row: EventoRow): EventoSyncDTO {
  return {
    id: row.id,
    sync_id: row.sync_id,
    pendencia_id: row.pendencia_id,
    referencia_id: row.referencia_id,
    tipo: row.tipo,
    actor_id: row.actor_id,
    detalhes: parseDetails(row.detalhes),
    created_at: row.created_at,
    sync: row.referencia_syncs
      ? { started_at: row.referencia_syncs.started_at, status: row.referencia_syncs.status }
      : null,
    referencia: row.referencias,
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
 * Histórico de syncs do AMBIENTE ATUAL (cada environment tem seu catálogo —
 * no dev as fixtures de teste vivem em environments próprios, fora daqui).
 * Paginação server-side no padrão de background-jobs (`.range` + count exact).
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
 * "Matching validado" (§14.4): existe sync confiável concluída no ambiente
 * (success/pending_review) — a partir dela o auto-apply passa a valer.
 */
export async function getSyncValidadaAmbiente(): Promise<boolean> {
  const { count, error } = await supabase
    .from("referencia_syncs")
    .select("id", { count: "exact", head: true })
    .eq("environment", CURRENT_APP_ENVIRONMENT)
    .in("status", ["success", "pending_review"]);

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

/** Syncs elegíveis a rollback (RPC M5 só aceita success/pending_review). */
export async function getSyncsRevertiveis(): Promise<ReferenciaSyncDTO[]> {
  const { data, error } = await supabase
    .from("referencia_syncs")
    .select(SYNC_FIELDS)
    .eq("environment", CURRENT_APP_ENVIRONMENT)
    .in("status", ["success", "pending_review"])
    .order("started_at", { ascending: false })
    .limit(DEFAULT_REVERTIVEIS_LIMIT);

  if (error || !data) {
    throw new AppError(
      "SYNC_ROLLBACK_LIST_ERROR",
      "Erro ao carregar sincronizações revertíveis",
      error,
    );
  }

  return (data as Record<string, unknown>[]).map(parseSyncRow);
}

/**
 * Pendências de curadoria — embed da referência atual e da sync de origem;
 * filtro por status e, quando aberta a trilha de um sync, por sync_id.
 */
export async function getPendenciasReferencia(filters: {
  status?: PendenciaSyncDTO["status"];
  syncId?: string;
  page: number;
  pageSize: number;
}): Promise<PendenciasSyncPageDTO> {
  const { status, syncId, page, pageSize } = filters;
  const from = Math.max(0, (page - 1) * pageSize);
  const to = from + pageSize - 1;

  let query = supabase.from("referencia_sync_pendencias").select(PENDENCIA_FIELDS, { count: "exact" });

  if (status) {
    query = query.eq("status", status);
  }

  if (syncId) {
    query = query.eq("sync_id", syncId);
  }

  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);

  if (error || !data) {
    throw new AppError(
      "SYNC_PENDENCIAS_ERROR",
      "Erro ao carregar pendências de curadoria",
      error,
    );
  }

  return {
    items: (data as unknown as PendenciaRow[]).map(toPendenciaDTO),
    total: count ?? 0,
    page,
    pageSize,
  };
}

/**
 * Histórico da MESMA divergência (reincidência/decisões anteriores):
 * absence/substitution rastreiam por referencia_id; new_item por identidade da
 * proposta (nome+marca — a chave do matching). Ordenado da mais recente.
 */
export async function getHistoricoPendencia(
  pendencia: PendenciaSyncDTO,
): Promise<PendenciaSyncDTO[]> {
  // Sem referência nem proposta não há como rastrear a divergência — nada a
  // consultar (linha corrompida; a própria lista já não a exibiria útil).
  if (!pendencia.referencia_id && !pendencia.proposta) {
    return [];
  }

  let query = supabase.from("referencia_sync_pendencias").select(PENDENCIA_FIELDS);

  if (pendencia.referencia_id) {
    query = query.eq("referencia_id", pendencia.referencia_id);
  } else if (pendencia.proposta) {
    query = query
      .eq("proposta->>nome", pendencia.proposta.nome)
      .eq("proposta->>marca", pendencia.proposta.marca ?? "");
  }

  const { data, error } = await query
    .eq("tipo", pendencia.tipo)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error || !data) {
    throw new AppError(
      "SYNC_PENDENCIA_HISTORY_ERROR",
      "Erro ao carregar histórico da divergência",
      error,
    );
  }

  return (data as unknown as PendenciaRow[]).map(toPendenciaDTO);
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
    query = query.ilike("referencias.nome", `%${termo}%`);
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

/** Curadoria: decisão de pendência via RPC do M4 (admin real autenticado). */
export async function decidirPendenciaReferencia(
  pendenciaId: string,
  aprovar: boolean,
  motivo?: string,
): Promise<{ pendencia_id: string; status: string; sync_id: string; sync_status: string }> {
  const { data, error } = await supabase
    .rpc("decidir_pendencia_referencia", {
      p_pendencia_id: pendenciaId,
      p_aprovar: aprovar,
      p_motivo: motivo ?? null,
    })
    .single<{ pendencia_id: string; status: string; sync_id: string; sync_status: string }>();

  if (error || !data) {
    throw new AppError(
      aprovar ? "SYNC_APROVAR_PENDENCIA_ERROR" : "SYNC_REJEITAR_PENDENCIA_ERROR",
      aprovar ? "Erro ao aprovar mudança" : "Erro ao rejeitar mudança",
      error,
    );
  }

  return data;
}

/** Rollback seletivo via RPC do M5 (admin + pode_recuperacao). */
export async function reverterSyncReferencias(syncId: string): Promise<ResultadoReverterSyncDTO> {
  const { data, error } = await supabase
    .rpc("reverter_sync_referencias", { p_sync_id: syncId })
    .single<ResultadoReverterSyncDTO>();

  if (error || !data) {
    throw new AppError(
      "SYNC_ROLLBACK_ERROR",
      "Erro ao reverter sincronização",
      error,
    );
  }

  return data;
}

/** Restauração excepcional via RPC do M5 (admin + pode_recuperacao). */
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
 * Execução manual da sync (POST `/api/referencias-sync` com JWT da sessão —
 * autorização da rota, M2). Usada apenas no ambiente prod (R4-1a: a rota
 * sincroniza o catálogo de produção).
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
