export function FooterSkeleton() {
  return (
    <footer className="bg-white/60 backdrop-blur-md border-t border-gray-200/50 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center gap-4">
          <div className="h-4 w-64 bg-indigo-100 rounded animate-pulse" />

          <div className="flex items-center gap-6">
            <div className="h-5 w-20 bg-indigo-100 rounded animate-pulse" />
            <div className="h-5 w-16 bg-indigo-100 rounded animate-pulse" />
          </div>

          <div className="h-3 w-40 bg-indigo-100 rounded animate-pulse" />
        </div>
      </div>
    </footer>
  );
}
