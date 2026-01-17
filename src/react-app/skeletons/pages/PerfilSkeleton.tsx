export function PerfilSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-pulse">

      <div className="space-y-2">
        <div className="h-8 w-40 bg-gray-200 rounded" />
        <div className="h-4 w-64 bg-gray-200 rounded" />
      </div>

      <div className="bg-white rounded-2xl p-6 shadow space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-gray-200 rounded" />
          <div className="h-6 w-48 bg-gray-200 rounded" />
        </div>

        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-32 bg-gray-200 rounded" />
              <div className="h-11 w-full bg-gray-200 rounded-xl" />
            </div>
          ))}

          <div className="h-12 w-full bg-gray-300 rounded-xl" />
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-gray-200 rounded" />
          <div className="h-6 w-56 bg-gray-200 rounded" />
        </div>

        <div className="h-4 w-64 bg-gray-200 rounded" />

        <div className="space-y-3">
          <div className="h-11 w-full bg-gray-200 rounded-xl" />
          <div className="h-11 w-full bg-gray-200 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
