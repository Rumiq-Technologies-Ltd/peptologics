import type { Metadata } from "next";
import Link from "next/link";

import { getOrderAdmin } from "@/features/admin/orders/services/container.server";
import { requireAdmin } from "@/lib/admin/authorize.server";
import { logger } from "@/lib/logger";

export const metadata: Metadata = { title: "Home" };

const PLACEHOLDER_CARDS = [
  { title: "Lab reports", body: "Manage certificates of analysis." },
] as const;

/** New orders over the last twelve months, or null when the count is unavailable. */
async function newOrderCount(): Promise<number | null> {
  try {
    return await getOrderAdmin().countNew();
  } catch (error) {
    // The home page still works without the count.
    logger.error("admin_home_new_order_count_failed", { error });
    return null;
  }
}

export default async function AdminHomePage() {
  const session = await requireAdmin({ role: "editor" });
  const newOrders = await newOrderCount();

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-ink-950 text-2xl font-bold">Welcome</h1>
      <p className="text-ink-700 mt-2">You are signed in as {session.email}.</p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <li className="border-ink-200 rounded-lg border bg-white p-5">
          <h2 className="text-ink-950 text-base font-semibold">Orders</h2>
          {newOrders === null ? (
            <p className="text-ink-700 mt-1 text-sm">The new-order count is unavailable.</p>
          ) : (
            <p className="mt-1">
              <span className="text-ink-950 text-3xl font-bold">{newOrders}</span>{" "}
              <span className="text-ink-700 text-sm">
                new {newOrders === 1 ? "order" : "orders"} (last 12 months)
              </span>
            </p>
          )}
          <Link
            href="/admin/orders?status=new"
            className="text-primary mt-3 inline-block text-sm font-medium underline underline-offset-4"
          >
            {newOrders === 0 ? "View all orders" : "Review new orders"}
          </Link>
        </li>
        <li className="border-ink-200 rounded-lg border bg-white p-5">
          <h2 className="text-ink-950 text-base font-semibold">Products</h2>
          <p className="text-ink-700 mt-1 text-sm">Edit the catalog, prices and availability.</p>
          <Link
            href="/admin/products"
            className="text-primary mt-3 inline-block text-sm font-medium underline underline-offset-4"
          >
            Open products
          </Link>
        </li>
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
