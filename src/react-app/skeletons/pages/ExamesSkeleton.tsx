export function ExamesSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-gray-200 rounded-lg" />
          <div className="h-4 w-64 bg-gray-200 rounded-lg" />
        </div>

        <div className="h-12 w-48 bg-gray-200 rounded-xl" />
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white/80 rounded-2xl p-6 shadow-lg space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 bg-gray-200 rounded-xl" />
              <div className="h-4 w-24 bg-gray-200 rounded-lg" />
            </div>

            <div className="h-8 w-32 bg-gray-200 rounded-lg" />
            <div className="h-4 w-40 bg-gray-200 rounded-lg" />
          </div>
        ))}
      </div>

      <div className="bg-white/80 rounded-2xl p-6 shadow-lg space-y-4">
        <div className="h-6 w-56 bg-gray-200 rounded-lg" />
        <div className="h-64 w-full bg-gray-200 rounded-xl" />
      </div>

      <div className="bg-white/80 rounded-2xl shadow-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="h-6 w-48 bg-gray-200 rounded-lg" />
        </div>

        <div className="p-6 space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="grid grid-cols-4 gap-4 items-center">
              <div className="h-4 bg-gray-200 rounded-lg" />
              <div className="h-4 bg-gray-200 rounded-lg" />
              <div className="h-4 bg-gray-200 rounded-lg" />
              <div className="h-6 w-6 bg-gray-200 rounded-lg justify-self-start" />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 rounded-xl p-4">
        <div className="flex gap-3">
          <div className="w-5 h-5 bg-gray-200 rounded" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-48 bg-gray-200 rounded-lg" />
            <div className="h-3 w-full bg-gray-200 rounded-lg" />
            <div className="h-3 w-5/6 bg-gray-200 rounded-lg" />
          </div>
        </div>
      </div>

    </div>
  );
}
