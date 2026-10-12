import { WifiOff, Loader2, AlertCircle, AlertTriangle } from 'lucide-react';

interface OfflineBannerProps {
  isOnline: boolean;
  isSyncing: boolean;
  syncError: string | null;
  isIos: boolean;
}

export function OfflineBanner({ isOnline, isSyncing, syncError, isIos }: OfflineBannerProps) {
  if (isOnline && !isSyncing && !syncError) return null;

  if (!isOnline && isIos) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="w-full bg-amber-100 border-b border-amber-300 px-4 py-2 flex items-center justify-center gap-2 text-sm text-amber-800"
      >
        <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        <span>Acesso offline não disponível no iOS. Reconecte-se para continuar.</span>
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="w-full bg-orange-100 border-b border-orange-300 px-4 py-2 flex items-center justify-center gap-2 text-sm text-orange-800"
      >
        <WifiOff className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        <span>Você está offline. Exibindo dados armazenados localmente.</span>
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="w-full bg-blue-100 border-b border-blue-300 px-4 py-2 flex items-center justify-center gap-2 text-sm text-blue-800"
      >
        <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" aria-hidden="true" />
        <span>Conexão restaurada. Atualizando dados...</span>
      </div>
    );
  }

  if (syncError) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="w-full bg-red-100 border-b border-red-300 px-4 py-2 flex items-center justify-center gap-2 text-sm text-red-800"
      >
        <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
        <span>Erro ao sincronizar. Tentaremos novamente em breve.</span>
      </div>
    );
  }

  return null;
}
