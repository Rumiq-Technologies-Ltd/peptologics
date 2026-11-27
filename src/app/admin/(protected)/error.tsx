"use client";

import { Button } from "@/components/ui/button";

/** Admin error boundary. The message is never shown: it may hold internal detail. */
export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-ink-950 text-2xl font-bold">Something went wrong</h1>
      <p className="text-ink-700 mt-3">
        This is on our side, not yours. Try again, and if it keeps happening, tell the developer
        {error.digest ? ` and quote ${error.digest}` : ""}.
      </p>
      <Button className="mt-6" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
