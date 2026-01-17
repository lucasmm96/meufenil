export function NavSkeleton() {
  return (
    <nav className="bg-white/60 backdrop-blur-md border-b border-gray-200/50">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <div className="flex gap-2 overflow-x-auto py-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 px-4 py-2">
              <div className="w-4 h-4 bg-indigo-100 rounded animate-pulse" />
              <div className="h-3 w-16 bg-indigo-100 rounded animate-pulse hidden sm:block" />
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
}
