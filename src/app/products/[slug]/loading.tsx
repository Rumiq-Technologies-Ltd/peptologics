/**
 * Product detail skeleton. Mirrors the real page's block order and heights so the
 * swap to content does not shift layout.
 */
export default function ProductLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading product details.</span>

      <div className="h-4 w-40 animate-pulse rounded bg-gray-100" />
      <div className="mt-6 h-9 w-56 animate-pulse rounded bg-gray-200" />
      <div className="mt-2 h-5 w-64 animate-pulse rounded bg-gray-100" />

      <div className="mt-10 h-6 w-36 animate-pulse rounded bg-gray-200" />
      <div className="mt-4 divide-y divide-gray-200 border-y border-gray-200">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex justify-between py-3">
            <div className="h-4 w-32 animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>

      <div className="mt-10 h-32 w-full animate-pulse rounded-lg bg-gray-100" />
    </main>
  );
}
