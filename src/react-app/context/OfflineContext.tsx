import { createContext, useContext, useCallback, useRef, ReactNode } from 'react';
import { format, subDays } from 'date-fns';
import { useOnlineStatus } from '@/react-app/hooks/useOnlineStatus';
import { write, setLastSync } from '@/react-app/services/offlineStorage.service';
import { processarFilaSync } from '@/react-app/services/sync.service';
import { getReferencias } from '@/react-app/services/referencias.service';
import { getRegistros } from '@/react-app/services/registros.service';
import { getUsuarioPerfil } from '@/react-app/services/usuarios.service';

interface OfflineContextType {
  isOnline: boolean;
  isSyncing: boolean;
  syncError: string | null;
  isIos: boolean;
}

const OfflineContext = createContext<OfflineContextType>({
  isOnline: true,
  isSyncing: false,
  syncError: null,
  isIos: false,
});

interface OfflineProviderProps {
  children: ReactNode;
  userId?: string | null;
}

export function OfflineProvider({ children, userId }: OfflineProviderProps) {
  const syncingRef = useRef(false);

  const onSync = useCallback(async () => {
    if (!userId || syncingRef.current) return;
    syncingRef.current = true;

    try {
      // Sync pending ops before repopulating stores
      await processarFilaSync(userId).catch(() => {});

      const today = format(new Date(), 'yyyy-MM-dd');
      const sevenDaysAgo = format(subDays(new Date(), 6), 'yyyy-MM-dd');

      const [refs, registros, perfil] = await Promise.allSettled([
        getReferencias({ usuarioId: userId, search: '', orderBy: 'nome', showInativas: false }),
        getRegistros(userId, sevenDaysAgo, today),
        getUsuarioPerfil(userId),
      ]);

      if (refs.status === 'fulfilled') {
        const favoritas = refs.value.filter((r) => r.is_favorita);
        const customizadas = refs.value.filter((r) => r.criado_por === userId);
        await write('favoritos', userId, favoritas).catch(() => {});
        await write('customizadas', userId, customizadas).catch(() => {});
      }
      if (registros.status === 'fulfilled') {
        await write('historico', userId, registros.value).catch(() => {});
      }
      if (perfil.status === 'fulfilled') {
        await write('perfil', userId, perfil.value).catch(() => {});
      }
      await setLastSync(userId, new Date()).catch(() => {});
    } finally {
      syncingRef.current = false;
    }
  }, [userId]);

  const { isOnline, isSyncing, syncError, isIos } = useOnlineStatus(onSync);

  return (
    <OfflineContext.Provider value={{ isOnline, isSyncing, syncError, isIos }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline(): OfflineContextType {
  return useContext(OfflineContext);
}
