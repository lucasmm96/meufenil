import { WifiOff } from "lucide-react";
import { useAuth } from "@/react-app/context/AuthContext";
import { HeaderSkeleton } from "./HeaderSkeleton";
import { NavSkeleton } from "./NavSkeleton";
import { FooterSkeleton } from "./FooterSkeleton";

export function LayoutSkeleton({ children }: { children: React.ReactNode }) {
  const { loadingTooLong } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <HeaderSkeleton />

      <NavSkeleton />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loadingTooLong && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 mb-6">
            <WifiOff className="w-4 h-4 flex-shrink-0" />
            <span>Verificando conexão… Se estiver offline, você será redirecionado em breve.</span>
          </div>
        )}
        {children}
      </main>

      <FooterSkeleton />
    </div>
  );
}
