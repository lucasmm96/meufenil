export function AdminSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <div className="h-8 w-72 bg-indigo-100 rounded animate-pulse" />
        <div className="h-4 w-56 bg-indigo-100 rounded animate-pulse" />
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

      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden space-y-0">
        <div className="p-6 border-b border-gray-200 flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="h-5 w-48 bg-indigo-100 rounded animate-pulse" />
            <div className="h-4 w-72 bg-indigo-100 rounded animate-pulse" />
          </div>
          <div className="h-10 w-28 bg-indigo-100 rounded-xl animate-pulse" />
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-indigo-100 animate-pulse" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-32 bg-indigo-100 rounded animate-pulse" />
                    <div className="h-3 w-24 bg-indigo-100 rounded animate-pulse" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 2 }).map((__, j) => (
                    <div key={j} className="h-12 rounded-xl bg-indigo-100 animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-slate-50 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-indigo-100 animate-pulse" />
              <div className="h-4 w-20 bg-indigo-100 rounded animate-pulse" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 rounded-xl bg-indigo-100 animate-pulse" />
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="h-4 w-48 bg-indigo-100 rounded animate-pulse" />
                <div className="h-3 w-64 bg-indigo-100 rounded animate-pulse" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-9 w-24 bg-indigo-100 rounded-lg animate-pulse" />
                <div className="h-9 w-24 bg-indigo-100 rounded-lg animate-pulse" />
              </div>
            </div>

            <div className="hidden md:block">
              <div className="grid grid-cols-6 gap-4 px-6 py-4 border-b border-gray-200 bg-gray-50">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-3 rounded bg-indigo-100 animate-pulse" />
                ))}
              </div>

              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="grid grid-cols-6 gap-4 px-6 py-4 border-b border-gray-100 items-center">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <div key={j} className="h-4 rounded bg-indigo-100 animate-pulse" />
                  ))}
                </div>
              ))}
            </div>

            <div className="md:hidden p-4 space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2 flex-1">
                      <div className="h-4 w-36 bg-indigo-100 rounded animate-pulse" />
                      <div className="h-3 w-24 bg-indigo-100 rounded animate-pulse" />
                    </div>
                    <div className="h-6 w-16 bg-indigo-100 rounded-full animate-pulse" />
                  </div>
                  <div className="h-3 w-40 bg-indigo-100 rounded animate-pulse" />
                  <div className="h-3 w-full bg-indigo-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
              <div className="h-4 w-40 bg-indigo-100 rounded animate-pulse" />
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-indigo-100 animate-pulse" />
                ))}
              </div>
              <div className="h-24 rounded-xl bg-indigo-100 animate-pulse" />
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
              <div className="h-4 w-28 bg-indigo-100 rounded animate-pulse" />
              <div className="h-72 rounded-2xl bg-indigo-100 animate-pulse" />
            </div>
          </div>
        </div>
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
