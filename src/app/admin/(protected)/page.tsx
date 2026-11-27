import type { Metadata } from "next";

import { requireAdmin } from "@/lib/admin/authorize.server";

export const metadata: Metadata = { title: "Home" };

const PLACEHOLDER_CARDS = [
  { title: "Products", body: "Edit the catalog, prices and availability." },
  { title: "Orders", body: "Review inquiries and follow up with customers." },
  { title: "Lab reports", body: "Manage certificates of analysis." },
] as const;

export default async function AdminHomePage() {
  const session = await requireAdmin({ role: "editor" });

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-ink-950 text-2xl font-bold">Welcome</h1>
      <p className="text-ink-700 mt-2">
        You are signed in as {session.email}. Each section below arrives in a later phase.
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLACEHOLDER_CARDS.map((card) => (
          <li key={card.title} className="border-ink-200 rounded-lg border bg-white p-5">
            <h2 className="text-ink-950 text-base font-semibold">{card.title}</h2>
            <p className="text-ink-700 mt-1 text-sm">{card.body}</p>
            <p className="text-ink-500 mt-4 text-xs">Coming soon</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
