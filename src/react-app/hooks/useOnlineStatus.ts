import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/react-app/lib/supabase';

export interface OnlineStatusState {
  isOnline: boolean;
  isSyncing: boolean;
  syncError: string | null;
  isIos: boolean;
  triggerSync: () => Promise<void>;
}

function detectIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

async function runPings(attempts = 2, intervalMs = 1000): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      await fetch('/favicon.ico', { method: 'HEAD', cache: 'no-store' });
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    } catch {
      return false;
    }
  }
  return true;
}

export function useOnlineStatus(onSync?: () => Promise<void>): OnlineStatusState {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isIos] = useState(() =>
    typeof navigator !== 'undefined' ? detectIos() : false
  );

  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;

  const triggerSync = useCallback(async () => {
    setSyncError(null);
    setIsSyncing(true);
    try {
      if (onSyncRef.current) {
        await onSyncRef.current();
      }
    } catch {
      setSyncError('Erro ao sincronizar. Tentaremos novamente em breve.');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    // Verificar sessão ao inicializar
    supabase.auth.getSession().catch(() => {
      // sessão indisponível — componente pai trata redirect
    });

    const handleOnline = async () => {
      const confirmed = await runPings();
      if (confirmed) {
        setIsOnline(true);
        setSyncError(null);
        await triggerSync();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncError(null);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [triggerSync]);

  return { isOnline, isSyncing, syncError, isIos, triggerSync };
}
