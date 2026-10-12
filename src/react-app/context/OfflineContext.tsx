import { createContext, useContext, useCallback, ReactNode } from 'react';
import { useOnlineStatus } from '@/react-app/hooks/useOnlineStatus';
import { setLastSync } from '@/react-app/services/offlineStorage.service';

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
  const onSync = useCallback(async () => {
    if (userId) {
      await setLastSync(userId, new Date()).catch(() => {});
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
