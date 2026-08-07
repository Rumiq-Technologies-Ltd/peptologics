"use client";

import { MinusIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MAX_LINE_QUANTITY, MIN_LINE_QUANTITY } from "@/constants/business";
import { cn } from "@/utils/cn";

/**
 * Quantity control for one line of the inquiry list.
 *
 * Presentational: it owns no state and knows nothing about the store, so the same
 * control serves a catalog row, the desktop summary panel, the mobile drawer and
 * the `/cart` page. Whoever renders it decides where the number lives.
 *
 * At the minimum quantity the decrement button becomes a remove button — icon,
 * accessible name and action all change together. A minus that silently does
 * nothing at 1 is the more common pattern and the worse one: it leaves the visitor
 * with no way to take a line off the list from here.
 *
 * Touch targets are 44px on phones, tightening to 36px from `sm` where a pointer
 * is likely.
 */
export interface QuantityStepperProps {
  value: number;
  onChange: (next: number) => void;
  onRemove: () => void;
  /** Product name. Used to build each button's accessible name. */
  itemLabel: string;
  /** Set while the store is rehydrating, so a click cannot be overwritten. */
  disabled?: boolean;
  className?: string;
}

const CONTROL_CLASSES = "size-11 shrink-0 sm:size-9";

export function QuantityStepper({
  value,
  onChange,
  onRemove,
  itemLabel,
  disabled = false,
  className,
}: QuantityStepperProps) {
  const atMinimum = value <= MIN_LINE_QUANTITY;
  const atMaximum = value >= MAX_LINE_QUANTITY;

  return (
    <div
      role="group"
      aria-label={`Quantity of ${itemLabel}`}
      className={cn("flex items-center gap-1", className)}
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={CONTROL_CLASSES}
        disabled={disabled}
        aria-label={
          atMinimum ? `Remove ${itemLabel} from inquiry list` : `Decrease quantity of ${itemLabel}`
        }
        onClick={() => (atMinimum ? onRemove() : onChange(value - 1))}
      >
        {atMinimum ? <Trash2Icon aria-hidden="true" /> : <MinusIcon aria-hidden="true" />}
      </Button>

      {/*
        A live region so a keyboard or screen-reader user hears the new quantity
        after pressing a button. Without it the only feedback is visual, and the
        button's own name does not change.
      */}
      <span
        aria-live="polite"
        aria-atomic="true"
        className="text-ink-950 w-8 text-center font-mono text-sm font-semibold tabular-nums"
      >
        {value}
        <span className="sr-only"> on inquiry list</span>
      </span>

      <Button
        type="button"
        variant="outline"
        size="icon"
        className={CONTROL_CLASSES}
        disabled={disabled || atMaximum}
        aria-label={
          atMaximum
            ? `Maximum quantity of ${MAX_LINE_QUANTITY} reached for ${itemLabel}`
            : `Increase quantity of ${itemLabel}`
        }
        onClick={() => onChange(value + 1)}
      >
        <PlusIcon aria-hidden="true" />
      </Button>
    </div>
  );
}
