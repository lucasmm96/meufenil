export function EstatisticasSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">

      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-gray-200 rounded-lg" />
          <div className="h-4 w-64 bg-gray-200 rounded-lg" />
        </div>

        <div className="flex gap-2">
          <div className="h-10 w-24 bg-gray-200 rounded-xl" />
          <div className="h-10 w-24 bg-gray-200 rounded-xl" />
        </div>
      </div>

      <div className="bg-white/80 rounded-2xl p-4 shadow-lg">
        <div className="flex gap-2">
          <div className="h-10 flex-1 bg-gray-200 rounded-xl" />
          <div className="h-10 flex-1 bg-gray-200 rounded-xl" />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white/80 rounded-2xl p-6 shadow-lg space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-200 rounded-xl" />
              <div className="h-5 w-24 bg-gray-200 rounded-lg" />
            </div>

            <div className="h-8 w-32 bg-gray-200 rounded-lg" />
            <div className="h-4 w-40 bg-gray-200 rounded-lg" />
          </div>
        ))}
      </div>

      <div className="bg-white/80 rounded-2xl p-6 shadow-lg space-y-4">
        <div className="h-6 w-48 bg-gray-200 rounded-lg" />

        <div className="h-80 w-full bg-gray-200 rounded-xl" />
      </div>
    </div>
  );
}
