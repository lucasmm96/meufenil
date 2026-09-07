import { useCallback, useEffect, useMemo, useState } from "react";
import { AppError } from "@/react-app/lib/errors";
import { logger } from "@/react-app/lib/logger";
import {
  decidirPendenciaReferencia,
  executarSyncManual,
  getBackupsReferencia,
  getEventosReferencia,
  getHistoricoPendencia,
  getPendenciasReferencia,
  getPermissaoRecuperacao,
  getSyncRunningAmbiente,
  getSyncsReferencias,
  getSyncsRevertiveis,
  getSyncValidadaAmbiente,
  getDefaultReferenciasSyncPageSize,
  restaurarBackupReferencias,
  reverterSyncReferencias,
} from "@/react-app/services/referencias-sync.service";
import {
  BackupSyncDTO,
  EventoSyncDTO,
  PendenciaSyncDTO,
  ReferenciaSyncDTO,
  ResultadoSyncManualDTO,
  SyncEventoTipo,
  SyncPendenciaStatus,
  SyncStatus,
} from "@/react-app/services/dtos/referencias-sync.dto";

/** Filtro com "all" = sem filtro (enviado `undefined` ao service). */
type FiltroStatusSync = SyncStatus | "all";
type FiltroStatusPendencia = SyncPendenciaStatus | "all";
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
 * Dados da seção "Sincronização de Referências" do Admin (FEAT-0017, M6).
 *
 * Domínios: histórico de syncs, pendências de curadoria, auditoria de
 * eventos, backups/rollback (recuperação), estado "matching validado" e a
 * permissão `pode_recuperacao` da sessão. Paginação server-side no padrão de
 * `useBackgroundJobsAdmin`; mutações chamam as RPCs do M4/M5 e o POST manual
 * da rota, relançando o erro para a página exibir.
 */
