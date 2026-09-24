import { useCallback, useEffect, useMemo, useState } from "react";
import { AppError } from "@/react-app/lib/errors";
import { logger } from "@/react-app/lib/logger";
import {
  executarSyncManual,
  getBackupsReferencia,
  getEventosReferencia,
  getPermissaoRecuperacao,
  getSyncRunningAmbiente,
  getSyncsReferencias,
  getSyncValidadaAmbiente,
  getDefaultReferenciasSyncPageSize,
  restaurarBackupReferencias,
} from "@/react-app/services/referencias-sync.service";
import {
  BackupSyncDTO,
  EventoSyncDTO,
  ReferenciaSyncDTO,
  ResultadoSyncManualDTO,
  SyncEventoTipo,
  SyncStatus,
} from "@/react-app/services/dtos/referencias-sync.dto";

type FiltroStatusSync = SyncStatus | "all";
type FiltroTipoEvento = SyncEventoTipo | "all";

interface DominioPaginado<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  loading: boolean;
  error: AppError | null;
}

/**
 * Dados da seção "Sincronização de Referências" do Admin (FEAT-0017/ENH-0009).
 *
 * Domínios: histórico de syncs, auditoria de eventos, backups (recuperação),
 * estado "matching validado" e a permissão `pode_recuperacao` da sessão.
 * Curadoria e rollback seletivo removidos (ENH-0009). Paginação server-side
 * no padrão de `useBackgroundJobsAdmin`.
 */
