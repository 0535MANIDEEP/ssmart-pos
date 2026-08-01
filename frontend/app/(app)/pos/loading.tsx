import { SkeletonStatCards, SkeletonTableRows } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="h-8 w-48 animate-pulse rounded bg-surface-muted" />
      <SkeletonStatCards />
      <SkeletonTableRows />
    </div>
  );
}
