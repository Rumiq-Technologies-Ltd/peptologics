import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function AdminNotFound() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-ink-950 text-2xl font-bold">Page not found</h1>
      <p className="text-ink-700 mt-3">That admin page does not exist.</p>
      <Button asChild className="mt-6">
        <Link href="/admin">Back to admin home</Link>
      </Button>
    </main>
  );
}
