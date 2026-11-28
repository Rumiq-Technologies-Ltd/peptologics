"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { changeOrderStatusAction } from "@/features/admin/orders/actions/orderActions";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  type OrderStatus,
} from "@/features/admin/orders/types";
import { cn } from "@/utils/cn";

interface OrderStatusChangerProps {
  orderId: string;
  version: number;
  status: OrderStatus;
}

/** Moves an order to any status (D41). The version makes a stale save fail instead of overwriting. */
export function OrderStatusChanger({ orderId, version, status }: OrderStatusChangerProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<OrderStatus>(status);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function save(): void {
    setMessage(null);
    startTransition(async () => {
      const result = await changeOrderStatusAction(orderId, version, selected);
      setMessage({ ok: result.success, text: result.message });
      if (result.success || result.code === "VERSION_CONFLICT") router.refresh();
    });
  }

  return (
    <section
      className="border-ink-200 rounded-lg border bg-white p-5"
      aria-labelledby="order-status"
    >
      <h2 id="order-status" className="text-ink-950 text-base font-semibold">
        Status
      </h2>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Order status
          <select
            className="border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm outline-none focus-visible:ring-[3px]"
            value={selected}
            onChange={(event) => setSelected(event.target.value as OrderStatus)}
            disabled={pending}
          >
            {ORDER_STATUSES.map((value) => (
              <option key={value} value={value}>
                {ORDER_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <Button onClick={save} disabled={pending || selected === status}>
          {pending ? "Saving…" : "Save status"}
        </Button>
      </div>
      <p
        role="status"
        aria-live="polite"
        className={cn("mt-2 min-h-5 text-sm", message && !message.ok && "text-red-700")}
      >
        {message?.text}
      </p>
    </section>
  );
}
