"use client";

import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";

/** Orders error boundary. The message is never shown: it may hold internal detail. */
export default function OrdersError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-ink-950 text-2xl font-bold">Orders could not be loaded</h1>
      <p className="text-ink-700 mt-3">
        This is on our side, not yours. Your customers&apos; inquiries are safe. Try again, and if
        it keeps happening, tell the developer{error.digest ? ` and quote ${error.digest}` : ""}.
      </p>
      <div className="mt-6 flex gap-3">
        <Button onClick={() => retry()}>Try again</Button>
        <Link href="/admin" className={buttonVariants({ variant: "outline" })}>
          Back to admin home
        </Link>
      </div>
    </div>
  );
}
