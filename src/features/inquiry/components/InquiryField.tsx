"use client";

import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/utils/cn";

/**
 * One labelled form field, with its hint and error message correctly wired.
 *
 * The accessibility plumbing is the reason this exists: `aria-invalid` on the control,
 * `aria-describedby` pointing at the hint and the error, and the error announced when
 * it appears. Getting that right once and reusing it beats getting it right nine times
 * — and a placeholder is never the label (CLAUDE.md).
 *
 * `children` is a render prop rather than a plain node so the control receives the
 * generated ids without the caller having to restate them.
 */
export interface InquiryFieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  /** Marks the field visibly optional. Everything else is required. */
  optional?: boolean;
  className?: string;
  children: (controlProps: {
    id: string;
    "aria-invalid": true | undefined;
    "aria-describedby": string | undefined;
  }) => ReactNode;
}

export function InquiryField({
  id,
  label,
  error,
  hint,
  optional = false,
  className,
  children,
}: InquiryFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="text-ink-800">
        {label}
        {optional ? <span className="text-ink-500 font-normal"> (optional)</span> : null}
      </Label>

      {children({
        id,
        // `undefined` rather than `false`: aria-invalid="false" is valid but noisier
        // than omitting the attribute, and some older screen readers announce it.
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })}

      {hint ? (
        <p id={hintId} className="text-ink-600 text-xs">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} className="text-danger text-sm font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}
