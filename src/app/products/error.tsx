"use client";

import Link from "next/link";

import { MESSAGES } from "@/constants/messages";
import { ROUTES } from "@/constants/routes";

/**
 * Catalog error boundary.
 *
 * Next 16 passes `retry`, not `reset` — `retry` re-runs the failed server render,
 * whereas `reset` only re-renders children with the same data and would show the
 * same error again.
 *
 * `error.digest` is shown deliberately: it is a hash Next logs server-side, so it
 * gives support something to correlate on without exposing the message itself.
 */
export default function ProductsError({
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
        This is on our side, not yours. Try again in a moment — if it keeps happening, contact us
        and we will help directly.
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
          href={ROUTES.contact}
          className="rounded-md border border-gray-300 px-4 py-2 font-medium"
        >
          Contact us
        </Link>
      </div>

      {error.digest ? (
        <p className="mt-8 font-mono text-xs text-gray-400">Reference: {error.digest}</p>
      ) : null}
    </main>
  );
}
