import Link from "next/link";

import { MESSAGES } from "@/constants/messages";
import { ROUTES } from "@/constants/routes";

/**
 * Unknown product slug. Always offers a route back into the catalog rather than a
 * dead end — an out-of-date bookmark or a retired product is the common cause.
 */
export default function ProductNotFound() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-bold tracking-tight">{MESSAGES.products.notFound}</h1>
      <p className="mt-3 text-gray-600">
        The link may be out of date, or the compound may no longer be listed. The full catalog is
        below.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={ROUTES.products}
          className="rounded-md bg-gray-900 px-4 py-2 font-medium text-white"
        >
          Browse all products
        </Link>
        <Link
          href={ROUTES.contact}
          className="rounded-md border border-gray-300 px-4 py-2 font-medium"
        >
          Ask about a compound
        </Link>
      </div>
    </main>
  );
}
