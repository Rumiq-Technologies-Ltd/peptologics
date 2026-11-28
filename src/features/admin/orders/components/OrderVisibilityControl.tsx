"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { hideOrderAction, restoreOrderAction } from "@/features/admin/orders/actions/orderActions";
import { cn } from "@/utils/cn";

interface OrderVisibilityControlProps {
  orderId: string;
  orderNumber: string;
  version: number;
  hidden: boolean;
}

/**
 * Hides an order as test or spam, or brings it back (D41). Nothing is deleted: a hidden order
 * only leaves the default list.
 */
export function OrderVisibilityControl({
  orderId,
  orderNumber,
  version,
  hidden,
}: OrderVisibilityControlProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function confirm(): void {
    startTransition(async () => {
      const result = hidden
        ? await restoreOrderAction(orderId, version)
        : await hideOrderAction(orderId, version);
      setMessage({ ok: result.success, text: result.message });
      setOpen(false);
      if (result.success || result.code === "VERSION_CONFLICT") router.refresh();
    });
  }

  return (
    <section
      className="border-ink-200 rounded-lg border bg-white p-5"
      aria-labelledby="order-visibility"
    >
      <h2 id="order-visibility" className="text-ink-950 text-base font-semibold">
        {hidden ? "Hidden order" : "Test or spam?"}
      </h2>
      <p className="text-ink-700 mt-1 text-sm">
        {hidden
          ? "This order is hidden from the default list. Show it again if it was hidden by mistake."
          : "Hide an order that is a test or spam. It leaves the default list but is never deleted."}
      </p>
      <Button
        className="mt-3"
        variant={hidden ? "outline" : "destructive"}
        onClick={() => setOpen(true)}
      >
        {hidden ? "Restore order" : "Mark as test / spam"}
      </Button>
      <p
        role="status"
        aria-live="polite"
        className={cn("mt-2 min-h-5 text-sm", message && !message.ok && "text-red-700")}
      >
        {message?.text}
      </p>

      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {hidden ? `Restore ${orderNumber}?` : `Hide ${orderNumber} as test or spam?`}
            </DialogTitle>
            <DialogDescription>
              {hidden
                ? "It will appear in the orders list again."
                : "It will disappear from the orders list unless “Show hidden” is ticked. Nothing is deleted, and you can restore it at any time."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant={hidden ? "default" : "destructive"}
              onClick={confirm}
              disabled={pending}
            >
              {pending ? "Saving…" : hidden ? "Restore order" : "Hide order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
