import { Skeleton, SkeletonStatCards, SkeletonTableRows } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="h-8 w-48 animate-pulse rounded bg-surface-muted" />
          <div className="mt-1 h-4 w-64 animate-pulse rounded bg-surface-muted" />
        </div>
      </div>
      <SkeletonStatCards />
      <Skeleton className="h-64 w-full" />
      <SkeletonTableRows />
    </div>
  );
}
