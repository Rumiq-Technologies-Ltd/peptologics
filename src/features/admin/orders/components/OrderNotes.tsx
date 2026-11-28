"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addOrderNoteAction } from "@/features/admin/orders/actions/orderActions";
import type { AdminOrderNote } from "@/features/admin/orders/types";
import { MAX_NOTE_LENGTH } from "@/features/admin/orders/validation/order.schema";
import { cn } from "@/utils/cn";

import { LocalTime } from "./LocalTime";

interface OrderNotesProps {
  orderId: string;
  notes: AdminOrderNote[];
}

/** Staff-only notes. Each records who wrote it and when, and none can be edited or deleted. */
export function OrderNotes({ orderId, notes }: OrderNotesProps) {
  const router = useRouter();
  const fieldId = useId();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function add(): void {
    setMessage(null);
    startTransition(async () => {
      const result = await addOrderNoteAction(orderId, body);
      setMessage({ ok: result.success, text: result.message });
      if (result.success) {
        setBody("");
        router.refresh();
      }
    });
  }

  return (
    <section
      className="border-ink-200 rounded-lg border bg-white p-5"
      aria-labelledby="order-notes"
    >
      <h2 id="order-notes" className="text-ink-950 text-base font-semibold">
        Staff notes
      </h2>
      <p className="text-ink-600 mt-1 text-xs">
        Only staff can see these. They are never shown to the customer or sent by email, and they
        cannot be edited or deleted.
      </p>

      {notes.length === 0 ? (
        <p className="text-ink-600 mt-3 text-sm">No notes yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="bg-ink-50 rounded-md p-3 text-sm">
              <p className="whitespace-pre-wrap">{note.body}</p>
              <p className="text-ink-600 mt-2 text-xs">
                {note.authorEmail} · <LocalTime value={note.createdAt} />
              </p>
            </li>
          ))}
        </ul>
      )}

      <label htmlFor={fieldId} className="mt-4 block text-sm font-medium">
        Add a note
      </label>
      <Textarea
        id={fieldId}
        className="mt-1 bg-white dark:bg-white"
        value={body}
        maxLength={MAX_NOTE_LENGTH}
        onChange={(event) => setBody(event.target.value)}
        disabled={pending}
        aria-describedby={`${fieldId}-count`}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span id={`${fieldId}-count`} className="text-ink-600 text-xs">
          {body.length} / {MAX_NOTE_LENGTH}
        </span>
        <Button onClick={add} disabled={pending || body.trim().length === 0}>
          {pending ? "Adding…" : "Add note"}
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
