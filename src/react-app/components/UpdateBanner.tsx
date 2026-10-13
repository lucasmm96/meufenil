import { Loader2, AlertCircle } from 'lucide-react';

interface UpdateBannerProps {
  isSyncing: boolean;
  syncError: string | null;
  onUpdate?: () => void;
}

export function UpdateBanner({ isSyncing, syncError }: UpdateBannerProps) {
  if (isSyncing) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="w-full bg-blue-100 border-b border-blue-300 px-4 py-2 flex items-center justify-center gap-2 text-sm text-blue-800"
      >
        <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" aria-hidden="true" />
        <span>Há uma atualização disponível. Sincronizando dados antes de atualizar...</span>
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
        <span>
          Não foi possível sincronizar os dados antes de atualizar. Dados offline mantidos. Tente novamente ou reinicie o app quando possível.
        </span>
      </div>
    );
  }

  return null;
}
