export function DashboardSkeleton() {
  return (
    <div className="space-y-6">

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-indigo-100 rounded animate-pulse" />
          <div className="h-4 w-64 bg-indigo-100 rounded animate-pulse" />
        </div>

        <div className="flex gap-3">
          <div className="h-12 w-44 rounded-xl bg-indigo-100 animate-pulse" />
          <div className="h-12 w-48 rounded-xl bg-indigo-200 animate-pulse" />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl animate-pulse" />
              <div className="h-4 w-16 bg-indigo-100 rounded animate-pulse" />
            </div>

            <div className="space-y-2">
              <div className="h-8 w-28 bg-indigo-100 rounded animate-pulse" />
              <div className="h-4 w-24 bg-indigo-100 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg space-y-4">
        <div className="h-6 w-40 bg-indigo-100 rounded animate-pulse" />
        <div className="h-64 w-full bg-indigo-50 rounded-xl animate-pulse" />
      </div>

      <div className="bg-red-50 border-l-4 border-red-300 rounded-xl p-4 space-y-2">
        <div className="h-4 w-40 bg-red-200 rounded animate-pulse" />
        <div className="h-3 w-full bg-red-200 rounded animate-pulse" />
        <div className="h-3 w-5/6 bg-red-200 rounded animate-pulse" />
      </div>

    </div>
  );
}
