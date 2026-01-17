export function SobreSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-pulse">

      <div className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gray-200" />
        <div className="h-10 w-72 bg-gray-200 rounded mx-auto" />
        <div className="h-5 w-96 bg-gray-200 rounded mx-auto" />
      </div>

      <div className="bg-white rounded-2xl p-8 shadow space-y-4">
        <div className="h-7 w-48 bg-gray-200 rounded" />
        <div className="space-y-3">
          <div className="h-4 w-full bg-gray-200 rounded" />
          <div className="h-4 w-full bg-gray-200 rounded" />
          <div className="h-4 w-5/6 bg-gray-200 rounded" />
          <div className="h-4 w-4/6 bg-gray-200 rounded" />
        </div>
      </div>

      <div className="bg-white rounded-2xl p-8 shadow space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gray-200" />
          <div className="h-7 w-48 bg-gray-200 rounded" />
        </div>

        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-gray-200" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-48 bg-gray-200 rounded" />
              <div className="h-4 w-full bg-gray-200 rounded" />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-8 shadow space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gray-200" />
          <div className="h-7 w-56 bg-gray-200 rounded" />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-gray-100 space-y-2"
            >
              <div className="h-4 w-32 bg-gray-200 rounded" />
              <div className="h-3 w-full bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-100 border-l-4 border-gray-300 rounded-xl p-6 space-y-3">
        <div className="h-5 w-40 bg-gray-200 rounded" />
        <div className="h-4 w-full bg-gray-200 rounded" />
        <div className="h-4 w-5/6 bg-gray-200 rounded" />
      </div>

      <div className="rounded-2xl p-8 bg-gray-200 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-gray-300 mx-auto" />
        <div className="h-6 w-64 bg-gray-300 rounded mx-auto" />
        <div className="h-4 w-80 bg-gray-300 rounded mx-auto" />
      </div>
    </div>
  );
}
