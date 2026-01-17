export function HeaderSkeleton() {
  return (
    <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-200/50 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 animate-pulse" />
            <div className="h-5 w-28 bg-indigo-100 rounded animate-pulse" />
          </div>

          <div className="flex items-center gap-4">
            <div className="h-8 w-20 bg-indigo-100 rounded-lg animate-pulse hidden sm:block" />
            <div className="h-8 w-16 bg-indigo-100 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    </header>
  );
}
