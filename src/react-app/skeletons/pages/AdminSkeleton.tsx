export function AdminSkeleton() {
  return (
    <div className="space-y-8">

      <div className="space-y-2">
        <div className="h-8 w-72 bg-indigo-100 rounded animate-pulse" />
        <div className="h-4 w-56 bg-indigo-100 rounded animate-pulse" />
      </div>

      <div className="space-y-2">
        <div className="h-8 w-72 bg-indigo-100 rounded animate-pulse" />
      </div>
      
      <div className="grid md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 animate-pulse" />
              <div className="h-4 w-40 bg-indigo-100 rounded animate-pulse" />
            </div>
            <div className="h-8 w-24 bg-indigo-100 rounded animate-pulse" />
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 animate-pulse" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-40 bg-indigo-100 rounded animate-pulse" />
                <div className="h-3 w-56 bg-indigo-100 rounded animate-pulse" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="h-3 w-full bg-indigo-100 rounded animate-pulse" />
              <div className="h-3 w-5/6 bg-indigo-100 rounded animate-pulse" />
            </div>

            <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full w-1/2 bg-indigo-200 animate-pulse rounded-full" />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="h-5 w-48 bg-indigo-100 rounded animate-pulse" />
        </div>

        <div className="divide-y divide-gray-200">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="grid grid-cols-5 gap-4 px-6 py-4 items-center">
              <div className="space-y-2 col-span-2">
                <div className="h-3 w-40 bg-indigo-100 rounded animate-pulse" />
                <div className="h-3 w-56 bg-indigo-100 rounded animate-pulse" />
              </div>

              <div className="h-3 w-24 bg-indigo-100 rounded animate-pulse" />
              <div className="h-5 w-20 bg-indigo-100 rounded-full animate-pulse" />
              <div className="h-3 w-20 bg-indigo-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
