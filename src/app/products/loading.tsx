/**
 * Catalog skeleton.
 *
 * Row heights and the grid template match the real list, so the transition to
 * content causes no layout shift.
 */
export default function ProductsLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the product catalog.</span>

      <div className="h-4 w-72 animate-pulse rounded bg-gray-200" />
      <div className="mt-4 h-9 w-64 animate-pulse rounded bg-gray-200" />
      <div className="mt-3 h-5 w-full max-w-2xl animate-pulse rounded bg-gray-100" />

      <ul className="mt-10 divide-y divide-gray-200 border-y border-gray-200">
        {/* Twelve rows: the real catalog size, so the page does not resize on load. */}
        {Array.from({ length: 12 }, (_, index) => (
          <li key={index} className="flex items-center justify-between gap-6 py-4">
            <div className="min-w-0 flex-1">
              <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
              <div className="mt-2 h-4 w-48 animate-pulse rounded bg-gray-100" />
            </div>
            <div className="h-5 w-16 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
          </li>
        ))}
      </ul>
    </main>
  );
}
