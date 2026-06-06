export default function SkeletonCard() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[2/3] rounded-lg skeleton" />
      <div className="mt-2 space-y-1.5">
        <div className="h-3 skeleton rounded w-4/5" />
        <div className="h-2.5 skeleton rounded w-1/2" />
      </div>
    </div>
  );
}
