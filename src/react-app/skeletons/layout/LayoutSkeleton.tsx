import { HeaderSkeleton } from "./HeaderSkeleton";
import { NavSkeleton } from "./NavSkeleton";
import { FooterSkeleton } from "./FooterSkeleton";

export function LayoutSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <HeaderSkeleton />
      
      <NavSkeleton />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
      
      <FooterSkeleton />
    </div>
  );
}
