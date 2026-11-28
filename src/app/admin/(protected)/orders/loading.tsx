import { Skeleton } from "@/components/ui/skeleton";

export default function OrdersLoading() {
  return (
    <div className="mx-auto max-w-6xl" aria-busy="true" aria-label="Loading orders">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="mt-6 h-12 w-full" />
      <div className="mt-6 space-y-2">
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
