import { Skeleton } from "@/components/ui/skeleton";

export default function OrderLoading() {
  return (
    <div className="mx-auto max-w-6xl" aria-busy="true" aria-label="Loading order">
      <Skeleton className="h-6 w-24" />
      <Skeleton className="mt-4 h-8 w-48" />
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-56" />
        </div>
      </div>
    </div>
  );
}
