"use client";

import Link from "next/link";

import { MESSAGES } from "@/constants/messages";
import { ROUTES } from "@/constants/routes";

/**
 * Product detail error boundary. Next 16 passes `retry`, not `reset`.
 *
 * Note this only handles unexpected failures — an unknown slug renders
 * not-found.tsx instead, because the page calls `notFound()` for that case rather
 * than throwing.
 */
export default function ProductError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-bold tracking-tight">{MESSAGES.products.loadFailed}</h1>
      <p className="mt-3 text-gray-600">
        We could not load this product just now. Try again, or browse the full catalog.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-md bg-gray-900 px-4 py-2 font-medium text-white"
        >
          {MESSAGES.generic.retry}
        </button>
        <Link
          href={ROUTES.products}
          className="rounded-md border border-gray-300 px-4 py-2 font-medium"
        >
          All products
        </Link>
      </div>

      {error.digest ? (
        <p className="mt-8 font-mono text-xs text-gray-400">Reference: {error.digest}</p>
      ) : null}
    </main>
  );
}
