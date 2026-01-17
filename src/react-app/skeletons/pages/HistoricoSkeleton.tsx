export function HistoricoSkeleton() {
  return (
    <div className="space-y-6">

      <div className="space-y-2">
        <div className="h-8 w-40 bg-indigo-100 rounded animate-pulse" />
        <div className="h-4 w-64 bg-indigo-100 rounded animate-pulse" />
      </div>

      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-indigo-100 rounded animate-pulse" />
          <div className="h-5 w-24 bg-indigo-100 rounded animate-pulse" />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 bg-indigo-100 rounded animate-pulse" />
              <div className="h-10 w-full bg-indigo-50 rounded-xl animate-pulse" />
            </div>
          ))}
        </div>

        <div className="flex gap-4 mt-4">
          <div className="h-10 w-40 bg-indigo-200 rounded-xl animate-pulse" />
          <div className="h-4 w-32 bg-indigo-100 rounded animate-pulse self-center" />
        </div>
      </div>

      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, dayIndex) => (
          <div key={dayIndex} className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
              <div className="space-y-2">
                <div className="h-5 w-56 bg-indigo-100 rounded animate-pulse" />
                <div className="h-4 w-32 bg-indigo-100 rounded animate-pulse" />
              </div>

              <div className="space-y-2 text-right">
                <div className="h-4 w-24 bg-indigo-100 rounded animate-pulse" />
                <div className="h-7 w-28 bg-indigo-200 rounded animate-pulse" />
              </div>
            </div>

            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, regIndex) => (
                <div key={regIndex} className="flex justify-between items-center bg-gray-50 p-4 rounded-xl">
                  <div className="space-y-2">
                    <div className="h-4 w-48 bg-indigo-100 rounded animate-pulse" />
                    <div className="h-3 w-40 bg-indigo-100 rounded animate-pulse" />
                  </div>

                  <div className="w-10 h-10 bg-red-100 rounded-xl animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