export function useReferenciasSyncAdmin(usuarioId?: string, enabled = false) {
  // Estado do ambiente + permissão (gate da aba Recuperação)
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

  // Pendências de curadoria
  const [pendencias, setPendencias] = useState<PendenciaSyncDTO[]>([]);
  const [pendenciasTotal, setPendenciasTotal] = useState(0);
  const [pendenciasPage, setPendenciasPage] = useState(1);
  const [pendenciasPageSize, setPendenciasPageSizeState] = useState(pageSizeDefault);
  const [pendenciasStatus, setPendenciasStatusState] = useState<FiltroStatusPendencia>("open");
  const [pendenciasSyncId, setPendenciasSyncIdState] = useState<string | null>(null);
  const [pendenciasLoading, setPendenciasLoading] = useState(false);
  const [pendenciasError, setPendenciasError] = useState<AppError | null>(null);

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

  // Recuperação: backups + syncs revertíveis
  const [backups, setBackups] = useState<BackupSyncDTO[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupsError, setBackupsError] = useState<AppError | null>(null);

  const [syncsRevertiveis, setSyncsRevertiveis] = useState<ReferenciaSyncDTO[]>([]);
  const [revertiveisLoading, setRevertiveisLoading] = useState(false);
  const [revertiveisError, setRevertiveisError] = useState<AppError | null>(null);

  // Execução manual (rota prod)
  const [executandoSync, setExecutandoSync] = useState(false);

  const totalPagesDe = (total: number, size: number) => Math.max(1, Math.ceil(total / size));

  const syncsTotalPages = useMemo(
    () => totalPagesDe(syncsTotal, syncsPageSize),
    [syncsTotal, syncsPageSize],
  );
  const pendenciasTotalPages = useMemo(
    () => totalPagesDe(pendenciasTotal, pendenciasPageSize),
    [pendenciasTotal, pendenciasPageSize],
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

  const loadPendencias = useCallback(async () => {
    if (!enabled) return;
    try {
      setPendenciasLoading(true);
      setPendenciasError(null);
      const data = await getPendenciasReferencia({
        status: pendenciasStatus === "all" ? undefined : pendenciasStatus,
        syncId: pendenciasSyncId ?? undefined,
        page: pendenciasPage,
        pageSize: pendenciasPageSize,
      });
      setPendencias(data.items);
      setPendenciasTotal(data.total);
    } catch (err) {
      const appError = toAppError(err, "Erro inesperado ao carregar pendências de curadoria");
      logger.error("Erro em useReferenciasSyncAdmin (pendências)", appError);
      setPendenciasError(appError);
      setPendencias([]);
      setPendenciasTotal(0);
    } finally {
      setPendenciasLoading(false);
    }
  }, [enabled, pendenciasStatus, pendenciasSyncId, pendenciasPage, pendenciasPageSize]);

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
      setRevertiveisLoading(true);
      setBackupsError(null);
      setRevertiveisError(null);
      const [backupsData, revertiveisData] = await Promise.all([
        getBackupsReferencia(),
        getSyncsRevertiveis(),
      ]);
      setBackups(backupsData);
      setSyncsRevertiveis(revertiveisData);
    } catch (err) {
      const appError = toAppError(err, "Erro inesperado ao carregar recuperação");
      logger.error("Erro em useReferenciasSyncAdmin (recuperação)", appError);
      setBackups([]);
      setSyncsRevertiveis([]);
      setBackupsError(appError);
      setRevertiveisError(appError);
    } finally {
      setBackupsLoading(false);
      setRevertiveisLoading(false);
    }
  }, [enabled]);

  const loadTudo = useCallback(async () => {
    if (!enabled) return;
    await Promise.all([loadSyncs(), loadPendencias(), loadEventos(), loadRecuperacao(), loadEstadoAmbiente()]);
  }, [enabled, loadSyncs, loadPendencias, loadEventos, loadRecuperacao, loadEstadoAmbiente]);

  // Cargas: cada domínio reage a filtros/paginação via callback com deps
  // (padrão useBackgroundJobsAdmin). Quando `enabled` cai, os callbacks
  // retornam cedo e os domínios permanecem como estão (a página desmonta a
  // seção junto — estado local do hook não é reaproveitado entre sessões).

  useEffect(() => {
    if (enabled) loadSyncs();
  }, [loadSyncs, enabled]);

  useEffect(() => {
    if (enabled) loadPendencias();
  }, [loadPendencias, enabled]);

  useEffect(() => {
    if (enabled) loadEventos();
  }, [loadEventos, enabled]);

  useEffect(() => {
    if (enabled) loadRecuperacao();
  }, [loadRecuperacao, enabled]);

  useEffect(() => {
    if (enabled) loadEstadoAmbiente();
  }, [loadEstadoAmbiente, enabled]);

  // Clamp de página após mudança de total (padrão useBackgroundJobsAdmin)
  useEffect(() => {
    if (syncsPage > syncsTotalPages) setSyncsPage(syncsTotalPages);
  }, [syncsPage, syncsTotalPages]);

  useEffect(() => {
    if (pendenciasPage > pendenciasTotalPages) setPendenciasPage(pendenciasTotalPages);
  }, [pendenciasPage, pendenciasTotalPages]);

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

  const setPendenciasStatus = useCallback((status: FiltroStatusPendencia) => {
    setPendenciasStatusState(status);
    setPendenciasSyncIdState(null);
    setPendenciasPage(1);
  }, []);

  const setPendenciasSyncId = useCallback((syncId: string | null) => {
    setPendenciasSyncIdState(syncId);
    setPendenciasPage(1);
  }, []);

  const setPendenciasPageSize = useCallback((size: number) => {
    setPendenciasPageSizeState(size);
    setPendenciasPage(1);
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

  // ---------- Ações (RPCs M4/M5 + rota) ----------

  const historicoPendencia = useCallback(
    async (pendencia: PendenciaSyncDTO): Promise<PendenciaSyncDTO[]> => {
      if (!enabled) return [];
      try {
        return await getHistoricoPendencia(pendencia);
      } catch (err) {
        const appError = toAppError(err, "Erro inesperado ao carregar histórico da divergência");
        logger.error("Erro em useReferenciasSyncAdmin (histórico)", appError);
        throw appError;
      }
    },
    [enabled],
  );

  const decidirPendencia = useCallback(
    async (pendenciaId: string, aprovar: boolean, motivo?: string) => {
      const resultado = await decidirPendenciaReferencia(pendenciaId, aprovar, motivo);
      await loadTudo();
      return resultado;
    },
    [loadTudo],
  );

  const reverterSync = useCallback(
    async (syncId: string) => {
      const resultado = await reverterSyncReferencias(syncId);
      await loadTudo();
      return resultado;
    },
    [loadTudo],
  );

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
    setPendenciasSyncIdState(null);
    setEventosSyncIdState(null);
    setPendenciasPage(1);
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
    pendencias: {
      items: pendencias,
      total: pendenciasTotal,
      page: pendenciasPage,
      pageSize: pendenciasPageSize,
      totalPages: pendenciasTotalPages,
      loading: pendenciasLoading,
      error: pendenciasError,
    } as DominioPaginado<PendenciaSyncDTO>,
    pendenciasStatus,
    pendenciasSyncId,
    setPendenciasStatus,
    setPendenciasSyncId,
    setPendenciasPage,
    setPendenciasPageSize,
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
    syncsRevertiveis: { items: syncsRevertiveis, loading: revertiveisLoading, error: revertiveisError },
    historicoPendencia,
    decidirPendencia,
    reverterSync,
    restaurarBackup,
    executarSync,
  };
}

function toAppError(err: unknown, fallback: string): AppError {
  return err instanceof AppError ? err : new AppError("REFERENCIAS_SYNC_UNKNOWN_ERROR", fallback, err);
}
