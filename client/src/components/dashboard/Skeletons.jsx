export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 bg-gray-200 rounded w-24" />
        <div className="w-9 h-9 bg-gray-200 rounded-lg" />
      </div>
      <div className="h-7 bg-gray-200 rounded w-20 mb-1" />
      <div className="h-3 bg-gray-100 rounded w-32" />
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-4 h-4 bg-gray-200 rounded" />
        <div className="h-4 bg-gray-200 rounded w-36" />
      </div>
      <div className="h-48 bg-gray-100 rounded-lg" />
    </div>
  );
}

export function SkeletonTable() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-4 h-4 bg-gray-200 rounded" />
        <div className="h-4 bg-gray-200 rounded w-32" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-4 bg-gray-100 rounded flex-1" />
            <div className="h-4 bg-gray-100 rounded w-16" />
            <div className="h-4 bg-gray-100 rounded w-16" />
            <div className="h-4 bg-gray-100 rounded w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
