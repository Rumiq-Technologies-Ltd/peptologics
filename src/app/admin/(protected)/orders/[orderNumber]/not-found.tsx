import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function OrderNotFound() {
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-ink-950 text-2xl font-bold">Order not found</h1>
      <p className="text-ink-700 mt-3">
        There is no order with that number. Check the number, or find it in the list.
      </p>
      <Link href="/admin/orders" className={buttonVariants({ className: "mt-6" })}>
        Back to orders
      </Link>
    </div>
  );
}
