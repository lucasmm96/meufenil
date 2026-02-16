export function ReferenciasSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-56 bg-gray-200 rounded-lg" />
          <div className="h-4 w-72 bg-gray-200 rounded-lg" />
        </div>

        <div className="h-12 w-48 bg-gray-200 rounded-xl" />
      </div>

      {/* Filtros */}
      <div className="bg-white/80 rounded-2xl p-6 shadow-lg space-y-4">
        <div className="h-5 w-32 bg-gray-200 rounded-lg" />

        <div className="grid md:grid-cols-2 gap-4">
          <div className="h-10 w-full bg-gray-200 rounded-xl" />

          <div className="space-y-3">
            <div className="h-4 w-48 bg-gray-200 rounded-lg" />
            <div className="h-4 w-52 bg-gray-200 rounded-lg" />
            <div className="h-4 w-56 bg-gray-200 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white/80 rounded-2xl shadow-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="h-6 w-48 bg-gray-200 rounded-lg" />
        </div>

        <div className="p-6 space-y-4">
          {/* Cabeçalho simulado */}
          <div className="grid grid-cols-5 gap-4">
            <div className="h-4 bg-gray-200 rounded-lg" />
            <div className="h-4 bg-gray-200 rounded-lg" />
            <div className="h-4 bg-gray-200 rounded-lg" />
            <div className="h-4 bg-gray-200 rounded-lg" />
            <div className="h-4 bg-gray-200 rounded-lg" />
          </div>

          {/* Linhas simuladas */}
          {[...Array(8)].map((_, i) => (
            <div key={i} className="grid grid-cols-5 gap-4 items-center">
              <div className="h-6 w-6 bg-gray-200 rounded-full mx-auto" />
              <div className="h-4 bg-gray-200 rounded-lg" />
              <div className="h-4 bg-gray-200 rounded-lg" />
              <div className="h-6 w-24 bg-gray-200 rounded-full" />
              <div className="h-4 w-20 bg-gray-200 rounded-lg ml-auto" />
            </div>
          ))}
        </div>

        {/* Paginação */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <div className="h-4 w-32 bg-gray-200 rounded-lg" />
          <div className="h-4 w-24 bg-gray-200 rounded-lg" />
          <div className="h-8 w-40 bg-gray-200 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
