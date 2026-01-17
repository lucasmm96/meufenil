export function GenericPageSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="h-4 w-72 bg-gray-200 rounded" />
      </div>

      {/* Card principal */}
      <div className="bg-white rounded-2xl p-6 shadow space-y-4">
        <div className="h-6 w-40 bg-gray-200 rounded" />

        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-11 w-full bg-gray-200 rounded-xl" />
          </div>
        ))}

        <div className="h-12 w-full bg-gray-300 rounded-xl mt-4" />
      </div>

      {/* Cards secundários */}
      <div className="grid md:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-6 shadow space-y-3"
          >
            <div className="h-5 w-32 bg-gray-200 rounded" />
            <div className="h-4 w-full bg-gray-200 rounded" />
            <div className="h-4 w-5/6 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