export function useReferenciasSyncAdmin(usuarioId?: string, enabled = false) {
  const [matchingValidado, setMatchingValidado] = useState<boolean | null>(null);
  const [podeRecuperar, setPodeRecuperar] = useState(false);
  const [syncRunning, setSyncRunning] = useState<boolean | null>(null);
  const [recuperacaoLoading, setRecuperacaoLoading] = useState(false);

  const pageSizeDefault = getDefaultReferenciasSyncPageSize();

  // Histórico de syncs
  const [syncs, setSyncs] = useState<ReferenciaSyncDTO[]>([]);
  const [syncsTotal, setSyncsTotal] = useState(0);
  const [syncsPage, setSyncsPage] = useState(1);
  const [syncsPageSize, setSyncsPageSizeState] = useState(pageSizeDefault);
  const [syncsStatus, setSyncsStatusState] = useState<FiltroStatusSync>("all");
  const [syncsLoading, setSyncsLoading] = useState(false);
  const [syncsError, setSyncsError] = useState<AppError | null>(null);

  // Auditoria de eventos
  const [eventos, setEventos] = useState<EventoSyncDTO[]>([]);
  const [eventosTotal, setEventosTotal] = useState(0);
  const [eventosPage, setEventosPage] = useState(1);
  const [eventosPageSize, setEventosPageSizeState] = useState(pageSizeDefault);
  const [eventosTipo, setEventosTipoState] = useState<FiltroTipoEvento>("all");
  const [eventosSyncId, setEventosSyncIdState] = useState<string | null>(null);
  const [eventosTermo, setEventosTermoState] = useState("");
  const [eventosLoading, setEventosLoading] = useState(false);
  const [eventosError, setEventosError] = useState<AppError | null>(null);

  // Recuperação: backups
  const [backups, setBackups] = useState<BackupSyncDTO[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupsError, setBackupsError] = useState<AppError | null>(null);

  // Execução manual
  const [executandoSync, setExecutandoSync] = useState(false);

  const totalPagesDe = (total: number, size: number) => Math.max(1, Math.ceil(total / size));

  const syncsTotalPages = useMemo(
    () => totalPagesDe(syncsTotal, syncsPageSize),
    [syncsTotal, syncsPageSize],
  );
  const eventosTotalPages = useMemo(
    () => totalPagesDe(eventosTotal, eventosPageSize),
    [eventosTotal, eventosPageSize],
  );

  // ---------- Cargas por domínio ----------

  const loadSyncs = useCallback(async () => {
    if (!enabled) return;
    try {
      setSyncsLoading(true);
      setSyncsError(null);
      const data = await getSyncsReferencias({
        status: syncsStatus === "all" ? undefined : syncsStatus,
        page: syncsPage,
        pageSize: syncsPageSize,
      });
      setSyncs(data.items);
      setSyncsTotal(data.total);
    } catch (err) {
      const appError = toAppError(err, "Erro inesperado ao carregar sincronizações");
      logger.error("Erro em useReferenciasSyncAdmin (syncs)", appError);
      setSyncsError(appError);
      setSyncs([]);
      setSyncsTotal(0);
    } finally {
      setSyncsLoading(false);
    }
  }, [enabled, syncsStatus, syncsPage, syncsPageSize]);

  const loadEstadoAmbiente = useCallback(async () => {
    if (!enabled || !usuarioId) return;
    try {
      setRecuperacaoLoading(true);
      const [validada, running, permissao] = await Promise.all([
        getSyncValidadaAmbiente(),
        getSyncRunningAmbiente(),
        getPermissaoRecuperacao(usuarioId),
      ]);
      setMatchingValidado(validada);
      setSyncRunning(running);
      setPodeRecuperar(permissao);
    } catch (err) {
      const appError = toAppError(err, "Erro inesperado ao verificar o estado das sincronizações");
      logger.error("Erro em useReferenciasSyncAdmin (estado)", appError);
    } finally {
      setRecuperacaoLoading(false);
    }
  }, [enabled, usuarioId]);

  const loadEventos = useCallback(async () => {
    if (!enabled) return;
    try {
      setEventosLoading(true);
      setEventosError(null);
      const data = await getEventosReferencia({
        tipo: eventosTipo === "all" ? undefined : eventosTipo,
        syncId: eventosSyncId ?? undefined,
        termoReferencia: eventosTermo || undefined,
        page: eventosPage,
        pageSize: eventosPageSize,
      });
      setEventos(data.items);
      setEventosTotal(data.total);
    } catch (err) {
      const appError = toAppError(err, "Erro inesperado ao carregar auditoria");
      logger.error("Erro em useReferenciasSyncAdmin (auditoria)", appError);
      setEventosError(appError);
      setEventos([]);
      setEventosTotal(0);
    } finally {
      setEventosLoading(false);
    }
  }, [enabled, eventosTipo, eventosSyncId, eventosTermo, eventosPage, eventosPageSize]);

  const loadRecuperacao = useCallback(async () => {
    if (!enabled) return;
    try {
      setBackupsLoading(true);
      setBackupsError(null);
      const backupsData = await getBackupsReferencia();
      setBackups(backupsData);
    } catch (err) {
      const appError = toAppError(err, "Erro inesperado ao carregar backups");
      logger.error("Erro em useReferenciasSyncAdmin (recuperação)", appError);
      setBackups([]);
      setBackupsError(appError);
    } finally {
      setBackupsLoading(false);
    }
  }, [enabled]);

  const loadTudo = useCallback(async () => {
    if (!enabled) return;
    await Promise.all([loadSyncs(), loadEventos(), loadRecuperacao(), loadEstadoAmbiente()]);
  }, [enabled, loadSyncs, loadEventos, loadRecuperacao, loadEstadoAmbiente]);

  useEffect(() => {
    if (enabled) loadSyncs();
  }, [loadSyncs, enabled]);

  useEffect(() => {
    if (enabled) loadEventos();
  }, [loadEventos, enabled]);

  useEffect(() => {
    if (enabled) loadRecuperacao();
  }, [loadRecuperacao, enabled]);

  useEffect(() => {
    if (enabled) loadEstadoAmbiente();
  }, [loadEstadoAmbiente, enabled]);

  // Clamp de página após mudança de total
  useEffect(() => {
    if (syncsPage > syncsTotalPages) setSyncsPage(syncsTotalPages);
  }, [syncsPage, syncsTotalPages]);

  useEffect(() => {
    if (eventosPage > eventosTotalPages) setEventosPage(eventosTotalPages);
  }, [eventosPage, eventosTotalPages]);

  // ---------- Filtros (resetam para a página 1) ----------

  const setSyncsStatus = useCallback((status: FiltroStatusSync) => {
    setSyncsStatusState(status);
    setSyncsPage(1);
  }, []);

  const setSyncsPageSize = useCallback((size: number) => {
    setSyncsPageSizeState(size);
    setSyncsPage(1);
  }, []);

  const setEventosTipo = useCallback((tipo: FiltroTipoEvento) => {
    setEventosTipoState(tipo);
    setEventosPage(1);
  }, []);

  const setEventosSyncId = useCallback((syncId: string | null) => {
    setEventosSyncIdState(syncId);
    setEventosTermoState("");
    setEventosPage(1);
  }, []);

  const setEventosTermo = useCallback((termo: string) => {
    setEventosTermoState(termo.trim());
    setEventosPage(1);
  }, []);

  const setEventosPageSize = useCallback((size: number) => {
    setEventosPageSizeState(size);
    setEventosPage(1);
  }, []);

  // ---------- Ações ----------

  const restaurarBackup = useCallback(
    async (backupId: string) => {
      const resultado = await restaurarBackupReferencias(backupId);
      await loadTudo();
      return resultado;
    },
    [loadTudo],
  );

  const executarSync = useCallback(async (): Promise<ResultadoSyncManualDTO> => {
    try {
      setExecutandoSync(true);
      const resultado = await executarSyncManual();
      await loadTudo();
      return resultado;
    } finally {
      setExecutandoSync(false);
    }
  }, [loadTudo]);

  const reload = useCallback(() => loadTudo(), [loadTudo]);

  const resetaTrilhas = useCallback(() => {
    setEventosSyncIdState(null);
    setEventosPage(1);
  }, []);

  return {
    matchingValidado,
    podeRecuperar,
    syncRunning,
    recuperacaoLoading,
    executandoSync,
    reload,
    resetaTrilhas,
    syncs: {
      items: syncs,
      total: syncsTotal,
      page: syncsPage,
      pageSize: syncsPageSize,
      totalPages: syncsTotalPages,
      loading: syncsLoading,
      error: syncsError,
    } as DominioPaginado<ReferenciaSyncDTO>,
    syncsStatus,
    setSyncsStatus,
    setSyncsPage,
    setSyncsPageSize,
    eventos: {
      items: eventos,
      total: eventosTotal,
      page: eventosPage,
      pageSize: eventosPageSize,
      totalPages: eventosTotalPages,
      loading: eventosLoading,
      error: eventosError,
    } as DominioPaginado<EventoSyncDTO>,
    eventosTipo,
    eventosSyncId,
    eventosTermo,
    setEventosTipo,
    setEventosSyncId,
    setEventosTermo,
    setEventosPage,
    setEventosPageSize,
    backups: { items: backups, loading: backupsLoading, error: backupsError },
    restaurarBackup,
    executarSync,
  };
}

function toAppError(err: unknown, fallback: string): AppError {
  return err instanceof AppError ? err : new AppError("REFERENCIAS_SYNC_UNKNOWN_ERROR", fallback, err);
}
